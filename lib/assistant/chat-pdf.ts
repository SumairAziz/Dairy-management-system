import type { Conversation } from "@/components/assistant/types";
import { formatChatAsPlainText, getChatExportMeta } from "./chat-export";
import { markdownToPlainText } from "./message-content";

type JsPDFInstance = import("jspdf").jsPDF;

interface PdfLayout {
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  lineHeight: number;
  bodySize: number;
}

function createLayout(doc: JsPDFInstance): PdfLayout {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  return {
    margin,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - margin * 2,
    lineHeight: 5.5,
    bodySize: 10,
  };
}

function formatPdfDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function addPageNumbers(doc: JsPDFInstance): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${page} of ${total}`, doc.internal.pageSize.getWidth() - 18, doc.internal.pageSize.getHeight() - 10, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }
}

function ensureSpace(doc: JsPDFInstance, layout: PdfLayout, y: number, needed: number): number {
  if (y + needed <= layout.pageHeight - layout.margin - 14) return y;
  doc.addPage();
  return layout.margin;
}

function drawWrappedText(
  doc: JsPDFInstance,
  layout: PdfLayout,
  text: string,
  x: number,
  y: number,
  options?: { fontSize?: number; fontStyle?: "normal" | "bold" | "italic"; color?: [number, number, number] },
): number {
  const fontSize = options?.fontSize ?? layout.bodySize;
  const fontStyle = options?.fontStyle ?? "normal";
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);
  if (options?.color) doc.setTextColor(...options.color);
  else doc.setTextColor(0, 0, 0);

  const paragraphs = text.split("\n");
  let cursorY = y;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trimEnd();
    if (!trimmed) {
      cursorY += layout.lineHeight * 0.6;
      continue;
    }

    const lines = doc.splitTextToSize(trimmed, layout.contentWidth) as string[];
    for (const line of lines) {
      cursorY = ensureSpace(doc, layout, cursorY, layout.lineHeight + 2);
      doc.text(line, x, cursorY);
      cursorY += layout.lineHeight;
    }
    cursorY += layout.lineHeight * 0.25;
  }

  return cursorY;
}

function drawCodeBlock(doc: JsPDFInstance, layout: PdfLayout, code: string, x: number, y: number): number {
  const lines = doc.splitTextToSize(code, layout.contentWidth - 8) as string[];
  const blockHeight = lines.length * (layout.lineHeight - 0.5) + 8;
  let cursorY = ensureSpace(doc, layout, y, blockHeight + 4);

  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(x, cursorY - 4, layout.contentWidth, blockHeight, 2, 2, "FD");

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  let textY = cursorY + 2;
  for (const line of lines) {
    doc.text(line, x + 4, textY);
    textY += layout.lineHeight - 0.5;
  }
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return cursorY + blockHeight + 4;
}

function renderMessageBody(doc: JsPDFInstance, layout: PdfLayout, content: string, x: number, y: number): number {
  const parts = content.split(/(```[\s\S]*?```)/g);
  let cursorY = y;

  for (const part of parts) {
    if (part.startsWith("```") && part.endsWith("```")) {
      const inner = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim();
      cursorY = drawCodeBlock(doc, layout, inner, x, cursorY);
      continue;
    }

    const plain = markdownToPlainText(part);
    if (plain.trim()) {
      cursorY = drawWrappedText(doc, layout, plain, x, cursorY);
    }
  }

  return cursorY;
}

export async function generateChatPdf(conversation: Conversation): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = buildPdfDocumentWithJsPDF(conversation, jsPDF);
  return doc.output("blob");
}

function buildPdfDocumentWithJsPDF(
  conversation: Conversation,
  jsPDF: typeof import("jspdf").jsPDF,
): JsPDFInstance {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const layout = createLayout(doc);
  const meta = getChatExportMeta(conversation);
  let y = layout.margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TerraDairy AI Assistant", layout.margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("Farm Intelligence & Advisory Chat", layout.margin, y);
  y += 7;
  doc.text(`Conversation — ${formatPdfDate(meta.conversationDate)}`, layout.margin, y);
  y += 10;
  doc.setDrawColor(210, 210, 210);
  doc.line(layout.margin, y, layout.pageWidth - layout.margin, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  for (const message of conversation.messages.filter((m) => m.content.trim())) {
    const heading = message.role === "user" ? "User" : "AI Assistant";
    y = ensureSpace(doc, layout, y, 20);
    y = drawWrappedText(doc, layout, heading, layout.margin, y, {
      fontSize: 12,
      fontStyle: "bold",
      color: message.role === "user" ? [20, 90, 160] : [20, 120, 70],
    });
    y += 2;

    const body =
      message.role === "user" ? message.content : message.content;
    y = renderMessageBody(doc, layout, body, layout.margin, y);
    y += 4;
    doc.setDrawColor(230, 230, 230);
    y = ensureSpace(doc, layout, y, 6);
    doc.line(layout.margin, y, layout.pageWidth - layout.margin, y);
    y += 8;
  }

  y = ensureSpace(doc, layout, y, 24);
  y = drawWrappedText(doc, layout, "Conversation Information", layout.margin, y, {
    fontSize: 11,
    fontStyle: "bold",
  });
  y = drawWrappedText(
    doc,
    layout,
    `Generated: ${formatPdfDate(new Date())}\nNumber of messages: ${meta.messageCount}`,
    layout.margin,
    y,
    { fontSize: 9, color: [90, 90, 90] },
  );

  addPageNumbers(doc);
  return doc;
}

export async function saveChatAsPdf(conversation: Conversation, filename: string): Promise<void> {
  const blob = await generateChatPdf(conversation);
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

/** Plain-text export used internally by PDF tests. */
export function formatChatPdfPreviewText(conversation: Conversation): string {
  return formatChatAsPlainText(conversation);
}
