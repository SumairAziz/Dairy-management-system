import { describe, it, expect } from "vitest";
import {
  formatChatAsMarkdown,
  formatChatAsPlainText,
  sanitizeChatFilename,
} from "@/lib/assistant/chat-export";
import type { Conversation } from "@/components/assistant/types";

const sampleConversation: Conversation = {
  id: "conv-1",
  title: "Animal count",
  updatedAt: new Date("2026-09-05T10:00:00Z").getTime(),
  messages: [
    { id: "1", role: "user", content: "How many animals are currently on my farm?" },
    {
      id: "2",
      role: "assistant",
      content: "According to your TerraDairy records, there are **76 active animals** on your farm.",
      toolsUsed: ["getAnimals"],
    },
  ],
};

describe("lib/assistant/chat-export", () => {
  it("formats markdown export without internal tool metadata", () => {
    const md = formatChatAsMarkdown(sampleConversation);
    expect(md).toContain("# TerraDairy AI Assistant");
    expect(md).toContain("## User");
    expect(md).toContain("## AI Assistant");
    expect(md).toContain("76 active animals");
    expect(md).not.toContain("getAnimals");
    expect(md).not.toContain("sourceRoute");
  });

  it("formats plain text export with professional structure", () => {
    const text = formatChatAsPlainText(sampleConversation);
    expect(text).toContain("TERRADAIRY AI ASSISTANT");
    expect(text).toContain("USER");
    expect(text).toContain("AI ASSISTANT");
    expect(text).toContain("76 active animals");
    expect(text).not.toContain("getAnimals");
  });

  it("sanitizes filenames", () => {
    const filename = sanitizeChatFilename("Animal count / draft?", new Date("2026-09-05"), "pdf");
    expect(filename).toBe("TerraDairy_AI_Chat_Animal_count_draft_2026-09-05.pdf");
    expect(filename).not.toMatch(/[/?]/);
  });
});
