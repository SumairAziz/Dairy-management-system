import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "@/lib/assistant/clipboard";

describe("lib/assistant/clipboard", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies text using the Clipboard API", async () => {
    const result = await copyTextToClipboard("hello");
    expect(result).toEqual({ ok: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("returns an error when clipboard write fails", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error("denied"));
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      createElement: vi.fn(() => ({
        setAttribute: vi.fn(),
        select: vi.fn(),
        style: {},
        value: "",
      })),
      execCommand: vi.fn(() => false),
    });

    const result = await copyTextToClipboard("hello");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unable to copy");
  });
});
