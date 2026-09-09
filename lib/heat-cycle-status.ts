/**
 * Shared heat-cycle status computation — cycle-length estimation and
 * per-animal predicted-next-heat status. Used by both the Heat Cycles
 * dashboard/table (client, `app/heat-cycles/page.tsx`) and the
 * `/heat-cycles?status=` backend drill-down filter (`services/heat-cycle.service.ts`),
 * so the prediction logic lives in exactly one place.
 */

const DEFAULT_CYCLE_DAYS = 21;
const MIN_SANE_GAP_DAYS = 10;
const MAX_SANE_GAP_DAYS = 60;

export type HeatStatus =
  | "In Heat"
  | "Due Today"
  | "Upcoming"
  | "Overdue"
  | "Pregnant"
  | "—";

/** URL-filterable buckets, matching the Heat Cycles dashboard's KPI cards. */
export type HeatStatusFilterKey =
  | "in_heat"
  | "due_today"
  | "due_this_week"
  | "upcoming"
  | "overdue";

export interface MinimalHeatCycleRecord {
  animal_id: number | null;
  heat_start_date: string | null;
  heat_end_date: string | null;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function diffDays(a: string | Date, b: string | Date): number {
  return Math.round(
    (startOfDay(new Date(a)).getTime() - startOfDay(new Date(b)).getTime()) / 86400000,
  );
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface AnimalHeatComputation<T extends MinimalHeatCycleRecord = MinimalHeatCycleRecord> {
  cycleLengthByAnimal: Map<number, number>;
  globalAvg: number;
  latestByAnimal: Map<number, T>;
}

/**
 * Estimates each animal's average heat-cycle length from the gaps between
 * consecutive `heat_start_date`s (sanity-clamped to 10-60 days), plus a
 * herd-wide fallback average for animals with fewer than two records.
 * Generic over the record type so `latestByAnimal` preserves whatever extra
 * fields the caller's records carry (e.g. the full `HeatCycleRecord` on the
 * client) instead of narrowing them down to the minimal shape.
 */
export function computeCycleLengths<T extends MinimalHeatCycleRecord>(
  records: readonly T[],
): AnimalHeatComputation<T> {
  const datesByAnimal = new Map<number, string[]>();
  for (const r of records) {
    if (!r.animal_id || !r.heat_start_date) continue;
    const arr = datesByAnimal.get(r.animal_id) ?? [];
    arr.push(r.heat_start_date);
    datesByAnimal.set(r.animal_id, arr);
  }

  const cycleLengthByAnimal = new Map<number, number>();
  let totalGapSum = 0;
  let totalGapCount = 0;
  for (const [animalId, dates] of datesByAnimal) {
    const sorted = [...dates].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const g = diffDays(sorted[i], sorted[i - 1]);
      if (g >= MIN_SANE_GAP_DAYS && g <= MAX_SANE_GAP_DAYS) gaps.push(g);
    }
    if (gaps.length > 0) {
      const avg = Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
      cycleLengthByAnimal.set(animalId, avg);
      totalGapSum += gaps.reduce((s, v) => s + v, 0);
      totalGapCount += gaps.length;
    }
  }
  const globalAvg =
    totalGapCount > 0 ? Math.round(totalGapSum / totalGapCount) : DEFAULT_CYCLE_DAYS;

  const latestByAnimal = new Map<number, T>();
  for (const r of records) {
    if (!r.animal_id || !r.heat_start_date) continue;
    const ex = latestByAnimal.get(r.animal_id);
    if (!ex || r.heat_start_date > (ex.heat_start_date ?? "")) {
      latestByAnimal.set(r.animal_id, r);
    }
  }

  return { cycleLengthByAnimal, globalAvg, latestByAnimal };
}

export interface HeatStatusResult {
  status: HeatStatus;
  cycleDay?: number;
  nextExpected?: string;
  daysUntil?: number;
  overdueDays?: number;
}

/** Resolves a single record's live status from the precomputed cycle-length map and the set of currently-pregnant animal ids. */
export function getHeatCycleStatus(
  record: MinimalHeatCycleRecord,
  computation: Pick<AnimalHeatComputation, "cycleLengthByAnimal" | "globalAvg">,
  activePregnantAnimalIds: ReadonlySet<number>,
  now: Date = new Date(),
): HeatStatusResult {
  const today = now.toISOString().slice(0, 10);
  if (!record.heat_start_date) return { status: "—" };
  if (record.animal_id && activePregnantAnimalIds.has(record.animal_id)) {
    return { status: "Pregnant" };
  }
  if (!record.heat_end_date) {
    return {
      status: "In Heat",
      cycleDay: Math.max(1, diffDays(today, record.heat_start_date) + 1),
    };
  }
  const len =
    computation.cycleLengthByAnimal.get(record.animal_id ?? 0) ?? computation.globalAvg;
  const nextExp = addDays(record.heat_start_date, len);
  const daysUntil = diffDays(nextExp, today);
  if (daysUntil < 0) {
    return { status: "Overdue", nextExpected: nextExp, overdueDays: -daysUntil };
  }
  if (daysUntil === 0) {
    return { status: "Due Today", nextExpected: nextExp, daysUntil: 0 };
  }
  return { status: "Upcoming", nextExpected: nextExp, daysUntil };
}

export interface HeatStatusStyle {
  cls: string;
  dot: string;
  text: string;
}

const STATUS_STYLES: Record<HeatStatus, HeatStatusStyle> = {
  "In Heat": { cls: "bg-orange-500/15 text-orange-400", dot: "bg-orange-400", text: "text-orange-400" },
  "Due Today": { cls: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400", text: "text-amber-400" },
  Upcoming: { cls: "bg-blue-500/15 text-blue-400", dot: "bg-blue-400", text: "text-blue-400" },
  Overdue: { cls: "bg-red-500/15 text-red-400", dot: "bg-red-400", text: "text-red-400" },
  Pregnant: { cls: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400", text: "text-emerald-400" },
  "—": { cls: "bg-slate-500/15 text-slate-400", dot: "bg-slate-400", text: "text-slate-400" },
};

/** Badge/dot/text colors for a resolved heat-cycle status — single source of truth for the Heat Cycles table. */
export function heatCycleStatusStyle(status: HeatStatus): HeatStatusStyle {
  return STATUS_STYLES[status];
}

export interface ConfidenceStyle {
  cls: string;
  dot: string;
}

/** Badge for a 0-5 cycle-prediction confidence score. */
export function confidenceBadgeStyle(score: number): ConfidenceStyle {
  if (score >= 5) return { cls: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" };
  if (score >= 3) return { cls: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" };
  return { cls: "bg-red-500/15 text-red-400", dot: "bg-red-400" };
}

/** True if a resolved status matches the given URL filter bucket (mirrors the dashboard's KPI groupings). */
export function matchesHeatStatusFilter(
  result: HeatStatusResult,
  key: HeatStatusFilterKey,
): boolean {
  switch (key) {
    case "in_heat":
      return result.status === "In Heat";
    case "overdue":
      return result.status === "Overdue";
    case "due_today":
      return result.status === "Due Today";
    case "due_this_week":
      return (
        result.status === "Due Today" ||
        (result.status === "Upcoming" && (result.daysUntil ?? Infinity) <= 7)
      );
    case "upcoming":
      return result.status === "Upcoming";
  }
}
