import { describe, it, expect, vi } from "vitest";
import { isWebShareSupported, shareChatConversation } from "@/lib/assistant/chat-export";
import type { Conversation } from "@/components/assistant/types";

const conversation: Conversation = {
  id: "c1",
  title: "Test chat",
  updatedAt: Date.now(),
  messages: [
    { id: "1", role: "user", content: "Hello" },
    { id: "2", role: "assistant", content: "Hi there" },
  ],
};

describe("lib/assistant/chat-export web share", () => {
  it("detects unsupported Web Share API", () => {
    vi.stubGlobal("navigator", {});
    expect(isWebShareSupported()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns cancelled when user aborts share", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
      canShare: vi.fn(),
    });

    const result = await shareChatConversation(conversation);
    expect(result).toBe("cancelled");
    vi.unstubAllGlobals();
  });
});
