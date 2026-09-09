import { describe, it, expect, vi, beforeEach } from "vitest";

const { chatMock, executeToolCallMock, classifySourceRouteMock, runWebGroundingMock } =
  vi.hoisted(() => ({
    chatMock: vi.fn(),
    executeToolCallMock: vi.fn(),
    classifySourceRouteMock: vi.fn(),
    runWebGroundingMock: vi.fn(),
  }));

vi.mock("@/lib/ai/providers", () => ({
  getAiProvider: () => ({ id: "openai", chat: chatMock }),
}));
vi.mock("@/lib/ai/tools/registry", () => ({
  getToolSpecs: () => [{ name: "getAnimals", description: "d", parameters: { type: "object", properties: {} } }],
}));
vi.mock("@/lib/ai/prompts/system-prompt", () => ({
  buildSystemPrompt: () => "SYSTEM PROMPT",
}));
vi.mock("@/lib/ai/prompts/source-routing-prompt", () => ({
  buildSourceRoutingPrompt: () => "\nROUTING",
}));
vi.mock("@/lib/ai/source-router", () => ({
  classifySourceRoute: classifySourceRouteMock,
  getLatestUserMessage: (history: Array<{ role: string; content: string }>) =>
    [...history].reverse().find((m) => m.role === "user")?.content ?? "",
}));
vi.mock("@/lib/ai/web-search", () => ({
  runWebGrounding: runWebGroundingMock,
  summarizeFarmContext: () => "farm context",
}));
vi.mock("@/lib/ai/security", () => ({
  executeToolCall: executeToolCallMock,
  sanitizeUserMessage: (s: string) => s.trim(),
  capHistory: <T,>(arr: T[]) => arr,
  AI_LIMITS: { MAX_USER_MESSAGE_LENGTH: 4000, MAX_HISTORY_MESSAGES: 40, MAX_TOOL_ITERATIONS: 6 },
}));

import { runAssistant } from "@/lib/ai/orchestrator";

const ctx = { userId: 1, role: "ADMIN" };

describe("lib/ai/orchestrator: runAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifySourceRouteMock.mockReturnValue({ kind: "DATABASE", reasons: ["test"] });
  });

  it("returns the model's answer directly when no tool call is needed (DATABASE route)", async () => {
    chatMock.mockResolvedValueOnce({ kind: "message", content: "The herd has 42 animals." });

    const result = await runAssistant({ history: [{ role: "user", content: "How many animals?" }], ctx });

    expect(result.message).toBe("The herd has 42 animals.");
    expect(result.toolsUsed).toEqual([]);
    expect(result.sourceRoute).toBe("DATABASE");
    expect(runWebGroundingMock).not.toHaveBeenCalled();
  });

  it("runs the tool-call loop for DATABASE route", async () => {
    chatMock
      .mockResolvedValueOnce({
        kind: "tool_calls",
        toolCalls: [{ id: "call_1", name: "getAnimals", arguments: "{}" }],
      })
      .mockResolvedValueOnce({ kind: "message", content: "There are 3 pregnant animals." });
    executeToolCallMock.mockResolvedValueOnce({ name: "getAnimals", result: { count: 3 } });

    const result = await runAssistant({ history: [{ role: "user", content: "Show pregnant animals" }], ctx });

    expect(executeToolCallMock).toHaveBeenCalled();
    expect(result.message).toBe("There are 3 pregnant animals.");
    expect(result.toolsUsed).toEqual(["getAnimals"]);
    expect(runWebGroundingMock).not.toHaveBeenCalled();
  });

  it("uses web grounding only for WEB route (no database tools)", async () => {
    classifySourceRouteMock.mockReturnValue({ kind: "WEB", reasons: ["general knowledge"] });
    runWebGroundingMock.mockResolvedValueOnce({
      answer: "A 7-day-old calf typically receives 4–6 L/day split across feedings.",
      grounded: true,
    });

    const result = await runAssistant({
      history: [{ role: "user", content: "How much milk should a 7-day-old calf receive?" }],
      ctx,
    });

    expect(runWebGroundingMock).toHaveBeenCalled();
    expect(chatMock).not.toHaveBeenCalled();
    expect(executeToolCallMock).not.toHaveBeenCalled();
    expect(result.toolsUsed).toEqual(["google_search"]);
    expect(result.sourceRoute).toBe("WEB");
  });

  it("propagates web grounding failures without falling back to plain chat", async () => {
    classifySourceRouteMock.mockReturnValue({ kind: "WEB", reasons: ["disease knowledge"] });
    const { AppError } = await import("@/lib/errors");
    runWebGroundingMock.mockRejectedValueOnce(
      new AppError(
        503,
        "AI_MODEL_UNAVAILABLE",
        "Gemini is temporarily unavailable. Please retry in a moment.",
      ),
    );

    await expect(
      runAssistant({ history: [{ role: "user", content: "What causes mastitis?" }], ctx }),
    ).rejects.toMatchObject({ code: "AI_MODEL_UNAVAILABLE" });
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("runs database first then web for COMBINED route", async () => {
    classifySourceRouteMock.mockReturnValue({ kind: "COMBINED", reasons: ["farm + advice"] });
    chatMock
      .mockResolvedValueOnce({
        kind: "tool_calls",
        toolCalls: [{ id: "call_1", name: "getAnimals", arguments: "{}" }],
      })
      .mockResolvedValueOnce({ kind: "message", content: "You have 2 calves under 2 weeks old." })
      .mockResolvedValueOnce({ kind: "message", content: "Combined farm + guidance answer." });
    executeToolCallMock.mockResolvedValueOnce({ name: "getAnimals", result: { count: 2 } });
    runWebGroundingMock.mockResolvedValueOnce({ answer: "Feed 4–6 L/day.", grounded: true });

    const result = await runAssistant({
      history: [
        {
          role: "user",
          content: "I have a 7-day-old calf. How much milk should it receive?",
        },
      ],
      ctx,
    });

    expect(executeToolCallMock).toHaveBeenCalled();
    expect(runWebGroundingMock).toHaveBeenCalled();
    expect(result.toolsUsed).toContain("getAnimals");
    expect(result.toolsUsed).toContain("google_search");
    expect(result.sourceRoute).toBe("COMBINED");
  });

  it("stops after MAX_TOOL_ITERATIONS on DATABASE route", async () => {
    chatMock.mockResolvedValue({
      kind: "tool_calls",
      toolCalls: [{ id: "call_x", name: "getAnimals", arguments: "{}" }],
    });
    executeToolCallMock.mockResolvedValue({ name: "getAnimals", result: {} });

    const result = await runAssistant({ history: [{ role: "user", content: "Loop forever" }], ctx });

    expect(chatMock).toHaveBeenCalledTimes(6);
    expect(result.message).toMatch(/wasn't able to finish/i);
  });
});
