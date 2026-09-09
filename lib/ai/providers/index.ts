import type { AiProvider } from "../types";
import { createGeminiProvider } from "./gemini.provider";
import { createOpenAiProvider } from "./openai.provider";

/**
 * Provider factory. `AI_PROVIDER` env var picks the active vendor
 * (defaults to OpenAI/GPT-5.5). To add Claude or Gemini later:
 *
 *   1. Create `lib/ai/providers/anthropic.provider.ts` (or `.gemini.provider.ts`)
 *      implementing the `AiProvider` interface from `lib/ai/types.ts`.
 *   2. Add a case for it below.
 *
 * No other file in `lib/ai/` or the UI depends on which provider is active.
 */
let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const providerId = (process.env.AI_PROVIDER || "openai").toLowerCase();

  switch (providerId) {
    case "openai":
      cached = createOpenAiProvider();
      return cached;
    case "gemini":
      cached = createGeminiProvider();
      return cached;
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${providerId}". Supported: "openai" (default), "gemini".`,
      );
  }
}
