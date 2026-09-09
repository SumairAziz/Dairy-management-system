export const MILK_TREND_PERIOD_IDS = [
  "10d",
  "14d",
  "30d",
  "2m",
  "3m",
  "6m",
  "1y",
  "5y",
  "10y",
  "lifetime",
] as const;

export type MilkTrendPeriodId = (typeof MILK_TREND_PERIOD_IDS)[number];

export type MilkTrendGranularity = "day" | "week" | "month" | "year";

export const MILK_TREND_PERIOD_OPTIONS: Array<{ id: MilkTrendPeriodId; label: string }> = [
  { id: "10d", label: "Last 10 Days" },
  { id: "14d", label: "Last 14 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "2m", label: "Last 2 Months" },
  { id: "3m", label: "Last 3 Months" },
  { id: "6m", label: "Last 6 Months" },
  { id: "1y", label: "Last 1 Year" },
  { id: "5y", label: "Last 5 Years" },
  { id: "10y", label: "Last 10 Years" },
  { id: "lifetime", label: "Complete Lifetime" },
];

export const DEFAULT_MILK_TREND_PERIOD: MilkTrendPeriodId = "14d";

export function isMilkTrendPeriodId(value: string): value is MilkTrendPeriodId {
  return (MILK_TREND_PERIOD_IDS as readonly string[]).includes(value);
}

type PeriodConfig = {
  label: string;
  granularity: MilkTrendGranularity;
  /** Inclusive day count ending today (used for daily ranges). */
  days?: number;
  /** Week buckets (used when granularity is week). */
  weeks?: number;
  /** Month buckets (used when granularity is month). */
  months?: number;
  /** Year buckets (used when granularity is year). */
  years?: number;
  lifetime?: boolean;
};

export function resolveLifetimeGranularity(spanDays: number): MilkTrendGranularity {
  if (spanDays > 365 * 10) return "year";
  if (spanDays > 90) return "month";
  if (spanDays > 30) return "week";
  return "day";
}

export function getMilkTrendPeriodConfig(period: MilkTrendPeriodId): PeriodConfig {
  switch (period) {
    case "10d":
      return { label: "Last 10 Days", granularity: "day", days: 10 };
    case "14d":
      return { label: "Last 14 Days", granularity: "day", days: 14 };
    case "30d":
      return { label: "Last 30 Days", granularity: "day", days: 30 };
    case "2m":
      return { label: "Last 2 Months", granularity: "day", days: 60 };
    case "3m":
      return { label: "Last 3 Months", granularity: "day", days: 90 };
    case "6m":
      return { label: "Last 6 Months", granularity: "week", weeks: 26 };
    case "1y":
      return { label: "Last 1 Year", granularity: "month", months: 12 };
    case "5y":
      return { label: "Last 5 Years", granularity: "month", months: 60 };
    case "10y":
      return { label: "Last 10 Years", granularity: "year", years: 10 };
    case "lifetime":
      return { label: "Complete Lifetime", granularity: "month", lifetime: true };
  }
}

export type MilkTrendPoint = {
  label: string;
  value: number;
  date: string;
  date_from: string;
  date_to: string;
};

export type MilkTrendResponse = {
  period: MilkTrendPeriodId;
  periodLabel: string;
  granularity: MilkTrendGranularity;
  totalLiters: number;
  points: MilkTrendPoint[];
};

function toIsoDate(input: string | Date): string {
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return String(input).slice(0, 10);
}

export function formatMilkTrendLabel(bucket: string | Date, granularity: MilkTrendGranularity): string {
  const date = bucket instanceof Date ? bucket : new Date(toIsoDate(bucket));
  if (granularity === "day") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "week") {
    return `Wk ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (granularity === "year") {
    return String(date.getFullYear());
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function getMilkTrendBucketRange(
  bucket: string,
  granularity: MilkTrendGranularity,
): { date_from: string; date_to: string } {
  const start = new Date(toIsoDate(bucket));
  if (granularity === "day") {
    const iso = toIsoDate(start);
    return { date_from: iso, date_to: iso };
  }
  if (granularity === "week") {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { date_from: toIsoDate(start), date_to: toIsoDate(end) };
  }
  if (granularity === "year") {
    const yearStart = new Date(start.getFullYear(), 0, 1);
    const yearEnd = new Date(start.getFullYear(), 11, 31);
    return { date_from: toIsoDate(yearStart), date_to: toIsoDate(yearEnd) };
  }
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { date_from: toIsoDate(monthStart), date_to: toIsoDate(monthEnd) };
}

export function mapMilkTrendRows(
  rows: Array<{ bucket: string | Date; value: number }>,
  granularity: MilkTrendGranularity,
): MilkTrendPoint[] {
  return rows.map((row) => {
    const date = toIsoDate(row.bucket);
    const range = getMilkTrendBucketRange(date, granularity);
    return {
      label: formatMilkTrendLabel(row.bucket, granularity),
      value: Number(row.value ?? 0),
      date,
      ...range,
    };
  });
}
