import type { ChatMessageData, Conversation } from "@/components/assistant/types";
import { expandUiBlocks, markdownToPlainText } from "./message-content";

export interface ChatExportMeta {
  conversationDate: Date;
  messageCount: number;
  title: string;
}

function getExportMessages(conversation: Conversation): ChatMessageData[] {
  return conversation.messages.filter((m) => m.content.trim().length > 0);
}

export function getChatExportMeta(conversation: Conversation): ChatExportMeta {
  const messages = getExportMessages(conversation);
  return {
    conversationDate: new Date(conversation.updatedAt || Date.now()),
    messageCount: messages.length,
    title: conversation.title || "Conversation",
  };
}

function formatConversationDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatConversationDateShort(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function sanitizeChatFilename(title: string | undefined, date: Date, extension: string): string {
  const datePart = formatConversationDateShort(date);
  const safeTitle = (title ?? "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);

  const base = safeTitle
    ? `TerraDairy_AI_Chat_${safeTitle}_${datePart}`
    : `TerraDairy_AI_Chat_${datePart}`;
  return `${base}.${extension.replace(/^\./, "")}`;
}

function roleHeading(role: ChatMessageData["role"]): string {
  return role === "user" ? "User" : "AI Assistant";
}

function roleMarkdownHeading(role: ChatMessageData["role"]): string {
  return role === "user" ? "## User" : "## AI Assistant";
}

function rolePlainHeading(role: ChatMessageData["role"]): string {
  return role === "user" ? "USER" : "AI ASSISTANT";
}

function rolePlainUnderline(role: ChatMessageData["role"]): string {
  return role === "user" ? "----" : "------------";
}

/** Markdown export preserving structure where possible. */
export function formatChatAsMarkdown(conversation: Conversation): string {
  const meta = getChatExportMeta(conversation);
  const messages = getExportMessages(conversation);
  const lines: string[] = [
    "# TerraDairy AI Assistant",
    "",
    `**Conversation:** ${formatConversationDate(meta.conversationDate)}`,
    "",
    "---",
    "",
  ];

  for (const message of messages) {
    lines.push(roleMarkdownHeading(message.role));
    lines.push("");
    lines.push(message.role === "user" ? message.content : expandUiBlocks(message.content));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push(
    "### Conversation Information",
    `- Generated: ${formatConversationDate(new Date())}`,
    `- Number of messages: ${meta.messageCount}`,
  );

  return lines.join("\n").trim() + "\n";
}

/** Plain-text export with professional document structure. */
export function formatChatAsPlainText(conversation: Conversation): string {
  const meta = getChatExportMeta(conversation);
  const messages = getExportMessages(conversation);
  const lines: string[] = [
    "TERRADAIRY AI ASSISTANT",
    "Farm Intelligence & Advisory Chat",
    "",
    `Conversation: ${formatConversationDate(meta.conversationDate)}`,
    "",
    "----------------------------------------",
    "",
  ];

  for (const message of messages) {
    lines.push(rolePlainHeading(message.role));
    lines.push(rolePlainUnderline(message.role));
    lines.push(
      message.role === "user" ? message.content : markdownToPlainText(message.content),
    );
    lines.push("");
    lines.push("----------------------------------------");
    lines.push("");
  }

  lines.push(
    "Conversation Information",
    `- Generated: ${formatConversationDate(new Date())}`,
    `- Number of messages: ${meta.messageCount}`,
  );

  return lines.join("\n").trim() + "\n";
}

/** Compact plain text for Web Share API `text` field. */
export function formatChatForWebShare(conversation: Conversation): string {
  const meta = getChatExportMeta(conversation);
  const messages = getExportMessages(conversation);
  const lines: string[] = [
    "TerraDairy AI Assistant",
    `Conversation — ${formatConversationDate(meta.conversationDate)}`,
    "",
  ];

  for (const message of messages) {
    lines.push(`${roleHeading(message.role)}:`);
    lines.push(
      message.role === "user" ? message.content : markdownToPlainText(message.content),
    );
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function isWebShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareChatConversation(
  conversation: Conversation,
  pdfBlob?: Blob,
): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!isWebShareSupported()) return "unsupported";

  const meta = getChatExportMeta(conversation);
  const text = formatChatForWebShare(conversation);
  const pdfFilename = sanitizeChatFilename(meta.title, meta.conversationDate, "pdf");

  try {
    if (pdfBlob && typeof navigator.canShare === "function") {
      const file = new File([pdfBlob], pdfFilename, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "TerraDairy AI Assistant",
          text,
          files: [file],
        });
        return "shared";
      }
    }

    await navigator.share({
      title: "TerraDairy AI Assistant",
      text,
    });
    return "shared";
  } catch (error) {
    if (
      (error instanceof DOMException || error instanceof Error) &&
      (error as Error).name === "AbortError"
    ) {
      return "cancelled";
    }
    throw error;
  }
}
