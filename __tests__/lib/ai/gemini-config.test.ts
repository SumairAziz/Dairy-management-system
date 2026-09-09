import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/errors";
import { requireGeminiApiKey, toGeminiAppError, geminiModelCandidates } from "@/lib/ai/gemini-config";

describe("lib/ai/gemini-config", () => {
  it("rejects missing API key", () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(() => requireGeminiApiKey()).toThrow(AppError);
      try {
        requireGeminiApiKey();
      } catch (e) {
        expect((e as AppError).code).toBe("AI_MISSING_KEY");
      }
    } finally {
      process.env.GEMINI_API_KEY = prev;
    }
  });

  it("accepts any non-empty trimmed key without prefix validation", () => {
    const prev = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "  AQ.example-studio-key  ";
    try {
      expect(requireGeminiApiKey()).toBe("AQ.example-studio-key");
    } finally {
      process.env.GEMINI_API_KEY = prev;
    }
  });

  it("maps fetch failures to a network error", () => {
    const err = toGeminiAppError(new Error("[GoogleGenerativeAI Error]: fetch failed"));
    expect(err.code).toBe("AI_NETWORK_ERROR");
  });

  it("maps Google auth rejection to AI_INVALID_KEY", () => {
    const err = toGeminiAppError(new Error("API key not valid. Please pass a valid API key."));
    expect(err.code).toBe("AI_INVALID_KEY");
  });

  it("maps model errors to AI_MODEL_NOT_FOUND", () => {
    const err = toGeminiAppError(new Error("Model gemini-2.5-flash not found"));
    expect(err.code).toBe("AI_MODEL_NOT_FOUND");
  });

  it("maps 503 overload to AI_MODEL_UNAVAILABLE", () => {
    const err = toGeminiAppError(
      new Error("[503 Service Unavailable] This model is currently experiencing high demand."),
    );
    expect(err.code).toBe("AI_MODEL_UNAVAILABLE");
    expect(err.message).toContain("503");
  });

  it("uses specific message for unknown errors", () => {
    const err = toGeminiAppError(new Error("[GoogleGenerativeAI Error]: something weird happened"));
    expect(err.code).toBe("AI_UNKNOWN_ERROR");
    expect(err.message).toContain("something weird happened");
    expect(err.message).not.toBe("The AI assistant encountered an unexpected error. Please try again.");
  });

  it("uses gemini-2.5-flash primary with gemini-2.0-flash fallback", () => {
    const prevModel = process.env.GEMINI_MODEL;
    const prevFallback = process.env.GEMINI_MODEL_FALLBACK;
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    delete process.env.GEMINI_MODEL_FALLBACK;
    try {
      expect(geminiModelCandidates()).toEqual(["gemini-2.5-flash", "gemini-2.0-flash"]);
    } finally {
      process.env.GEMINI_MODEL = prevModel;
      process.env.GEMINI_MODEL_FALLBACK = prevFallback;
    }
  });
});
