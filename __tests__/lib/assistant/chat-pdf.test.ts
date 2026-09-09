import { describe, it, expect } from "vitest";
import { generateChatPdf } from "@/lib/assistant/chat-pdf";
import type { Conversation } from "@/components/assistant/types";

const conversation: Conversation = {
  id: "conv-1",
  title: "Milk report",
  updatedAt: Date.now(),
  messages: [
    { id: "1", role: "user", content: "How much milk did we produce?" },
    {
      id: "2",
      role: "assistant",
      content: "You produced **1,240 L** last week.\n\n- Mon: 180 L\n- Tue: 190 L",
    },
  ],
};

describe("lib/assistant/chat-pdf", () => {
  it("generates a searchable PDF blob", async () => {
    const blob = await generateChatPdf(conversation);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
  });

  it("handles long conversations without throwing", async () => {
    const longConversation: Conversation = {
      ...conversation,
      messages: Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content:
          i % 2 === 0
            ? `Question ${i}: ${"word ".repeat(40)}`
            : `Answer ${i}: ${"detail ".repeat(80)}`,
      })),
    };

    const blob = await generateChatPdf(longConversation);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  });
});
