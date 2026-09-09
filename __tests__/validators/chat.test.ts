import { describe, it, expect } from "vitest";
import {
  chatUsersQuerySchema,
  createConversationSchema,
  olderMessagesQuerySchema,
  sendMessageSchema,
} from "@/validators/chat.validator";
import { sanitizeFileName, validateAttachment } from "@/lib/chat/storage";

describe("chat.validator", () => {
  it("validates create conversation payload", () => {
    expect(createConversationSchema.parse({ user_id: 2 })).toEqual({ user_id: 2 });
  });

  it("validates send message payload", () => {
    expect(sendMessageSchema.parse({ body: "Hello" })).toMatchObject({
      body: "Hello",
      message_type: "text",
    });
  });

  it("validates older messages query", () => {
    expect(olderMessagesQuerySchema.parse({ before: "10", limit: "20" })).toEqual({
      before: 10,
      limit: 20,
    });
  });

  it("validates users search query", () => {
    expect(chatUsersQuerySchema.parse({ search: "vet" })).toEqual({ search: "vet" });
  });
});

describe("chat.storage", () => {
  it("sanitizes file names", () => {
    expect(sanitizeFileName("my report (final).pdf")).toBe("my_report__final_.pdf");
  });

  it("rejects unsupported attachment types", () => {
    const bad = new File(["x"], "test.exe", { type: "application/x-msdownload" });
    expect(() => validateAttachment(bad)).toThrow("Unsupported file type");
  });
});
