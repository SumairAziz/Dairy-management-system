import * as XLSX from "xlsx";
import type { ExportColumnDef, ExportColumnFormat, ExportMeta } from "./types";

const WRAP_KEY_PATTERN =
  /notes|description|address|comment|details|treatment|remarks|administered|vaccine_name|reason/i;

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function inferColumnFormat(key: string, header: string): ExportColumnFormat {
  const label = `${key} ${header}`.toLowerCase();

  if (/(^id$|_id$|tag_number|tag #)/i.test(key) || /tag number/i.test(header)) {
    return "id";
  }
  if (/datetime|generated|timestamp|_at$/i.test(label) && /time|datetime|generated|timestamp/i.test(label)) {
    return "datetime";
  }
  if (/date|_date|due_date|delivery|birth|insemination|vaccination|production|heat_/i.test(label)) {
    return "date";
  }
  if (/percent|confidence/i.test(label)) {
    return "percent";
  }
  if (/cost|value|price|amount|total_value|unit_cost/i.test(label)) {
    return "currency";
  }
  if (/liters|quantity|dosage|milk|reorder|stock/i.test(label)) {
    return "quantity";
  }
  if (/count|score|level/i.test(label) && !/status/i.test(label)) {
    return "decimal";
  }
  if (/animal_id|item_id|batch_id|record_id/i.test(key)) {
    return "integer";
  }
  return "text";
}

export function shouldWrapColumn(key: string, header: string): boolean {
  return WRAP_KEY_PATTERN.test(key) || WRAP_KEY_PATTERN.test(header);
}

export function resolveColumnFormat(column: ExportColumnDef): ExportColumnFormat {
  return column.format ?? inferColumnFormat(column.key, column.header);
}

export function resolveColumnWrap(column: ExportColumnDef): boolean {
  return column.wrap ?? shouldWrapColumn(column.key, column.header);
}

function excelSerial(date: Date): number {
  return (date.getTime() - EXCEL_EPOCH) / 86_400_000;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const iso = value.length <= 10 ? `${value}T00:00:00.000Z` : value;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function coerceExportCell(
  value: unknown,
  column: ExportColumnDef,
): XLSX.CellObject | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "boolean") {
    return { t: "s", v: value ? "Yes" : "No" };
  }

  const format = resolveColumnFormat(column);

  switch (format) {
    case "id":
      return { t: "s", v: String(value) };
    case "integer": {
      const num = parseNumberValue(value);
      return num === null ? { t: "s", v: String(value) } : { t: "n", v: Math.trunc(num), z: "0" };
    }
    case "decimal":
    case "quantity": {
      const num = parseNumberValue(value);
      return num === null ? { t: "s", v: String(value) } : { t: "n", v: num, z: "#,##0.00" };
    }
    case "currency": {
      const num = parseNumberValue(value);
      return num === null
        ? { t: "s", v: String(value) }
        : { t: "n", v: num, z: '"Rs "#,##0.00' };
    }
    case "percent": {
      const num = parseNumberValue(value);
      if (num === null) return { t: "s", v: String(value) };
      const normalized = num > 1 ? num / 100 : num;
      return { t: "n", v: normalized, z: "0.00%" };
    }
    case "date": {
      const date = parseDateValue(value);
      return date
        ? { t: "n", v: excelSerial(date), z: "dd/mm/yyyy" }
        : { t: "s", v: String(value) };
    }
    case "datetime": {
      const date = parseDateValue(value);
      return date
        ? { t: "n", v: excelSerial(date), z: "dd/mm/yyyy hh:mm" }
        : { t: "s", v: String(value) };
    }
    default:
      return { t: "s", v: String(value) };
  }
}

function cellDisplayLength(value: unknown, column: ExportColumnDef): number {
  if (value === null || value === undefined || value === "") return 0;
  const format = resolveColumnFormat(column);
  if (format === "date") return 10;
  if (format === "datetime") return 16;
  if (format === "currency" || format === "quantity" || format === "decimal") return 12;
  return String(value).length;
}

export function computeColumnWidths(
  columns: ExportColumnDef[],
  rows: Record<string, unknown>[],
): XLSX.ColInfo[] {
  return columns.map((column) => {
    if (column.width) return { wch: column.width };

    const wrap = resolveColumnWrap(column);
    const format = resolveColumnFormat(column);
    const headerLen = column.header.length;
    const maxDataLen = rows.reduce(
      (max, row) => Math.max(max, cellDisplayLength(row[column.key], column)),
      0,
    );

    let wch = Math.max(headerLen, maxDataLen) + 2;

    if (format === "date") wch = 12;
    else if (format === "datetime") wch = 18;
    else if (format === "currency" || format === "quantity" || format === "decimal") {
      wch = Math.max(10, Math.min(wch, 16));
    } else if (format === "integer") wch = Math.max(8, Math.min(wch, 12));
    else if (format === "id") wch = Math.max(10, Math.min(wch, 18));
    else if (wrap) wch = Math.max(18, Math.min(wch, 48));
    else wch = Math.max(10, Math.min(wch, 28));

    return { wch };
  });
}

export function computeRowHeights(
  columns: ExportColumnDef[],
  rows: Record<string, unknown>[],
  columnWidths: XLSX.ColInfo[],
): XLSX.RowInfo[] {
  const heights: XLSX.RowInfo[] = [{ hpt: 22 }];

  rows.forEach((row) => {
    let maxLines = 1;

    columns.forEach((column, index) => {
      if (!resolveColumnWrap(column)) return;
      const text = String(row[column.key] ?? "");
      if (!text) return;
      const width = columnWidths[index]?.wch ?? 20;
      const lines = Math.ceil(text.length / Math.max(width - 1, 8));
      maxLines = Math.max(maxLines, lines);
    });

    heights.push({ hpt: Math.min(16 + maxLines * 14, 120) });
  });

  return heights;
}

function encodeCell(col: number, row: number): string {
  return XLSX.utils.encode_cell({ c: col, r: row });
}

export function buildDataSheet(
  columns: ExportColumnDef[],
  rows: Record<string, unknown>[],
): XLSX.WorkSheet {
  const sheet: XLSX.WorkSheet = {};

  columns.forEach((column, colIndex) => {
    sheet[encodeCell(colIndex, 0)] = { t: "s", v: column.header };
  });

  rows.forEach((row, rowIndex) => {
    columns.forEach((column, colIndex) => {
      const cell = coerceExportCell(row[column.key], column);
      if (cell) sheet[encodeCell(colIndex, rowIndex + 1)] = cell;
    });
  });

  sheet["!ref"] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: Math.max(columns.length - 1, 0), r: rows.length },
  });

  return sheet;
}

export function applyDataSheetFormatting(
  sheet: XLSX.WorkSheet,
  columns: ExportColumnDef[],
  rows: Record<string, unknown>[],
): void {
  const columnWidths = computeColumnWidths(columns, rows);
  sheet["!cols"] = columnWidths;
  sheet["!rows"] = computeRowHeights(columns, rows, columnWidths);

  if (rows.length > 0) {
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: columns.length - 1, r: rows.length },
      }),
    };
  }

  sheet["!views"] = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
    },
  ];

  if (columns.length >= 6) {
    sheet["!margins"] = {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    };
  }
}

function formatGeneratedTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildInfoSheet(meta: ExportMeta): XLSX.WorkSheet {
  const lines: (string | number)[][] = [
    ["TerraDairy"],
    ["Report", meta.reportTitle],
    ["Generated", formatGeneratedTimestamp(meta.generatedAt)],
    [""],
    ["Filters Applied"],
  ];

  if (meta.filtersApplied.length === 0) {
    lines.push(["(none)", ""]);
  } else {
    for (const filter of meta.filtersApplied) {
      lines.push([filter.label, filter.value]);
    }
  }

  lines.push([""], ["Total Records", meta.totalRecords]);

  const sheet = XLSX.utils.aoa_to_sheet(lines);
  sheet["!cols"] = [{ wch: 22 }, { wch: 48 }];
  return sheet;
}
