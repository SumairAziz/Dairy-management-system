import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  getProductionStatus,
  plannedDryOffDate,
  dryPeriodDurationDays,
  daysUntil,
  productionStatusWhere,
  type ProductionStatus,
} from "@/lib/production-status";
import { ACTIVE_PREGNANCY_STATUSES, isActivePregnancy } from "@/lib/pregnancy-status";
import type { ProductionStatusActionInput } from "@/validators/lactation.validator";
import type { Prisma } from "@prisma/client";

type PeriodType = "LACTATING" | "DRY";
type DbClient = Prisma.TransactionClient | typeof prisma;

function toDateOnly(value: Date | string): Date {
  const iso = new Date(value).toISOString().slice(0, 10);
  return new Date(iso);
}

async function loadAnimalContext(animalId: number) {
  const animal = await prisma.animals.findUnique({
    where: { animal_id: animalId },
    include: {
      calving_records_as_mother: { select: { calving_id: true }, take: 1 },
      milk_logs: { select: { milk_log_id: true }, take: 1 },
      pregnancy_records: {
        where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
        orderBy: { insemination_date: "desc" },
        take: 1,
      },
      lactation_periods: {
        where: { end_date: null },
        orderBy: { start_date: "desc" },
        take: 1,
      },
    },
  });
  if (!animal) throw new NotFoundError("Animal");
  return animal;
}

function productionContext(animal: Awaited<ReturnType<typeof loadAnimalContext>>) {
  const hasCalvingHistory = animal.calving_records_as_mother.length > 0;
  const hasMilkHistory = animal.milk_logs.length > 0;
  const status = getProductionStatus({
    gender: animal.gender,
    lifecycle_stage: animal.lifecycle_stage,
    lactation_status: animal.lactation_status,
    hasCalvingHistory,
    hasMilkHistory,
  });
  return { hasCalvingHistory, hasMilkHistory, status };
}

async function ensureStatusPeriodBackfill(
  animalId: number,
  animal: Awaited<ReturnType<typeof loadAnimalContext>>,
) {
  if (animal.lactation_periods.length > 0) return;

  const { status, hasCalvingHistory, hasMilkHistory } = productionContext(animal);
  if (!hasCalvingHistory && !hasMilkHistory) return;

  const startDate = toDateOnly(animal.updated_at ?? new Date());

  if (status === "dry") {
    await openPeriod(prisma, animalId, "DRY", startDate, {
      notes: "Backfilled from existing dry status",
    });
  } else if (status === "lactating") {
    await openPeriod(prisma, animalId, "LACTATING", startDate, {
      notes: "Backfilled from existing lactating status",
    });
  }
}

async function closeOpenPeriod(
  tx: DbClient,
  animalId: number,
  endDate: Date,
) {
  await tx.lactation_periods.updateMany({
    where: { animal_id: animalId, end_date: null },
    data: { end_date: endDate },
  });
}

async function openPeriod(
  tx: DbClient,
  animalId: number,
  periodType: PeriodType,
  startDate: Date,
  opts: { pregnancyId?: number | null; calvingId?: number | null; notes?: string | null } = {},
) {
  await tx.lactation_periods.create({
    data: {
      animal_id: animalId,
      period_type: periodType,
      start_date: startDate,
      pregnancy_id: opts.pregnancyId ?? null,
      calving_id: opts.calvingId ?? null,
      notes: opts.notes ?? null,
    },
  });
}

export async function getPeriodHistory(animalId: number) {
  await loadAnimalContext(animalId);
  const periods = await prisma.lactation_periods.findMany({
    where: { animal_id: animalId },
    orderBy: [{ start_date: "desc" }, { period_id: "desc" }],
    include: {
      pregnancy_records: {
        select: {
          pregnancy_id: true,
          expected_delivery_date: true,
          status: true,
        },
      },
      calving_records: {
        select: { calving_id: true, calving_date: true, outcome: true },
      },
    },
  });
  return serialize(periods);
}

export async function getProductionSummary(animalId: number) {
  const animal = await loadAnimalContext(animalId);
  await ensureStatusPeriodBackfill(animalId, animal);
  const refreshed = await loadAnimalContext(animalId);
  const { status, hasCalvingHistory, hasMilkHistory } = productionContext(refreshed);

  const openDry = refreshed.lactation_periods.find((p) => p.period_type === "DRY");
  const closedPeriods = await prisma.lactation_periods.findMany({
    where: { animal_id: animalId },
    orderBy: { start_date: "desc" },
    take: 10,
  });

  const previousLactating = closedPeriods.find((p) => p.period_type === "LACTATING");
  const activePregnancy = refreshed.pregnancy_records[0] ?? null;
  let daysUntilCalving: number | null = null;
  let dryOffDue = false;

  if (activePregnancy?.expected_delivery_date) {
    const edd = activePregnancy.expected_delivery_date;
    const dryOff = plannedDryOffDate(edd);
    plannedDryOff = dryOff.toISOString().slice(0, 10);
    daysUntilCalving = daysUntil(edd);
    dryOffDue = daysUntil(dryOff) <= 0 && status === "lactating";
  }

  const drySince =
    status === "dry"
      ? (openDry?.start_date ?? closedPeriods.find((p) => p.period_type === "DRY" && !p.end_date)?.start_date)
      : null;

  return serialize({
    production_status: status,
    has_calving_history: hasCalvingHistory,
    has_milk_history: hasMilkHistory,
    dry_since: drySince ? new Date(drySince).toISOString().slice(0, 10) : null,
    dry_period_days:
      drySince && status === "dry"
        ? dryPeriodDurationDays(drySince)
        : null,
    previous_lactation_start: previousLactating
      ? new Date(previousLactating.start_date).toISOString().slice(0, 10)
      : null,
    previous_lactation_end: previousLactating?.end_date
      ? new Date(previousLactating.end_date).toISOString().slice(0, 10)
      : null,
    expected_calving: activePregnancy?.expected_delivery_date
      ? new Date(activePregnancy.expected_delivery_date).toISOString().slice(0, 10)
      : null,
    days_until_calving: daysUntilCalving,
    planned_dry_off_date: plannedDryOff,
    dry_off_due: dryOffDue,
    is_pregnant: activePregnancy ? isActivePregnancy(activePregnancy) : false,
    can_mark_dry: status === "lactating",
    can_mark_lactating: status === "dry",
  });
}

export async function applyProductionStatusAction(
  animalId: number,
  input: ProductionStatusActionInput,
) {
  const animal = await loadAnimalContext(animalId);
  const { status, hasCalvingHistory, hasMilkHistory } = productionContext(animal);

  if (animal.gender !== "F") {
    throw new ValidationError("Production status can only be updated for female animals.");
  }

  const startDate = toDateOnly(input.start_date ?? new Date());
  const activePregnancy = animal.pregnancy_records[0] ?? null;

  if (input.action === "mark_dry") {
    if (status === "dry") {
      throw new ValidationError("Animal is already marked as dry.");
    }
    if (!hasCalvingHistory && !hasMilkHistory) {
      throw new ValidationError(
        "Only animals with prior lactation history can be marked dry.",
      );
    }
    if (status !== "lactating") {
      throw new ValidationError("Animal must be lactating before marking as dry.");
    }

    await prisma.$transaction(async (tx) => {
      await closeOpenPeriod(tx, animalId, startDate);
      await openPeriod(tx, animalId, "DRY", startDate, {
        pregnancyId: activePregnancy?.pregnancy_id ?? null,
        notes: input.notes ?? null,
      });
      await tx.animals.update({
        where: { animal_id: animalId },
        data: {
          lactation_status: "DRY",
          lifecycle_stage: "Dry",
        },
      });
    });
  } else {
    if (status !== "dry") {
      throw new ValidationError("Animal must be dry before marking as lactating.");
    }

    await prisma.$transaction(async (tx) => {
      await closeOpenPeriod(tx, animalId, startDate);
      await openPeriod(tx, animalId, "LACTATING", startDate, {
        notes: input.notes ?? null,
      });
      await tx.animals.update({
        where: { animal_id: animalId },
        data: {
          lactation_status: "LACTATING",
          lifecycle_stage: "Lactating",
        },
      });
    });
  }

  return getProductionSummary(animalId);
}

/** Called when a calving is recorded — closes dry period and opens lactation. */
export async function recordCalvingLactation(
  motherId: number,
  calvingDate: Date,
  calvingId: number,
  pregnancyId: number | null,
) {
  const startDate = toDateOnly(calvingDate);

  await prisma.$transaction(async (tx) => {
    await closeOpenPeriod(tx, motherId, startDate);
    await openPeriod(tx, motherId, "LACTATING", startDate, {
      calvingId,
      pregnancyId,
      notes: "Opened by calving record",
    });
    await tx.animals.update({
      where: { animal_id: motherId },
      data: {
        lactation_status: "LACTATING",
        lifecycle_stage: "Lactating",
      },
    });
  });
}

export async function countByProductionStatus(): Promise<Record<ProductionStatus, number>> {
  const [lactating, dry, neverLactated, notApplicable] = await Promise.all([
    prisma.animals.count({ where: productionStatusWhere("lactating") }),
    prisma.animals.count({ where: productionStatusWhere("dry") }),
    prisma.animals.count({ where: productionStatusWhere("never_lactated") }),
    prisma.animals.count({ where: productionStatusWhere("not_applicable") }),
  ]);
  return {
    lactating,
    dry,
    never_lactated: neverLactated,
    not_applicable: notApplicable,
  };
}
