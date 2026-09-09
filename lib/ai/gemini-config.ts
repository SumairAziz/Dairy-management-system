import {
  AiAssistantError,
  getConfiguredGeminiModel,
  toGeminiAssistantError,
} from "./assistant-errors";

/** Default fallback when GEMINI_MODEL_FALLBACK is not set. */
export const DEFAULT_GEMINI_MODEL_FALLBACKS = ["gemini-2.0-flash"] as const;

/** Models to try after the configured primary model (503 fallback chain). */
export function geminiModelFallbacks(): string[] {
  const configured = process.env.GEMINI_MODEL_FALLBACK?.trim();
  if (configured) return [configured];
  return [...DEFAULT_GEMINI_MODEL_FALLBACKS];
}

/** Primary model first, then configured fallback(s). */
export function geminiModelCandidates(): string[] {
  const preferred = getConfiguredGeminiModel()!;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [preferred, ...geminiModelFallbacks()]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function requireGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AiAssistantError(
      503,
      "AI_MISSING_KEY",
      "Gemini API key is not configured.",
      {
        provider: "gemini",
        model: getConfiguredGeminiModel(),
        details: "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
    );
  }
  return key;
}

/** @deprecated Use toGeminiAssistantError from assistant-errors.ts */
export function toGeminiAppError(error: unknown): AiAssistantError {
  return toGeminiAssistantError(error);
}
