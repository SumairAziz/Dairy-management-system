import { describe, it, expect } from "vitest";
import { tableBlockSchema, chartBlockSchema, reportBlockSchema, safeParseBlock } from "@/lib/ai/blocks.schema";

describe("lib/ai/blocks.schema", () => {
  describe("tableBlockSchema", () => {
    it("accepts a well-formed table", () => {
      const raw = JSON.stringify({
        title: "Top Producers",
        columns: [{ key: "tag", label: "Tag" }],
        rows: [{ tag: "T-001" }],
      });
      expect(safeParseBlock(tableBlockSchema, raw)).not.toBeNull();
    });

    it("rejects malformed JSON without throwing", () => {
      expect(safeParseBlock(tableBlockSchema, "{ this is not json")).toBeNull();
    });

    it("rejects a table missing required columns", () => {
      expect(safeParseBlock(tableBlockSchema, JSON.stringify({ columns: [], rows: [] }))).toBeNull();
    });
  });

  describe("chartBlockSchema", () => {
    it("accepts every supported chart type", () => {
      for (const chartType of ["line", "bar", "pie", "area", "stacked-bar"]) {
        const raw = JSON.stringify({ chartType, xKey: "label", series: [{ key: "value" }], data: [{ label: "A", value: 1 }] });
        expect(safeParseBlock(chartBlockSchema, raw)).not.toBeNull();
      }
    });

    it("rejects an unsupported chart type — never silently coerces to something renderable", () => {
      const raw = JSON.stringify({ chartType: "scatter-3d", xKey: "label", series: [{ key: "value" }], data: [] });
      expect(safeParseBlock(chartBlockSchema, raw)).toBeNull();
    });
  });

  describe("reportBlockSchema", () => {
    it("accepts a full report with nested tables and charts", () => {
      const raw = JSON.stringify({
        title: "Monthly Report",
        summary: "Summary text",
        tables: [{ columns: [{ key: "a", label: "A" }], rows: [] }],
        charts: [{ chartType: "bar", xKey: "label", series: [{ key: "value" }], data: [] }],
        insights: ["insight 1"],
        recommendations: ["do X"],
      });
      expect(safeParseBlock(reportBlockSchema, raw)).not.toBeNull();
    });

    it("requires title and summary", () => {
      expect(safeParseBlock(reportBlockSchema, JSON.stringify({ summary: "x" }))).toBeNull();
      expect(safeParseBlock(reportBlockSchema, JSON.stringify({ title: "x" }))).toBeNull();
    });
  });
});
