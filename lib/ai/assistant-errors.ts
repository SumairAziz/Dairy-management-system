import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export interface AiErrorContext {
  details?: string;
  provider?: string;
  model?: string;
  httpStatus?: number;
  httpStatusText?: string;
  tool?: string;
  originalError?: string;
}

/** Structured error payload returned by POST /api/assistant/chat. */
export interface AiAssistantErrorPayload {
  code: string;
  message: string;
  details?: string;
  provider?: string;
  model?: string;
  httpStatus?: number;
  httpStatusText?: string;
  tool?: string;
  originalError?: string;
}

const SECRET_PATTERNS: RegExp[] = [
  /AQ\.[A-Za-z0-9._-]+/g,
  /AIza[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /key=[^&\s"']+/gi,
  /postgresql:\/\/[^\s"']+/gi,
  /mysql:\/\/[^\s"']+/gi,
  /NEXTAUTH_SECRET[=:]\S+/gi,
  /GEMINI_API_KEY[=:]\S+/gi,
  /OPENAI_API_KEY[=:]\S+/gi,
  /DATABASE_URL[=:]\S+/gi,
];

export function sanitizeAiText(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out.slice(0, 500);
}

function sanitizeContext(context: AiErrorContext): AiErrorContext {
  const clean = (value?: string) => (value ? sanitizeAiText(value) : undefined);
  return {
    details: clean(context.details),
    provider: context.provider,
    model: context.model,
    httpStatus: context.httpStatus,
    httpStatusText: clean(context.httpStatusText),
    tool: context.tool,
    originalError: clean(context.originalError),
  };
}

export class AiAssistantError extends AppError {
  public readonly context: AiErrorContext;

  constructor(statusCode: number, code: string, message: string, context: AiErrorContext = {}) {
    super(statusCode, code, sanitizeAiText(message));
    this.context = sanitizeContext(context);
    Object.setPrototypeOf(this, AiAssistantError.prototype);
  }

  toClientPayload(): AiAssistantErrorPayload {
    const isProd = process.env.NODE_ENV === "production";
    const payload: AiAssistantErrorPayload = {
      code: this.code,
      message: this.message,
    };

    if (this.context.details) payload.details = this.context.details;
    if (this.context.provider) payload.provider = this.context.provider;
    if (this.context.model) payload.model = this.context.model;
    if (this.context.tool) payload.tool = this.context.tool;

    if (!isProd) {
      if (this.context.httpStatus !== undefined) payload.httpStatus = this.context.httpStatus;
      if (this.context.httpStatusText) payload.httpStatusText = this.context.httpStatusText;
      if (this.context.originalError) payload.originalError = this.context.originalError;
    }

    return payload;
  }
}

export function getActiveAiProviderId(): string {
  return (process.env.AI_PROVIDER || "openai").toLowerCase();
}

export function getConfiguredGeminiModel(): string | undefined {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function getConfiguredOpenAiModel(): string | undefined {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
}

function getErrorText(error: unknown): string {
  if (error instanceof AiAssistantError) {
    return `${error.message} ${error.context.originalError ?? ""} ${error.context.details ?? ""}`;
  }
  if (error instanceof AppError) return error.message;
  const msg = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  return `${msg} ${cause}`.trim();
}

export function extractHttpStatus(error: unknown): number | undefined {
  const text = getErrorText(error);
  const bracket = text.match(/\[(\d{3})\s[^\]]*\]/i);
  if (bracket) return Number(bracket[1]);
  const paren = text.match(/\((\d{3})\)/);
  if (paren) return Number(paren[1]);
  const failed = text.match(/failed \((\d{3})\)/i);
  if (failed) return Number(failed[1]);
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function extractHttpStatusText(error: unknown): string | undefined {
  const text = getErrorText(error);
  const match = text.match(/\[\d{3}\s+([^\]]+)\]/i);
  return match?.[1]?.trim();
}

export function extractModelFromError(error: unknown): string | undefined {
  const text = getErrorText(error);
  const fromPath = text.match(/models\/([^:\s/]+)/i)?.[1];
  if (fromPath) return fromPath;
  const fromName = text.match(/model[s]?\s+([a-z0-9][a-z0-9._-]+)/i)?.[1];
  return fromName;
}

export function extractGeminiDiagnostics(error: unknown): AiErrorContext {
  const text = sanitizeAiText(getErrorText(error));
  const httpStatus = extractHttpStatus(error);
  const httpStatusText = extractHttpStatusText(error);
  return {
    provider: "gemini",
    model: extractModelFromError(error) ?? getConfiguredGeminiModel(),
    httpStatus,
    httpStatusText,
    details: httpStatus ? `HTTP ${httpStatus}${httpStatusText ? `: ${httpStatusText}` : ""}` : undefined,
    originalError: text,
  };
}

export function extractOpenAiDiagnostics(error: unknown): AiErrorContext {
  const text = sanitizeAiText(getErrorText(error));
  let httpStatus = extractHttpStatus(error);
  let httpStatusText = extractHttpStatusText(error);

  if (typeof error === "object" && error !== null) {
    const maybe = error as { status?: number; code?: string; message?: string };
    if (typeof maybe.status === "number") httpStatus = maybe.status;
    if (maybe.message && !httpStatusText) httpStatusText = sanitizeAiText(maybe.message).slice(0, 120);
  }

  return {
    provider: "openai",
    model: getConfiguredOpenAiModel(),
    httpStatus,
    httpStatusText,
    details: httpStatus ? `HTTP ${httpStatus}${httpStatusText ? `: ${httpStatusText}` : ""}` : undefined,
    originalError: text,
  };
}

export function toGeminiAssistantError(error: unknown): AiAssistantError {
  if (error instanceof AiAssistantError) return error;

  const ctx = extractGeminiDiagnostics(error);
  const combined = getErrorText(error).toLowerCase();

  if (/gemini_api_key is not set|ai_not_configured|missing api key/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_MISSING_KEY",
      "Gemini API key is not configured.",
      { ...ctx, details: "GEMINI_API_KEY is missing from the environment." },
    );
  }

  if (/fetch failed|enotfound|econnrefused|etimedout|network|socket/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_NETWORK_ERROR",
      "Could not reach the Gemini API. Check your internet connection and try again.",
      ctx,
    );
  }

  if (/etimedout|timeout|timed out/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_TIMEOUT",
      "The Gemini request timed out. Please try again.",
      ctx,
    );
  }

  if (/api key|api_key|invalid.*key|401|unauthenticated|invalid_api_key/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_INVALID_KEY",
      "Gemini rejected the API key. Verify GEMINI_API_KEY in .env.local and restart the dev server.",
      ctx,
    );
  }

  if (/403|permission denied|forbidden/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_INVALID_KEY",
      "Gemini rejected the request due to an authentication or permission problem.",
      ctx,
    );
  }

  if (/quota exceeded|billing|exceeded your current quota/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_QUOTA_EXCEEDED",
      "Gemini API quota has been exceeded. Check your Google AI Studio usage limits.",
      ctx,
    );
  }

  if (/429|too many requests|rate limit/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_RATE_LIMIT",
      "Gemini API rate limit reached. Wait a minute and try again.",
      ctx,
    );
  }

  if (/503|service unavailable|high demand|overloaded|temporarily unavailable/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_MODEL_UNAVAILABLE",
      ctx.httpStatus
        ? `Gemini is temporarily unavailable (${ctx.httpStatus}). Please retry in a moment.`
        : "Gemini is temporarily unavailable. Please retry in a moment.",
      ctx,
    );
  }

  if (/404|not found|no longer available|unsupported model|is not found for api version/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_MODEL_NOT_FOUND",
      "The configured Gemini model was not found or is unavailable for this API key.",
      ctx,
    );
  }

  if (/400 bad request|invalid json payload|malformed|unknown name/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_INVALID_RESPONSE",
      "Gemini returned a malformed or invalid request/response.",
      ctx,
    );
  }

  if (/empty response/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_INVALID_RESPONSE",
      "Gemini returned an empty response.",
      ctx,
    );
  }

  const original = sanitizeAiText(getErrorText(error));
  return new AiAssistantError(
    503,
    "AI_UNKNOWN_ERROR",
    original.length > 180 ? `${original.slice(0, 180)}…` : original || "An unknown Gemini error occurred.",
    ctx,
  );
}

export function toOpenAiAssistantError(error: unknown): AiAssistantError {
  if (error instanceof AiAssistantError) return error;

  const ctx = extractOpenAiDiagnostics(error);
  const combined = getErrorText(error).toLowerCase();

  if (/openai_api_key is not configured|missing api key/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_MISSING_KEY",
      "OpenAI API key is not configured.",
      { ...ctx, details: "OPENAI_API_KEY is missing from the environment." },
    );
  }

  if (/incorrect api key|invalid api key|401|authentication/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_INVALID_KEY",
      "OpenAI rejected the API key. Verify OPENAI_API_KEY in .env.local.",
      ctx,
    );
  }

  if (/quota|insufficient_quota|billing/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_QUOTA_EXCEEDED",
      "OpenAI API quota has been exceeded.",
      ctx,
    );
  }

  if (/429|rate limit/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_RATE_LIMIT",
      "OpenAI API rate limit reached. Wait a moment and try again.",
      ctx,
    );
  }

  if (/model.*not found|does not exist|404/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_MODEL_NOT_FOUND",
      "The configured OpenAI model was not found or is unavailable.",
      ctx,
    );
  }

  if (/503|service unavailable|overloaded|capacity/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_MODEL_UNAVAILABLE",
      ctx.httpStatus
        ? `OpenAI is temporarily unavailable (${ctx.httpStatus}). Please retry in a moment.`
        : "OpenAI is temporarily unavailable. Please retry in a moment.",
      ctx,
    );
  }

  if (/fetch failed|enotfound|econnrefused|network|socket/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_NETWORK_ERROR",
      "Could not reach the OpenAI API. Check your internet connection and try again.",
      ctx,
    );
  }

  if (/timeout|timed out/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_TIMEOUT",
      "The OpenAI request timed out. Please try again.",
      ctx,
    );
  }

  if (/empty response/i.test(combined)) {
    return new AiAssistantError(
      503,
      "AI_INVALID_RESPONSE",
      "OpenAI returned an empty response.",
      ctx,
    );
  }

  const original = sanitizeAiText(getErrorText(error));
  return new AiAssistantError(
    503,
    "AI_UNKNOWN_ERROR",
    original.length > 180 ? `${original.slice(0, 180)}…` : original || "An unknown OpenAI error occurred.",
    ctx,
  );
}

export function toAssistantError(error: unknown, providerId = getActiveAiProviderId()): AiAssistantError {
  if (error instanceof AiAssistantError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new AiAssistantError(
      500,
      "AI_DATABASE_ERROR",
      "A database error occurred while running the assistant.",
      {
        provider: "database",
        details: sanitizeAiText(error.message),
        originalError: sanitizeAiText(error.message),
      },
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AiAssistantError(
      503,
      "AI_DATABASE_ERROR",
      "Could not connect to the database.",
      {
        provider: "database",
        details: "Database connection failed.",
        originalError: sanitizeAiText(error.message),
      },
    );
  }

  if (providerId === "gemini") return toGeminiAssistantError(error);
  if (providerId === "openai") return toOpenAiAssistantError(error);

  const original = sanitizeAiText(getErrorText(error));
  return new AiAssistantError(
    503,
    "AI_UNKNOWN_ERROR",
    original.length > 180 ? `${original.slice(0, 180)}…` : original || "An unknown AI error occurred.",
    { provider: providerId, originalError: original },
  );
}

export function toolDatabaseError(toolName: string, error: unknown): AiAssistantError {
  const reason = sanitizeAiText(error instanceof Error ? error.message : String(error));
  return new AiAssistantError(
    503,
    "TOOL_DATABASE_ERROR",
    `Tool "${toolName}" failed while querying the database.`,
    {
      tool: toolName,
      provider: "database",
      details: reason,
      originalError: reason,
    },
  );
}

export function logAiAssistantError(error: AiAssistantError): void {
  console.error(
    "[AI ERROR]",
    JSON.stringify({
      code: error.code,
      message: error.message,
      provider: error.context.provider ?? null,
      model: error.context.model ?? null,
      tool: error.context.tool ?? null,
      httpStatus: error.context.httpStatus ?? null,
      httpStatusText: error.context.httpStatusText ?? null,
      details: error.context.details ?? null,
    }),
  );
}
