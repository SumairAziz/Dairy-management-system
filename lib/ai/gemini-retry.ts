import { geminiModelCandidates } from "./gemini-config";
import {
  AiAssistantError,
  extractGeminiDiagnostics,
  toGeminiAssistantError,
} from "./assistant-errors";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;

export type GeminiErrorCategory =
  | "auth"
  | "network"
  | "rate_limit"
  | "model_not_found"
  | "temporary_availability"
  | "malformed"
  | "unknown";

function getErrorText(error: unknown): string {
  if (error instanceof AiAssistantError) return error.message;
  const msg = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  return `${msg} ${cause}`;
}

function sanitizeLogDetail(text: string): string {
  return text
    .replace(/AQ\.[A-Za-z0-9._-]+/g, "[REDACTED]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/key=[^&\s"']+/gi, "key=[REDACTED]");
}

export function extractGeminiHttpStatus(error: unknown): number | undefined {
  const text = getErrorText(error);
  const bracket = text.match(/\[(\d{3})\s[^\]]*\]/i);
  if (bracket) return Number(bracket[1]);
  const paren = text.match(/\((\d{3})\)/);
  if (paren) return Number(paren[1]);
  const failed = text.match(/failed \((\d{3})\)/i);
  if (failed) return Number(failed[1]);
  return undefined;
}

export function classifyGeminiError(error: unknown): GeminiErrorCategory {
  if (error instanceof AiAssistantError) {
    switch (error.code) {
      case "AI_INVALID_KEY":
      case "AI_MISSING_KEY":
        return "auth";
      case "AI_NETWORK_ERROR":
        return "network";
      case "AI_RATE_LIMIT":
      case "AI_QUOTA_EXCEEDED":
        return "rate_limit";
      case "AI_MODEL_NOT_FOUND":
        return "model_not_found";
      case "AI_MODEL_UNAVAILABLE":
        return "temporary_availability";
      default:
        break;
    }
  }

  const combined = getErrorText(error).toLowerCase();

  if (/api key|api_key|invalid.*key|401|unauthenticated|invalid_api_key/i.test(combined)) {
    return "auth";
  }

  if (/403|permission denied|forbidden/i.test(combined)) {
    return "auth";
  }

  if (/400 bad request|invalid json payload|malformed|unknown name "response"/i.test(combined)) {
    return "malformed";
  }

  if (/fetch failed|enotfound|econnrefused|etimedout|network|socket/i.test(combined)) {
    return "network";
  }

  if (/429|too many requests|quota|rate limit/i.test(combined)) {
    return "rate_limit";
  }

  if (
    /503|service unavailable|high demand|overloaded|temporarily unavailable|capacity|try again later/i.test(
      combined,
    )
  ) {
    return "temporary_availability";
  }

  if (/404|not found|no longer available|unsupported model|is not found for api version/i.test(combined)) {
    return "model_not_found";
  }

  return "unknown";
}

export function isGeminiTemporaryAvailabilityError(error: unknown): boolean {
  return classifyGeminiError(error) === "temporary_availability";
}

export function logGeminiDiagnostic(diag: {
  operation: string;
  model: string;
  attempt: number;
  httpStatus?: number;
  category: GeminiErrorCategory;
  detail?: string;
}): void {
  console.warn(
    "[Gemini]",
    JSON.stringify({
      operation: diag.operation,
      model: diag.model,
      attempt: diag.attempt,
      httpStatus: diag.httpStatus ?? null,
      category: diag.category,
      detail: diag.detail ? sanitizeLogDetail(diag.detail).slice(0, 200) : null,
    }),
  );
}

function retryConfig(): { maxRetries: number; baseDelayMs: number } {
  const maxRetries = Number(process.env.GEMINI_RETRY_MAX ?? DEFAULT_MAX_RETRIES);
  const baseDelayMs = Number(process.env.GEMINI_RETRY_BASE_MS ?? DEFAULT_BASE_DELAY_MS);
  return {
    maxRetries: Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : DEFAULT_MAX_RETRIES,
    baseDelayMs:
      Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? Math.floor(baseDelayMs) : DEFAULT_BASE_DELAY_MS,
  };
}

function backoffMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function failFast(error: unknown): never {
  throw toGeminiAssistantError(error);
}

function serviceUnavailableError(lastError: unknown, model: string): AiAssistantError {
  const ctx = extractGeminiDiagnostics(lastError);
  return new AiAssistantError(
    503,
    "AI_MODEL_UNAVAILABLE",
    ctx.httpStatus
      ? `Gemini is temporarily unavailable (${ctx.httpStatus}). Please retry in a moment.`
      : "Gemini is temporarily unavailable. Please retry in a moment.",
    {
      ...ctx,
      model,
      details: ctx.details ?? "HTTP 503: Service Unavailable",
    },
  );
}

function orderedModels(preferredFirst?: string | null): string[] {
  const candidates = geminiModelCandidates();
  if (!preferredFirst || !candidates.includes(preferredFirst)) {
    return candidates;
  }
  return [preferredFirst, ...candidates.filter((name) => name !== preferredFirst)];
}

/**
 * Retries temporary 503/overload errors with exponential backoff on the same model,
 * then falls back to the next configured model. Never retries auth, malformed, or
 * network failures.
 */
export async function withGeminiRetryAndModelFallback<T>(
  operation: string,
  execute: (model: string) => Promise<T>,
  options?: { preferredModel?: string | null },
): Promise<T> {
  const { maxRetries, baseDelayMs } = retryConfig();
  const models = orderedModels(options?.preferredModel);
  let lastAvailabilityError: unknown;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await execute(model);
      } catch (error) {
        const category = classifyGeminiError(error);
        logGeminiDiagnostic({
          operation,
          model,
          attempt,
          httpStatus: extractGeminiHttpStatus(error),
          category,
          detail: getErrorText(error),
        });

        if (category === "auth" || category === "malformed") {
          failFast(error);
        }

        if (category === "network" || category === "rate_limit" || category === "model_not_found") {
          failFast(error);
        }

        if (category === "temporary_availability") {
          lastAvailabilityError = error;
          if (attempt < maxRetries) {
            await sleep(backoffMs(attempt, baseDelayMs));
            continue;
          }

          if (modelIndex < models.length - 1) {
            logGeminiDiagnostic({
              operation,
              model,
              attempt: 0,
              category: "temporary_availability",
              detail: `fallback_to=${models[modelIndex + 1]}`,
            });
            break;
          }

          throw serviceUnavailableError(lastAvailabilityError ?? error, model);
        }

        failFast(error);
      }
    }
  }

  const fallbackModel = models[models.length - 1] ?? "unknown";
  if (lastAvailabilityError) {
    throw serviceUnavailableError(lastAvailabilityError, fallbackModel);
  }

  throw serviceUnavailableError(new Error("Gemini request failed."), fallbackModel);
}
