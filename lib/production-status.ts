import type { Prisma } from "@prisma/client";

/** Single source of truth for current milk production state. */
export type ProductionStatus =
  | "lactating"
  | "dry"
  | "never_lactated"
  | "not_applicable";

export const PRODUCTION_STATUS_VALUES = [
  "lactating",
  "dry",
  "never_lactated",
  "not_applicable",
] as const;

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  lactating: "Lactating",
  dry: "Dry",
  never_lactated: "Never Lactated",
  not_applicable: "Not Applicable",
};

export interface ProductionStatusInput {
  gender: string;
  lifecycle_stage?: string | null;
  lactation_status?: string | null;
  hasCalvingHistory?: boolean;
  hasMilkHistory?: boolean;
}

export function hasPriorLactation(input: ProductionStatusInput): boolean {
  return Boolean(input.hasCalvingHistory || input.hasMilkHistory);
}

/**
 * Derive production status from explicit lactation fields plus lifecycle history.
 * Missing milk records alone must NOT imply dry.
 */
export function getProductionStatus(input: ProductionStatusInput): ProductionStatus {
  if (input.gender === "M") return "not_applicable";
  if (input.lifecycle_stage === "Bull" || input.lifecycle_stage === "Breeding Bull") {
    return "not_applicable";
  }
  if (input.lifecycle_stage === "Calf") return "never_lactated";

  const priorLactation = hasPriorLactation(input);

  if (input.lactation_status === "DRY" && priorLactation) return "dry";
  if (input.lifecycle_stage === "Dry" && priorLactation) return "dry";

  if (input.lactation_status === "LACTATING") return "lactating";
  if (input.lifecycle_stage === "Lactating" && input.lactation_status !== "DRY") {
    return priorLactation ? "lactating" : "never_lactated";
  }

  if (!priorLactation) return "never_lactated";

  // Has calving/milk history but no explicit current state — treat as lactating
  // (matches sync-animal-dates after calving).
  return "lactating";
}

/** Prisma fragment: animal has previously lactated (calving and/or milk logs). */
export function priorLactationWhere(): Prisma.animalsWhereInput {
  return {
    OR: [
      { calving_records_as_mother: { some: {} } },
      { milk_logs: { some: {} } },
    ],
  };
}

/** Prisma filter for list/report queries by production status. */
export function productionStatusWhere(
  status: ProductionStatus,
): Prisma.animalsWhereInput {
  switch (status) {
    case "lactating":
      return {
        gender: "F",
        AND: [
          priorLactationWhere(),
          {
            OR: [
              { lactation_status: "LACTATING" },
              {
                AND: [
                  { lifecycle_stage: "Lactating" },
                  { lactation_status: { not: "DRY" } },
                ],
              },
            ],
          },
          { NOT: { lifecycle_stage: "Dry" } },
          { NOT: { lactation_status: "DRY" } },
        ],
      };
    case "dry":
      return {
        gender: "F",
        AND: [
          priorLactationWhere(),
          {
            OR: [{ lactation_status: "DRY" }, { lifecycle_stage: "Dry" }],
          },
        ],
      };
    case "never_lactated":
      return {
        gender: "F",
        NOT: [priorLactationWhere(), { lactation_status: "DRY" }],
        lifecycle_stage: { not: "Dry" },
      };
    case "not_applicable":
      return {
        OR: [
          { gender: "M" },
          { lifecycle_stage: { in: ["Bull", "Breeding Bull"] } },
        ],
      };
    default:
      return {};
  }
}

/** Animals eligible for today's milk entry (explicitly lactating, not dry). */
export function milkEntryEligibleWhere(
  scope: { farmId?: number; unitId?: number } = {},
): Prisma.animalsWhereInput {
  return {
    is_active: true,
    ...productionStatusWhere("lactating"),
    ...(scope.farmId != null ? { farm_id: scope.farmId } : {}),
    ...(scope.unitId != null ? { unit_id: scope.unitId } : {}),
  };
}

/** Planned dry-off date = expected delivery date minus 60 days (pregnancy workflow). */
export function plannedDryOffDate(expectedDeliveryDate: Date | string): Date {
  const edd = new Date(expectedDeliveryDate);
  const d = new Date(edd);
  d.setUTCDate(d.getUTCDate() - 60);
  return d;
}

export function daysUntil(date: Date | string, asOf = new Date()): number {
  const target = new Date(date);
  const today = new Date(asOf.toISOString().slice(0, 10));
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function dryPeriodDurationDays(
  startDate: Date | string,
  asOf = new Date(),
): number {
  const start = new Date(startDate);
  const today = new Date(asOf.toISOString().slice(0, 10));
  return Math.max(
    0,
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}
