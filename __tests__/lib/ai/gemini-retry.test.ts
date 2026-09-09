import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "@/lib/errors";
import {
  classifyGeminiError,
  extractGeminiHttpStatus,
  isGeminiTemporaryAvailabilityError,
  withGeminiRetryAndModelFallback,
} from "@/lib/ai/gemini-retry";
import { toGeminiAppError } from "@/lib/ai/gemini-config";

describe("lib/ai/gemini-retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_RETRY_MAX = "3";
    process.env.GEMINI_RETRY_BASE_MS = "100";
    delete process.env.GEMINI_MODEL_FALLBACK;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("classifies 503 high demand as temporary availability", () => {
    const error = new Error(
      "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing high demand.",
    );
    expect(classifyGeminiError(error)).toBe("temporary_availability");
    expect(isGeminiTemporaryAvailabilityError(error)).toBe(true);
    expect(extractGeminiHttpStatus(error)).toBe(503);
  });

  it("classifies auth errors without treating them as availability", () => {
    const error = new Error("API key not valid. Please pass a valid API key.");
    expect(classifyGeminiError(error)).toBe("auth");
    expect(toGeminiAppError(error).code).toBe("AI_INVALID_KEY");
  });

  it("classifies network failures as network errors", () => {
    const error = new Error("[GoogleGenerativeAI Error]: fetch failed");
    expect(classifyGeminiError(error)).toBe("network");
    expect(toGeminiAppError(error).code).toBe("AI_NETWORK_ERROR");
  });

  it("classifies model-not-found separately from temporary availability", () => {
    const error = new Error("Model gemini-2.5-flash not found");
    expect(classifyGeminiError(error)).toBe("model_not_found");
    expect(toGeminiAppError(error).code).toBe("AI_MODEL_NOT_FOUND");
  });

  it("retries temporary 503 with exponential backoff then succeeds", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("[503 Service Unavailable] This model is currently experiencing high demand."),
      )
      .mockRejectedValueOnce(new Error("[503 Service Unavailable] high demand"))
      .mockResolvedValueOnce("ok");

    const promise = withGeminiRetryAndModelFallback("test", execute);
    const expectation = expect(promise).resolves.toBe("ok");
    await vi.runAllTimersAsync();
    await expectation;
    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls.every(([model]) => model === "gemini-2.5-flash")).toBe(true);
  });

  it("falls back to gemini-2.0-flash after primary model 503 retries are exhausted", async () => {
    const execute = vi.fn(async (model: string) => {
      if (model === "gemini-2.5-flash") {
        throw new Error("[503 Service Unavailable] high demand");
      }
      return `answer from ${model}`;
    });

    const promise = withGeminiRetryAndModelFallback("test", execute);
    const expectation = expect(promise).resolves.toBe("answer from gemini-2.0-flash");
    await vi.runAllTimersAsync();
    await expectation;
    expect(execute.mock.calls.filter(([model]) => model === "gemini-2.5-flash")).toHaveLength(3);
    expect(execute.mock.calls.some(([model]) => model === "gemini-2.0-flash")).toBe(true);
  });

  it("returns AI_SERVICE_UNAVAILABLE when all models fail with 503", async () => {
    const execute = vi.fn(async () => {
      throw new Error("[503 Service Unavailable] high demand");
    });

    const promise = withGeminiRetryAndModelFallback("test", execute);
    const expectation = expect(promise).rejects.toMatchObject({
      code: "AI_MODEL_UNAVAILABLE",
    });
    await vi.runAllTimersAsync();
    await expectation;
  });

  it("does not retry invalid API key errors", async () => {
    const execute = vi.fn(async () => {
      throw new Error("API key not valid. Please pass a valid API key.");
    });

    await expect(withGeminiRetryAndModelFallback("test", execute)).rejects.toMatchObject({
      code: "AI_INVALID_KEY",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not retry network failures", async () => {
    const execute = vi.fn(async () => {
      throw new Error("[GoogleGenerativeAI Error]: fetch failed");
    });

    await expect(withGeminiRetryAndModelFallback("test", execute)).rejects.toMatchObject({
      code: "AI_NETWORK_ERROR",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
