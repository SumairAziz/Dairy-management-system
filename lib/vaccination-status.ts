/**
 * Dynamic vaccination status utilities.
 *
 * All vaccination statuses in the UI are derived at runtime from each
 * record's `next_due_date` (and `vaccination_date`) compared to the current
 * date. Nothing is read from or written to a stored `status` field, so the
 * status stays correct automatically as time passes or as new records are
 * added — no cron jobs, no manual updates.
 */

/** Status of a single vaccination record. */
export type VaccinationRecordStatus =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "upcoming"
  | "completed";

/** Aggregate vaccination status of an animal (across all its records). */
export type AnimalVaccinationStatus =
  | "never_vaccinated"
  | "vaccinated"
  | "due_for_vaccination"
  | "overdue";

/** Number of days used as the "due soon" lookahead window. */
export const DUE_SOON_WINDOW_DAYS = 7;

/**
 * Returns today's date as a `YYYY-MM-DD` string in the local timezone.
 * Using the local date avoids off-by-one errors when comparing due dates
 * that were stored without a timezone.
 */
export function todayDateString(now: Date = new Date()): string {
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

/** Add (or subtract) days from a `YYYY-MM-DD` string, returning `YYYY-MM-DD`. */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

/** Normalise a possibly-null ISO date/time to a `YYYY-MM-DD` string (or null). */
export function normaliseDate(val: string | null | undefined): string | null {
  if (!val) return null;
  const sliced = val.slice(0, 10);
  return sliced || null;
}

/** Minimal shape required to compute a record's status. */
export interface VaccinationRecordLike {
  next_due_date?: string | null;
  vaccination_date?: string | null;
}

/**
 * Determine the status of a single vaccination record by comparing its
 * `next_due_date` to `today`.
 *
 *  - `completed`  — no `next_due_date` (single-dose / no booster needed).
 *  - `overdue`     — `next_due_date` is in the past.
 *  - `due_today`   — `next_due_date` equals today.
 *  - `due_soon`    — `next_due_date` is within the next 7 days.
 *  - `upcoming`    — `next_due_date` is more than 7 days away.
 */
export function getVaccinationRecordStatus(
  record: VaccinationRecordLike,
  today: string = todayDateString(),
): VaccinationRecordStatus {
  const due = normaliseDate(record.next_due_date);

  if (!due) return "completed";

  if (due < today) return "overdue";
  if (due === today) return "due_today";

  const soonLimit = addDaysToDate(today, DUE_SOON_WINDOW_DAYS);
  if (due <= soonLimit) return "due_soon";

  return "upcoming";
}

/**
 * Determine an animal's aggregate vaccination status from its full list of
 * vaccination records, using the LATEST record's `next_due_date`.
 *
 *  - `never_vaccinated`   — no records exist.
 *  - `overdue`            — latest record's `next_due_date` is in the past.
 *  - `due_for_vaccination`— latest `next_due_date` is today or within 7 days.
 *  - `vaccinated`         — latest `next_due_date` is >7 days away, or the
 *                           latest record has no `next_due_date` (completed).
 */
export function getAnimalVaccinationStatus(
  records: readonly VaccinationRecordLike[] | null | undefined,
  today: string = todayDateString(),
): AnimalVaccinationStatus {
  if (!records || records.length === 0) return "never_vaccinated";

  // Pick the latest record: prefer the most recent `vaccination_date`,
  // falling back to `next_due_date` when vaccination_date is absent.
  const sorted = [...records].sort((a, b) => {
    const aKey =
      normaliseDate(a.vaccination_date) ?? normaliseDate(a.next_due_date) ?? "";
    const bKey =
      normaliseDate(b.vaccination_date) ?? normaliseDate(b.next_due_date) ?? "";
    return bKey.localeCompare(aKey);
  });

  const latest = sorted[0];
  const due = normaliseDate(latest.next_due_date);

  if (!due) return "vaccinated"; // completed one-time vaccine → protected
  if (due < today) return "overdue";

  const soonLimit = addDaysToDate(today, DUE_SOON_WINDOW_DAYS);
  if (due <= soonLimit) return "due_for_vaccination";

  return "vaccinated";
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

export interface StatusStyle {
  label: string;
  /** Tailwind classes for a pill/badge. */
  badgeClass: string;
  /** Hex colour for inline elements (dots, etc.). */
  dotColor: string;
}

const RECORD_STATUS_STYLES: Record<VaccinationRecordStatus, StatusStyle> = {
  overdue: {
    label: "Overdue",
    badgeClass: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    dotColor: "#f43f5e",
  },
  due_today: {
    label: "Due Today",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dotColor: "#f59e0b",
  },
  due_soon: {
    label: "Due in 7 Days",
    badgeClass: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    dotColor: "#eab308",
  },
  upcoming: {
    label: "Upcoming",
    badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    dotColor: "#0ea5e9",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dotColor: "#10b981",
  },
};

const ANIMAL_STATUS_STYLES: Record<AnimalVaccinationStatus, StatusStyle> = {
  never_vaccinated: {
    label: "Never Vaccinated",
    badgeClass: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
    dotColor: "#64748b",
  },
  vaccinated: {
    label: "Vaccinated",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dotColor: "#10b981",
  },
  due_for_vaccination: {
    label: "Due for Vaccination",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dotColor: "#f59e0b",
  },
  overdue: {
    label: "Overdue",
    badgeClass: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    dotColor: "#f43f5e",
  },
};

export function recordStatusStyle(
  status: VaccinationRecordStatus,
): StatusStyle {
  return RECORD_STATUS_STYLES[status];
}

export function animalStatusStyle(
  status: AnimalVaccinationStatus,
): StatusStyle {
  return ANIMAL_STATUS_STYLES[status];
}
