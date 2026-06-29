// All pregnancy progress/status values are computed live from the existing
// schema fields (insemination_date, pregnancy_confirmed, expected/actual
// delivery dates, status) — nothing extra is stored. Default dairy cow
// gestation length used for progress/remaining-days math.
export const GESTATION_DAYS = 283;

export interface MinimalPregnancyRecord {
  insemination_date: string;
  pregnancy_confirmed?: boolean | null;
  confirmation_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  status?: string | null;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function diffDays(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** Expected delivery date, falling back to insemination_date + 283 days
 * when the field hasn't been filled in (it's nullable in the schema). */
export function getExpectedDeliveryDate(r: MinimalPregnancyRecord): Date {
  if (r.expected_delivery_date) return new Date(r.expected_delivery_date);
  const d = new Date(r.insemination_date);
  d.setDate(d.getDate() + GESTATION_DAYS);
  return d;
}

export interface GestationProgress {
  daysPregnant: number; // days since insemination (clamped to [0, GESTATION_DAYS] for display)
  daysRemaining: number; // can go negative once overdue
  gestationPercent: number; // 0-100, clamped
  isDelivered: boolean;
  isOverdue: boolean;
  isDueSoon: boolean; // due within next 14 days, not yet overdue/delivered
}

export function getGestationProgress(
  r: MinimalPregnancyRecord,
  now: Date = new Date(),
): GestationProgress {
  const isDelivered = Boolean(r.actual_delivery_date);
  const inseminationDate = new Date(r.insemination_date);
  const expected = getExpectedDeliveryDate(r);

  const rawDaysPregnant = isDelivered
    ? diffDays(new Date(r.actual_delivery_date!), inseminationDate)
    : diffDays(now, inseminationDate);
  const daysPregnant = Math.max(0, rawDaysPregnant);

  const daysRemaining = isDelivered ? 0 : diffDays(expected, now);
  const gestationPercent = Math.min(
    100,
    Math.max(0, Math.round((daysPregnant / GESTATION_DAYS) * 100)),
  );

  const isOverdue = !isDelivered && daysRemaining < 0;
  const isDueSoon = !isDelivered && !isOverdue && daysRemaining <= 14;

  return {
    daysPregnant,
    daysRemaining,
    gestationPercent,
    isDelivered,
    isOverdue,
    isDueSoon,
  };
}

export type PregnancyStatusKey =
  | "failed"
  | "delivered"
  | "pending"
  | "overdue"
  | "due_soon"
  | "confirmed";

export interface PregnancyStatusDisplay {
  key: PregnancyStatusKey;
  label: string;
  cls: string;
  dot: string;
}

/**
 * The badge shown to the user — derived live from the record's actual data
 * rather than trusted blindly from the stored `status` column, except for
 * "Failed" which is a deliberate manual override with no date-based
 * equivalent (an aborted/failed pregnancy can't be inferred from dates).
 */
export function getPregnancyStatus(
  r: MinimalPregnancyRecord,
  now: Date = new Date(),
): PregnancyStatusDisplay {
  if (r.status === "Failed") {
    return {
      key: "failed",
      label: "Failed",
      cls: "bg-red-500/15 text-red-400",
      dot: "bg-red-400",
    };
  }
  if (r.actual_delivery_date) {
    return {
      key: "delivered",
      label: "Delivered",
      cls: "bg-emerald-500/15 text-emerald-400",
      dot: "bg-emerald-400",
    };
  }
  if (!r.pregnancy_confirmed) {
    return {
      key: "pending",
      label: "Pending",
      cls: "bg-amber-500/15 text-amber-400",
      dot: "bg-amber-400",
    };
  }
  const { isOverdue, isDueSoon } = getGestationProgress(r, now);
  if (isOverdue) {
    return {
      key: "overdue",
      label: "Overdue",
      cls: "bg-red-500/15 text-red-400",
      dot: "bg-red-400",
    };
  }
  if (isDueSoon) {
    return {
      key: "due_soon",
      label: "Due Soon",
      cls: "bg-orange-500/15 text-orange-400",
      dot: "bg-orange-400",
    };
  }
  return {
    key: "confirmed",
    label: "Confirmed",
    cls: "bg-blue-500/15 text-blue-400",
    dot: "bg-blue-400",
  };
}

export const PREGNANCY_STATUS_FILTERS: Array<{
  key: "all" | PregnancyStatusKey;
  label: string;
}> = [
  { key: "all", label: "All Statuses" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "due_soon", label: "Due Soon" },
  { key: "overdue", label: "Overdue" },
  { key: "delivered", label: "Delivered" },
  { key: "failed", label: "Failed" },
];
