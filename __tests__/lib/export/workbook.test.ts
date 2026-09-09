import { describe, expect, it } from "vitest";
import { buildWorkbookBuffer } from "@/lib/export/workbook";
import {
  applyDataSheetFormatting,
  buildDataSheet,
  coerceExportCell,
  computeColumnWidths,
  shouldWrapColumn,
} from "@/lib/export/formatting";
import * as XLSX from "xlsx";

describe("buildWorkbookBuffer", () => {
  it("creates a valid xlsx with data and info sheets", () => {
    const buffer = buildWorkbookBuffer(
      "Animals",
      [
        { key: "tag_number", header: "Tag Number", format: "id" },
        { key: "gender", header: "Gender" },
      ],
      [{ tag_number: "COW-1", gender: "F" }],
      {
        reportTitle: "Animals",
        generatedAt: "2026-08-24T10:00:00.000Z",
        filtersApplied: [{ label: "Gender", value: "F" }],
        totalRecords: 1,
      },
    );

    const workbook = XLSX.read(buffer, { type: "array" });
    expect(workbook.SheetNames).toContain("Animals");
    expect(workbook.SheetNames).toContain("Export Information");

    const sheet = workbook.Sheets["Animals"];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
    });
    expect(rows[0]).toEqual(["Tag Number", "Gender"]);
    expect(rows[1]).toEqual(["COW-1", "F"]);
  });

  it("applies column widths, autofilter, and frozen header row", () => {
    const columns = [
      { key: "vaccination_date", header: "Vaccination Date", format: "date" as const },
      { key: "notes", header: "Notes", wrap: true },
    ];
    const rows = [
      {
        vaccination_date: "2026-03-15",
        notes:
          "Long treatment note that should not overlap neighboring cells when exported to Excel.",
      },
    ];

    const sheet = buildDataSheet(columns, rows);
    applyDataSheetFormatting(sheet, columns, rows);

    expect(sheet["!cols"]).toBeDefined();
    expect(sheet["!cols"]?.[1]?.wch).toBeGreaterThanOrEqual(18);
    expect(sheet["!autofilter"]?.ref).toBe("A1:B2");
    expect(sheet["!views"]?.[0]).toMatchObject({
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
    });
  });

  it("stores numeric and date cells with proper Excel types", () => {
    const columns = [
      { key: "production_date", header: "Production Date", format: "date" as const },
      { key: "milk_liters", header: "Milk Liters (L)", format: "quantity" as const },
    ];
    const rows = [{ production_date: "2026-02-10", milk_liters: 12.5 }];
    const sheet = buildDataSheet(columns, rows);

    expect(sheet.A2?.t).toBe("n");
    expect(sheet.A2?.z).toBe("dd/mm/yyyy");
    expect(sheet.B2?.t).toBe("n");
    expect(sheet.B2?.v).toBe(12.5);
    expect(sheet.B2?.z).toBe("#,##0.00");
  });
});

describe("export formatting helpers", () => {
  it("detects wrap columns for notes and descriptions", () => {
    expect(shouldWrapColumn("notes", "Notes")).toBe(true);
    expect(shouldWrapColumn("item_name", "Item Name")).toBe(false);
  });

  it("preserves tag numbers as text", () => {
    const cell = coerceExportCell("COW-001", {
      key: "tag_number",
      header: "Tag Number",
      format: "id",
    });
    expect(cell).toEqual({ t: "s", v: "COW-001" });
  });

  it("assigns wider columns to wrapped text", () => {
    const widths = computeColumnWidths(
      [{ key: "notes", header: "Notes", wrap: true }],
      [
        {
          notes:
            "Administered after morning milking with extended observation notes for the herd.",
        },
      ],
    );
    expect(widths[0]?.wch).toBeGreaterThanOrEqual(18);
    expect(widths[0]?.wch).toBeLessThanOrEqual(48);
  });
});
