import { describe, it, expect } from "vitest";
import {
  expandUiBlocks,
  getMessageCopyText,
  markdownToPlainText,
} from "@/lib/assistant/message-content";

describe("lib/assistant/message-content", () => {
  it("copies user messages verbatim", () => {
    expect(
      getMessageCopyText({
        role: "user",
        content: "How many animals\nare on my farm?",
      }),
    ).toBe("How many animals\nare on my farm?");
  });

  it("copies AI markdown as readable plain text", () => {
    const text = getMessageCopyText({
      role: "assistant",
      content: "There are **76 active animals** on your farm.",
    });
    expect(text).toContain("76 active animals");
    expect(text).not.toContain("**");
  });

  it("expands ui-table blocks for export/copy", () => {
    const raw = JSON.stringify({
      title: "Herd",
      columns: [{ key: "tag", label: "Tag" }],
      rows: [{ tag: "SLF-C011" }],
    });
    const expanded = expandUiBlocks("Summary\n```ui-table\n" + raw + "\n```");
    expect(expanded).toContain("Tag");
    expect(expanded).toContain("SLF-C011");
    expect(expanded).not.toContain("ui-table");
  });

  it("preserves bullet lists in plain text conversion", () => {
    const plain = markdownToPlainText("- first\n- second");
    expect(plain).toContain("• first");
    expect(plain).toContain("• second");
  });
});
