import { z } from "zod";

/**
 * Runtime (zod) validators mirroring `TableBlock` / `ChartBlock` / `ReportBlock`
 * from `lib/ai/types.ts`. Used by `components/assistant/*` to safely parse
 * the JSON the model emits inside ```ui-table / ```ui-chart / ```ui-report
 * fenced code blocks — untrusted model output is `JSON.parse`d and validated
 * here before ever being rendered, and is NEVER `eval`'d or used to build
 * dynamic code. Anything invalid silently falls back to a plain code block.
 *
 * Client-safe: no server-only imports, so this can be used directly from
 * chat UI components.
 */

const cellValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const tableBlockSchema = z.object({
  title: z.string().optional(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })).min(1),
  rows: z.array(z.record(z.string(), cellValue)),
});

export const chartTypeSchema = z.enum(["line", "bar", "pie", "area", "stacked-bar"]);

export const chartBlockSchema = z.object({
  chartType: chartTypeSchema,
  title: z.string().optional(),
  xKey: z.string(),
  series: z.array(z.object({ key: z.string(), label: z.string().optional(), color: z.string().optional() })).min(1),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  yLabel: z.string().optional(),
});

export const reportBlockSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tables: z.array(tableBlockSchema).optional(),
  charts: z.array(chartBlockSchema).optional(),
  insights: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

export type ParsedTableBlock = z.infer<typeof tableBlockSchema>;
export type ParsedChartBlock = z.infer<typeof chartBlockSchema>;
export type ParsedReportBlock = z.infer<typeof reportBlockSchema>;

/** Safely parses a fenced block's raw JSON text against one of the schemas above. Returns `null` on any parse/validation failure instead of throwing. */
export function safeParseBlock<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    const json = JSON.parse(raw);
    const result = schema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
