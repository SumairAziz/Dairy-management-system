"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { ExportResource } from "@/lib/export/types";
import {
  buildWorkbookBuffer,
  downloadWorkbook,
  exportFilename,
} from "@/lib/export/workbook";
import { useExportToast } from "./ExportToastProvider";

export type UniversalExportButtonProps = {
  resource: ExportResource;
  /** Current page filter/search state (URL-synced or local). */
  filters?: Record<string, string>;
  /** Optional extra query params (e.g. sortBy, sortDir). */
  extraParams?: Record<string, string>;
  className?: string;
  label?: string;
};

function buildQueryString(
  filters: Record<string, string>,
  extraParams: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extraParams })) {
    if (value && value !== "all") params.set(key, value);
  }
  return params.toString();
}

export function UniversalExportButton({
  resource,
  filters = {},
  extraParams = {},
  className = "",
  label = "Export Excel",
}: UniversalExportButtonProps) {
  const { showToast } = useExportToast();
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    showToast("Preparing export…", "info");

    try {
      const qs = buildQueryString(filters, extraParams);
      const res = await fetch(`/api/export/${resource}${qs ? `?${qs}` : ""}`);

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (body?.code === "EMPTY_EXPORT") {
          showToast("No records match the current filters.", "error");
          return;
        }
        throw new Error(body?.error ?? "Export failed");
      }

      const payload = (await res.json()) as {
        rows: Record<string, unknown>[];
        columns: { header: string; key: string }[];
        meta: {
          reportTitle: string;
          generatedAt: string;
          filtersApplied: { label: string; value: string }[];
          totalRecords: number;
        };
        filenamePrefix: string;
        sheetName: string;
      };

      const buffer = buildWorkbookBuffer(
        payload.sheetName,
        payload.columns,
        payload.rows,
        payload.meta,
      );
      downloadWorkbook(buffer, exportFilename(payload.filenamePrefix));
      showToast("Excel file downloaded.", "success");
    } catch (err) {
      console.error("[export]", err);
      showToast("Unable to export records. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm font-medium transition-colors hover:bg-white/5 disabled:opacity-60 ${className}`}
    >
      <FileSpreadsheet size={14} className="text-emerald-400" />
      {busy ? "Exporting…" : label}
    </button>
  );
}
