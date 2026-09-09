import {
  chartBlockSchema,
  reportBlockSchema,
  safeParseBlock,
  tableBlockSchema,
} from "@/lib/ai/blocks.schema";
import type { ChatMessageData } from "@/components/assistant/types";

const UI_BLOCK_PATTERN = /```(ui-table|ui-chart|ui-report)\n([\s\S]*?)```/g;

function formatTableBlock(raw: string): string {
  const parsed = safeParseBlock(tableBlockSchema, raw);
  if (!parsed) return raw.trim();

  const header = parsed.columns.map((c) => c.label).join("\t");
  const divider = parsed.columns.map((c) => "-".repeat(Math.max(c.label.length, 3))).join("\t");
  const rows = parsed.rows.map((row) =>
    parsed.columns.map((c) => String(row[c.key] ?? "")).join("\t"),
  );
  const title = parsed.title ? `${parsed.title}\n` : "";
  return `${title}${header}\n${divider}\n${rows.join("\n")}`;
}

function formatChartBlock(raw: string): string {
  const parsed = safeParseBlock(chartBlockSchema, raw);
  if (!parsed) return raw.trim();

  const headers = [parsed.xKey, ...parsed.series.map((s) => s.label ?? s.key)];
  const lines: string[] = [];
  if (parsed.title) lines.push(parsed.title);
  lines.push(`Chart type: ${parsed.chartType}`);
  if (parsed.yLabel) lines.push(`Y-axis: ${parsed.yLabel}`);
  lines.push(headers.join("\t"));
  for (const point of parsed.data) {
    lines.push(
      [String(point[parsed.xKey] ?? ""), ...parsed.series.map((s) => String(point[s.key] ?? ""))].join(
        "\t",
      ),
    );
  }
  return lines.join("\n");
}

function formatReportBlock(raw: string): string {
  const parsed = safeParseBlock(reportBlockSchema, raw);
  if (!parsed) return raw.trim();

  const sections: string[] = [parsed.title, "", parsed.summary];
  if (parsed.insights?.length) {
    sections.push("", "Insights:", ...parsed.insights.map((i) => `- ${i}`));
  }
  if (parsed.recommendations?.length) {
    sections.push("", "Recommendations:", ...parsed.recommendations.map((r) => `- ${r}`));
  }
  if (parsed.tables?.length) {
    for (const table of parsed.tables) {
      sections.push("", formatTableBlock(JSON.stringify(table)));
    }
  }
  if (parsed.charts?.length) {
    for (const chart of parsed.charts) {
      sections.push("", formatChartBlock(JSON.stringify(chart)));
    }
  }
  return sections.join("\n");
}

/** Expands TerraDairy UI fenced blocks into readable text for copy/export. */
export function expandUiBlocks(content: string): string {
  return content.replace(UI_BLOCK_PATTERN, (_match, lang: string, raw: string) => {
    if (lang === "ui-table") return `\n${formatTableBlock(raw)}\n`;
    if (lang === "ui-chart") return `\n${formatChartBlock(raw)}\n`;
    if (lang === "ui-report") return `\n${formatReportBlock(raw)}\n`;
    return raw;
  });
}

/** Lightweight markdown → plain text for clipboard/export. */
export function markdownToPlainText(content: string): string {
  let text = expandUiBlocks(content);

  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/__(.+?)__/g, "$1");
  text = text.replace(/_(.+?)_/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
    return `\n${inner.trim()}\n`;
  });
  text = text.replace(/^\s*[-*+]\s+/gm, "• ");
  text = text.replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/** Text copied to the clipboard for a chat message. */
export function getMessageCopyText(message: Pick<ChatMessageData, "role" | "content">): string {
  if (message.role === "user") return message.content;
  return markdownToPlainText(message.content);
}
