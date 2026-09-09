import type { ChartBlock, ChartSeries, ChartType, ReportBlock, TableBlock } from "../types";

/** Small factories for the structured blocks the assistant emits — used by `lib/ai/reports/*` so every report builder produces the exact same shapes the chat UI (`components/assistant/*`) knows how to render. */

export function table(
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | number | boolean | null>>,
  title?: string,
): TableBlock {
  return { type: "table", title, columns, rows };
}

export function chart(
  chartType: ChartType,
  xKey: string,
  series: ChartSeries[],
  data: Array<Record<string, string | number>>,
  opts?: { title?: string; yLabel?: string },
): ChartBlock {
  return { type: "chart", chartType, xKey, series, data, title: opts?.title, yLabel: opts?.yLabel };
}

export function report(input: {
  title: string;
  summary: string;
  tables?: TableBlock[];
  charts?: ChartBlock[];
  insights?: string[];
  recommendations?: string[];
}): ReportBlock {
  return { type: "report", ...input };
}
