// Shared herd business rules — single source of truth for age/eligibility
// logic so the Animals dashboard (and anything else that needs it later)
// doesn't reimplement these thresholds inconsistently.

/** Minimum age, in months, before a female is considered breeding-eligible. */
export const MATURE_AGE_MONTHS = 15;

export function ageInMonths(dateOfBirth: string | Date, now: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
}

/** Buckets the herd's many lifecycle_stage values into the four coarse groups shown on the dashboard. */
export type StageBucket = "Calves" | "Heifers" | "Adults" | "Seniors";

const STAGE_BUCKET_MAP: Record<string, StageBucket> = {
  Calf: "Calves",
  Heifer: "Heifers",
  "Pregnant Heifer": "Heifers",
  Lactating: "Adults",
  Dry: "Adults",
  Bull: "Adults",
  "Breeding Bull": "Adults",
  Retired: "Seniors",
};

/** Returns null for stages excluded from the active-herd distribution (Sold, Deceased). */
export function stageBucket(lifecycleStage: string | null | undefined): StageBucket | null {
  if (!lifecycleStage) return null;
  return STAGE_BUCKET_MAP[lifecycleStage] ?? null;
}

/** Inverse of STAGE_BUCKET_MAP — every `lifecycle_stage` value that rolls up into a given bucket. */
export function stagesForBucket(bucket: StageBucket): string[] {
  return Object.entries(STAGE_BUCKET_MAP)
    .filter(([, b]) => b === bucket)
    .map(([stage]) => stage);
}

/** Health incident statuses that count as an active/unresolved issue for an animal. */
export const HEALTH_ISSUE_STATUSES = ["Sick", "Critical", "Injured", "Open", "In Progress"];

export interface BreedingEligibilityInput {
  gender: string;
  is_active?: boolean | null;
  date_of_birth: string | Date;
  pregnancy_status?: string | null;
  lifecycle_stage?: string | null;
}

/**
 * Breeding-eligible = active female, past minimum breeding age, not currently
 * pregnant, and not in the Dry (pre-calving rest) or retired/sold/deceased
 * stages.
 */
export function isBreedingEligible(a: BreedingEligibilityInput, now: Date = new Date()): boolean {
  if (a.gender !== "F") return false;
  if (a.is_active === false) return false;
  if (a.pregnancy_status === "PREGNANT") return false;
  if (a.lifecycle_stage && ["Dry", "Retired", "Sold", "Deceased", "Calf"].includes(a.lifecycle_stage)) return false;
  return ageInMonths(a.date_of_birth, now) >= MATURE_AGE_MONTHS;
}
