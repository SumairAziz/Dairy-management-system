export type ClipboardResult = { ok: true } | { ok: false; error: string };

export async function copyTextToClipboard(text: string): Promise<ClipboardResult> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch {
      // fall through to legacy approach
    }
  }

  if (typeof document === "undefined") {
    return { ok: false, error: "Clipboard is not available in this environment." };
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success ? { ok: true } : { ok: false, error: "Unable to copy to clipboard." };
  } catch {
    return { ok: false, error: "Unable to copy to clipboard." };
  }
}
