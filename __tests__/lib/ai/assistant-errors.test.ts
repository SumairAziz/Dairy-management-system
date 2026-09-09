import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AiAssistantError,
  sanitizeAiText,
  toGeminiAssistantError,
  toOpenAiAssistantError,
  toolDatabaseError,
} from "@/lib/ai/assistant-errors";

describe("lib/ai/assistant-errors", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("redacts API keys from diagnostic text", () => {
    expect(sanitizeAiText("key=AQ.AbSecretValue&model=gemini-2.5-flash")).toContain("[REDACTED]");
    expect(sanitizeAiText("key=AQ.AbSecretValue&model=gemini-2.5-flash")).not.toContain("AQ.Ab");
  });

  it("maps Gemini 503 to AI_MODEL_UNAVAILABLE with diagnostics", () => {
    const err = toGeminiAssistantError(
      new Error("[503 Service Unavailable] This model is currently experiencing high demand."),
    );
    expect(err.code).toBe("AI_MODEL_UNAVAILABLE");
    expect(err.message).toContain("503");
    expect(err.context.provider).toBe("gemini");
    expect(err.toClientPayload().details).toContain("503");
  });

  it("maps Gemini auth failures to AI_INVALID_KEY", () => {
    const err = toGeminiAssistantError(new Error("API key not valid. Please pass a valid API key."));
    expect(err.code).toBe("AI_INVALID_KEY");
  });

  it("maps Gemini quota failures to AI_QUOTA_EXCEEDED", () => {
    const err = toGeminiAssistantError(new Error("You exceeded your current quota, please check your plan"));
    expect(err.code).toBe("AI_QUOTA_EXCEEDED");
  });

  it("maps unknown Gemini errors to AI_UNKNOWN_ERROR with original message", () => {
    const err = toGeminiAssistantError(new Error("Unexpected provider failure XYZ"));
    expect(err.code).toBe("AI_UNKNOWN_ERROR");
    expect(err.message).toContain("Unexpected provider failure XYZ");
    expect(err.message).not.toBe("The AI assistant encountered an unexpected error. Please try again.");
  });

  it("maps OpenAI missing key to AI_MISSING_KEY", () => {
    const err = toOpenAiAssistantError(new Error("OPENAI_API_KEY is not configured"));
    expect(err.code).toBe("AI_MISSING_KEY");
  });

  it("creates structured tool database errors", () => {
    const err = toolDatabaseError("getAnimals", new Error("Database connection failed"));
    expect(err.code).toBe("TOOL_DATABASE_ERROR");
    expect(err.context.tool).toBe("getAnimals");
    expect(err.toClientPayload().tool).toBe("getAnimals");
  });

  it("hides originalError in production payloads", () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = new AiAssistantError(503, "AI_MODEL_UNAVAILABLE", "Unavailable", {
      provider: "gemini",
      model: "gemini-2.5-flash",
      originalError: "Service Unavailable",
      httpStatus: 503,
    });
    const payload = err.toClientPayload();
    expect(payload.originalError).toBeUndefined();
    expect(payload.httpStatus).toBeUndefined();
    expect(payload.message).toBe("Unavailable");
  });
});
