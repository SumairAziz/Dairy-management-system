import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/ai/tools/registry", () => ({
  getTool: vi.fn(),
}));

import { getTool } from "@/lib/ai/tools/registry";
import { executeToolCall, sanitizeUserMessage, capHistory, AI_LIMITS } from "@/lib/ai/security";

const ctx = { userId: 1, role: "ADMIN" };

describe("lib/ai/security", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("executeToolCall", () => {
    it("returns an error for an unknown tool name — never silently no-ops", async () => {
      vi.mocked(getTool).mockReturnValue(undefined);
      const result = await executeToolCall({ id: "1", name: "dropDatabase", arguments: "{}" }, ctx);
      expect(result).toMatchObject({ name: "dropDatabase", error: expect.stringContaining("Unknown tool") });
    });

    it("returns an error when arguments are not valid JSON", async () => {
      vi.mocked(getTool).mockReturnValue({
        name: "getAnimals",
        schema: z.object({}),
        handler: vi.fn(),
      } as any);
      const result = await executeToolCall({ id: "1", name: "getAnimals", arguments: "{not json" }, ctx);
      expect(result).toMatchObject({ error: expect.stringContaining("not valid JSON") });
    });

    it("re-validates arguments against the tool's zod schema and rejects violations", async () => {
      vi.mocked(getTool).mockReturnValue({
        name: "getAnimals",
        schema: z.object({ farm_id: z.number().int() }),
        handler: vi.fn(),
      } as any);
      const result = await executeToolCall({ id: "1", name: "getAnimals", arguments: JSON.stringify({ farm_id: "not-a-number" }) }, ctx);
      expect(result).toMatchObject({ error: expect.stringContaining("Invalid arguments") });
    });

    it("calls the handler with validated args + ctx and returns its result on success", async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(getTool).mockReturnValue({
        name: "getAnimals",
        schema: z.object({ farm_id: z.number().int() }),
        handler,
      } as any);

      const result = await executeToolCall({ id: "1", name: "getAnimals", arguments: JSON.stringify({ farm_id: 5 }) }, ctx);

      expect(handler).toHaveBeenCalledWith({ farm_id: 5 }, ctx);
      expect(result).toEqual({ name: "getAnimals", result: { ok: true } });
    });

    it("catches non-database handler exceptions and reports them as a tool error instead of throwing", async () => {
      vi.mocked(getTool).mockReturnValue({
        name: "getAnimals",
        schema: z.object({}),
        handler: vi.fn().mockRejectedValue(new Error("Unexpected handler failure")),
      } as any);

      const result = await executeToolCall({ id: "1", name: "getAnimals", arguments: "{}" }, ctx);
      expect(result).toEqual({ name: "getAnimals", error: "Unexpected handler failure" });
    });

    it("throws TOOL_DATABASE_ERROR for Prisma failures so the API can return structured errors", async () => {
      const prismaError = Object.assign(new Error("Database connection failed"), {
        code: "P1001",
        constructor: { name: "PrismaClientKnownRequestError" },
      });
      vi.mocked(getTool).mockReturnValue({
        name: "getAnimals",
        schema: z.object({}),
        handler: vi.fn().mockRejectedValue(prismaError),
      } as any);

      await expect(executeToolCall({ id: "1", name: "getAnimals", arguments: "{}" }, ctx)).rejects.toMatchObject({
        code: "TOOL_DATABASE_ERROR",
        context: { tool: "getAnimals" },
      });
    });

    it("treats missing arguments as an empty object rather than failing", async () => {
      const handler = vi.fn().mockResolvedValue({});
      vi.mocked(getTool).mockReturnValue({ name: "getDashboardSummary", schema: z.object({}), handler } as any);

      await executeToolCall({ id: "1", name: "getDashboardSummary", arguments: "" }, ctx);
      expect(handler).toHaveBeenCalledWith({}, ctx);
    });
  });

  describe("sanitizeUserMessage", () => {
    it("trims whitespace", () => {
      expect(sanitizeUserMessage("  hello  ")).toBe("hello");
    });

    it("caps message length so oversized prompt-injection payloads can't blow up context", () => {
      const huge = "a".repeat(AI_LIMITS.MAX_USER_MESSAGE_LENGTH + 500);
      expect(sanitizeUserMessage(huge).length).toBe(AI_LIMITS.MAX_USER_MESSAGE_LENGTH);
    });
  });

  describe("capHistory", () => {
    it("keeps the full array when under the limit", () => {
      const arr = Array.from({ length: 5 }, (_, i) => i);
      expect(capHistory(arr)).toEqual(arr);
    });

    it("keeps only the most recent MAX_HISTORY_MESSAGES entries", () => {
      const arr = Array.from({ length: AI_LIMITS.MAX_HISTORY_MESSAGES + 10 }, (_, i) => i);
      const capped = capHistory(arr);
      expect(capped).toHaveLength(AI_LIMITS.MAX_HISTORY_MESSAGES);
      expect(capped[capped.length - 1]).toBe(arr[arr.length - 1]);
    });
  });
});
