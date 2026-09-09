export type ExportResource =
  | "animals"
  | "milk"
  | "breeding"
  | "pregnancy"
  | "vaccinations"
  | "heat-cycles";

export type ExportColumnFormat =
  | "text"
  | "id"
  | "integer"
  | "decimal"
  | "quantity"
  | "currency"
  | "date"
  | "datetime"
  | "percent";

export type ExportColumnDef = {
  header: string;
  key: string;
  format?: ExportColumnFormat;
  /** Wrap long text and expand row height (column width capped for readability). */
  wrap?: boolean;
  /** Explicit column width in characters. */
  width?: number;
};

export type ExportFilterMeta = {
  label: string;
  value: string;
};

export type ExportMeta = {
  reportTitle: string;
  generatedAt: string;
  filtersApplied: ExportFilterMeta[];
  totalRecords: number;
};

export type ExportApiResponse = {
  rows: Record<string, unknown>[];
  columns: ExportColumnDef[];
  meta: ExportMeta;
};

export const EXPORT_PAGE_SIZE = 50_000;
