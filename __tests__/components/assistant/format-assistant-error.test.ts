import { describe, it, expect } from "vitest";
import {
  formatAssistantErrorBanner,
  formatAssistantErrorDetails,
  formatAssistantErrorSummary,
} from "@/components/assistant/format-assistant-error";

describe("format-assistant-error", () => {
  it("formats a structured assistant error for the chat bubble", () => {
    const payload = {
      code: "AI_MODEL_UNAVAILABLE",
      message: "The Gemini model is currently unavailable.",
      details: "HTTP 503: Service Unavailable",
      provider: "gemini",
      model: "gemini-2.5-pro",
      httpStatus: 503,
      httpStatusText: "Service Unavailable",
      originalError: "The model is currently experiencing high demand.",
    };

    expect(formatAssistantErrorSummary(payload)).toBe(payload.message);
    expect(formatAssistantErrorBanner(payload)).toContain("AI_MODEL_UNAVAILABLE");
    expect(formatAssistantErrorBanner(payload)).toContain("Gemini");
    expect(formatAssistantErrorDetails(payload)).toContain("AI Assistant Error");
    expect(formatAssistantErrorDetails(payload)).toContain("gemini-2.5-pro");
  });
});
