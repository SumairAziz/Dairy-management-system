import * as XLSX from "xlsx";
import type { ExportColumnDef, ExportMeta } from "./types";
import {
  applyDataSheetFormatting,
  buildDataSheet,
  buildInfoSheet,
} from "./formatting";

export function buildWorkbookBuffer(
  sheetName: string,
  columns: ExportColumnDef[],
  rows: Record<string, unknown>[],
  meta: ExportMeta,
): ArrayBuffer {
  const dataSheet = buildDataSheet(columns, rows);
  applyDataSheetFormatting(dataSheet, columns, rows);

  const infoSheet = buildInfoSheet(meta);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, sheetName.slice(0, 31));
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Export Information");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function downloadWorkbook(
  buffer: ArrayBuffer,
  filename: string,
): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportFilename(prefix: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `${prefix}_${stamp}.xlsx`;
}
