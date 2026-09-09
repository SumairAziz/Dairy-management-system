import type { Prisma } from "@prisma/client";

// All pregnancy progress/status values are computed live from the existing
// schema fields (insemination_date, pregnancy_confirmed, expected/actual
// delivery dates, status) — nothing extra is stored. Default dairy cow
// gestation length used for progress/remaining-days math.
export const GESTATION_DAYS = 283;

// ── Status constants (single source of truth for every status check) ─────────

/** Statuses that represent an ongoing pregnancy — animal IS currently pregnant. */
export const ACTIVE_PREGNANCY_STATUSES = [
  "Pending",
  "Confirmed",
  "In Progress",
] as const;

/** Statuses that represent a concluded pregnancy — animal is NO longer pregnant. */
export const TERMINAL_PREGNANCY_STATUSES = [
  "Delivered",
  "Failed",
  "Aborted",
] as const;

// ── Predicate helpers — use these everywhere instead of inline string checks ──

/** True when the pregnancy record represents an ongoing pregnancy. */
export function isActivePregnancy(record: {
  status?: string | null;
}): boolean {
  return (ACTIVE_PREGNANCY_STATUSES as readonly string[]).includes(
    record.status ?? "",
  );
}

/** True for bare status strings — useful in Prisma `{ in: [...] }` clauses. */
export function isPregnantStatus(status: string | null | undefined): boolean {
  return (ACTIVE_PREGNANCY_STATUSES as readonly string[]).includes(status ?? "");
}

/**
 * Single source of truth for "is this animal currently pregnant" — a Prisma
 * `where` fragment for the `animals` model, expressed as a relational filter
 * against `pregnancy_records` rather than the denormalized
 * `animals.pregnancy_status` column. Use this everywhere an animal-level
 * pregnant/not-pregnant check is needed (dashboard counts, table filters,
 * breeding eligibility) so they can never drift apart the way a cached
 * column and its live source can.
 */
export function getPregnantAnimalsFilter(): Prisma.animalsWhereInput {
  return {
    pregnancy_records: {
      some: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
    },
  };
}

/** True when the pregnancy has fully resolved (Delivered, Failed, or Aborted). */
export function isCompletedPregnancy(
  status: string | null | undefined,
): boolean {
  return (TERMINAL_PREGNANCY_STATUSES as readonly string[]).includes(
    status ?? "",
  );
}

/** True only when a successful birth was recorded. */
export function isDeliveredPregnancy(
  status: string | null | undefined,
): boolean {
  return status === "Delivered";
}

/** True when the pregnancy ended without a live birth (Failed or Aborted). */
export function isFailedPregnancy(status: string | null | undefined): boolean {
  return status === "Failed" || status === "Aborted";
}

// ── Animal-level business rule helpers ───────────────────────────────────────

/**
 * Can this animal be bred?
 * Uses the denormalized pregnancy_status field on the animal for fast
 * list-level checks. For authoritative checks, query pregnancy_records.
 */
export function canBreedAnimal(animal: {
  pregnancy_status?: string | null;
}): boolean {
  return animal.pregnancy_status !== "PREGNANT";
}

/**
 * Can a new heat cycle be started for this animal?
 * Uses the denormalized pregnancy_status field.
 */
export function canStartHeatCycle(animal: {
  pregnancy_status?: string | null;
}): boolean {
  return animal.pregnancy_status !== "PREGNANT";
}

/**
 * Can calving be recorded for this pregnancy?
 * Only active (non-terminal) pregnancies can progress to calving.
 */
export function canRecordCalving(record: { status?: string | null }): boolean {
  return isActivePregnancy(record);
}

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
  // status is the source of truth — a record with status "Delivered" is done
  // even if actual_delivery_date was not recorded (e.g. manual status edit).
  const isDelivered = r.status === "Delivered";
  const inseminationDate = new Date(r.insemination_date);
  const expected = getExpectedDeliveryDate(r);

  // When delivered, use actual_delivery_date for accurate gestation length display;
  // fall back to expected date when the calving record hasn't set it yet.
  const deliveredOn = r.actual_delivery_date
    ? new Date(r.actual_delivery_date)
    : expected;

  const rawDaysPregnant = isDelivered
    ? diffDays(deliveredOn, inseminationDate)
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
  // status is the single source of truth for all terminal and active states.
  if (r.status === "Failed") {
    return {
      key: "failed",
      label: "Failed",
      cls: "bg-red-500/15 text-red-400",
      dot: "bg-red-400",
    };
  }
  if (r.status === "Delivered") {
    return {
      key: "delivered",
      label: "Delivered",
      cls: "bg-emerald-500/15 text-emerald-400",
      dot: "bg-emerald-400",
    };
  }
  // Not yet confirmed — status is "Pending", "In Progress", null, or confirmed
  // flag hasn't been set yet.
  if (r.status !== "Confirmed") {
    return {
      key: "pending",
      label: r.status ?? "Pending",
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
    cls: "bg-violet-500/15 text-violet-400",
    dot: "bg-violet-400",
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

/**
 * Server-side equivalent of `getPregnancyStatus()`'s branching, expressed as
 * a Prisma `where` fragment instead of a JS comparison over an already-fetched
 * record — same statuses, same GESTATION_DAYS/14-day-due-soon thresholds,
 * just queryable. Used by the `/pregnancy?status=` drill-down filter so large
 * lists can be filtered/paginated server-side instead of over-fetching.
 */
/** Active pregnancies with expected delivery within N days (inclusive). */
export function buildPregnancyDueWithinDaysWhere(
  days: number,
  now: Date = new Date(),
): Record<string, unknown> {
  const today = startOfDay(now);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);

  function expectedDateBoundary(op: "lt" | "gte" | "lte" | "gt", d: Date) {
    const inseminationBoundary = new Date(d);
    inseminationBoundary.setDate(inseminationBoundary.getDate() - GESTATION_DAYS);
    return {
      OR: [
        { expected_delivery_date: { [op]: d } },
        { expected_delivery_date: null, insemination_date: { [op]: inseminationBoundary } },
      ],
    };
  }

  return {
    AND: [
      { status: { notIn: [...TERMINAL_PREGNANCY_STATUSES] } },
      expectedDateBoundary("gte", today),
      expectedDateBoundary("lte", cutoff),
    ],
  };
}

export function buildPregnancyStatusWhere(
  key: PregnancyStatusKey,
  now: Date = new Date(),
): Record<string, unknown> {
  const today = startOfDay(now);
  const dueSoonCutoff = new Date(today);
  dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 14);

  // Mirrors getExpectedDeliveryDate()'s fallback: when expected_delivery_date
  // is null, the expected date is insemination_date + GESTATION_DAYS. So a
  // date boundary `d` on the expected date corresponds to boundary
  // `d - GESTATION_DAYS` on insemination_date for records with no explicit
  // expected_delivery_date.
  function expectedDateBoundary(op: "lt" | "gte" | "lte" | "gt", d: Date) {
    const inseminationBoundary = new Date(d);
    inseminationBoundary.setDate(inseminationBoundary.getDate() - GESTATION_DAYS);
    return {
      OR: [
        { expected_delivery_date: { [op]: d } },
        { expected_delivery_date: null, insemination_date: { [op]: inseminationBoundary } },
      ],
    };
  }

  switch (key) {
    case "failed":
      return { status: "Failed" };
    case "delivered":
      return { status: "Delivered" };
    case "pending":
      return { OR: [{ status: null }, { status: { notIn: ["Failed", "Delivered", "Confirmed"] } }] };
    case "overdue":
      return { AND: [{ status: "Confirmed" }, expectedDateBoundary("lt", today)] };
    case "due_soon":
      return {
        AND: [
          { status: "Confirmed" },
          expectedDateBoundary("gte", today),
          expectedDateBoundary("lte", dueSoonCutoff),
        ],
      };
    case "confirmed":
      return { AND: [{ status: "Confirmed" }, expectedDateBoundary("gt", dueSoonCutoff)] };
  }
}
