import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { milkEntryEligibleWhere } from "@/lib/production-status";

/** Calendar day used for milk production (UTC date string, matches milk.service.getStats). */
export function getTodayProductionDate(asOf = new Date()): Date {
  const todayISO = asOf.toISOString().slice(0, 10);
  return new Date(todayISO);
}

/** Lifecycle stages that may contribute milk in this application. */
export const MILK_PRODUCING_LIFECYCLE = "Lactating" as const;

/** Active lactating animals eligible for milk recording (excludes dry). */
export function milkEligibleAnimalFilter(
  scope: { farmId?: number; unitId?: number } = {},
): Prisma.animalsWhereInput {
  return milkEntryEligibleWhere(scope);
}

export function dailyMilkLogWhere(
  scope: { farmId?: number; unitId?: number },
  asOf = new Date(),
): Prisma.milk_logsWhereInput {
  return {
    production_date: { equals: getTodayProductionDate(asOf) },
    animals: milkEligibleAnimalFilter(scope),
  };
}

/** Sum today's milk sessions for eligible animals in a farm or unit scope. */
export async function sumDailyMilkLiters(
  scope: { farmId?: number; unitId?: number },
  asOf = new Date(),
): Promise<number> {
  const result = await prisma.milk_logs.aggregate({
    where: dailyMilkLogWhere(scope, asOf),
    _sum: { milk_liters: true },
  });
  return Number(result._sum.milk_liters ?? 0);
}

/** Per-animal daily totals (all sessions summed) for a unit on a given day. */
export async function dailyMilkByAnimalIds(
  animalIds: number[],
  asOf = new Date(),
): Promise<Map<number, number>> {
  if (animalIds.length === 0) return new Map();

  const rows = await prisma.milk_logs.groupBy({
    by: ["animal_id"],
    where: {
      animal_id: { in: animalIds },
      production_date: { equals: getTodayProductionDate(asOf) },
      animals: milkEligibleAnimalFilter(),
    },
    _sum: { milk_liters: true },
  });

  return new Map(
    rows.map((row) => [row.animal_id, Number(row._sum.milk_liters ?? 0)]),
  );
}
