import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { HeatCycleQueryParams } from "@/validators";
import type { CreateHeatCycleInput, UpdateHeatCycleInput } from "@/validators/heat-cycle.validator";
import { NotFoundError } from "@/lib/errors";
import { isActivePregnancy } from "@/lib/pregnancy-status";
import {
  computeCycleLengths,
  getHeatCycleStatus,
  matchesHeatStatusFilter,
  type MinimalHeatCycleRecord,
} from "@/lib/heat-cycle-status";

/**
 * Resolves the `status` drill-down filter (in_heat/due_today/due_this_week/
 * upcoming/overdue) to the set of heat_cycle_ids representing each matching
 * animal's *current* record — mirrors the same computation the dashboard
 * page uses (lib/heat-cycle-status.ts), just run over the whole herd instead
 * of an already-fetched page.
 */
async function resolveStatusHeatCycleIds(
  status: NonNullable<HeatCycleQueryParams["status"]>,
): Promise<number[]> {
  const [allRecords, activePregRecords] = await Promise.all([
    prisma.heat_cycle_records.findMany({
      select: { heat_cycle_id: true, animal_id: true, heat_start_date: true, heat_end_date: true },
    }),
    prisma.pregnancy_records.findMany({ select: { animal_id: true, status: true } }),
  ]);

  const activePregs = new Set<number>();
  for (const p of activePregRecords) {
    if (isActivePregnancy(p)) activePregs.add(p.animal_id);
  }

  const minimalRecords: MinimalHeatCycleRecord[] = allRecords.map((r) => ({
    animal_id: r.animal_id,
    heat_start_date: r.heat_start_date ? r.heat_start_date.toISOString() : null,
    heat_end_date: r.heat_end_date ? r.heat_end_date.toISOString() : null,
  }));
  const computation = computeCycleLengths(minimalRecords);

  const matchingIds: number[] = [];
  for (const record of allRecords) {
    const latest = record.animal_id ? computation.latestByAnimal.get(record.animal_id) : undefined;
    // Only the animal's current (latest) record can carry a live status.
    if (!latest || latest.heat_start_date !== (record.heat_start_date ? record.heat_start_date.toISOString() : null)) {
      continue;
    }
    const minimal: MinimalHeatCycleRecord = {
      animal_id: record.animal_id,
      heat_start_date: record.heat_start_date ? record.heat_start_date.toISOString() : null,
      heat_end_date: record.heat_end_date ? record.heat_end_date.toISOString() : null,
    };
    const result = getHeatCycleStatus(minimal, computation, activePregs);
    if (matchesHeatStatusFilter(result, status)) matchingIds.push(record.heat_cycle_id);
  }
  return matchingIds;
}

export async function findAll(params: HeatCycleQueryParams) {
  const { page, pageSize, status, ...filters } = params;
  const where: Prisma.heat_cycle_recordsWhereInput = {};

  if (filters.animal_id) where.animal_id = filters.animal_id;
  if (filters.detection_method) where.detection_method = filters.detection_method;
  if (filters.date_from || filters.date_to) {
    where.heat_start_date = {};
    if (filters.date_from) where.heat_start_date.gte = new Date(filters.date_from);
    if (filters.date_to) where.heat_start_date.lte = new Date(filters.date_to);
  }
  if (status) {
    where.heat_cycle_id = { in: await resolveStatusHeatCycleIds(status) };
  }

  const [data, total] = await Promise.all([
    prisma.heat_cycle_records.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { heat_start_date: "desc" },
      include: { animals: { select: { animal_id: true, tag_number: true, animal_name: true } } },
    }),
    prisma.heat_cycle_records.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const record = await prisma.heat_cycle_records.findUnique({
    where: { heat_cycle_id: id },
    include: { animals: true },
  });
  if (!record) throw new NotFoundError("Heat cycle record");
  return serialize(record);
}

export async function create(data: CreateHeatCycleInput) {
  const prismaData = {
    ...data,
    heat_start_date: data.heat_start_date ? new Date(data.heat_start_date) : null,
    heat_end_date: data.heat_end_date ? new Date(data.heat_end_date) : null,
  };
  const created = await prisma.heat_cycle_records.create({ data: prismaData });
  return serialize(created);
}

export async function update(id: number, data: UpdateHeatCycleInput) {
  await findById(id); // ensure exists
  const prismaData = {
    ...data,
    heat_start_date: data.heat_start_date ? new Date(data.heat_start_date) : null,
    heat_end_date: data.heat_end_date ? new Date(data.heat_end_date) : null,
  };
  const updated = await prisma.heat_cycle_records.update({
    where: { heat_cycle_id: id },
    data: prismaData,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.heat_cycle_records.delete({ where: { heat_cycle_id: id } });
}

/**
 * Aggregated heat cycle statistics for the dashboard section.
 * Reuses the same computation as resolveStatusHeatCycleIds but returns
 * counts instead of ID lists, so the frontend doesn't need to download
 * all records + all pregnancies + all animals.
 */
export async function getStats() {
  const [allRecords, activePregRecords, methodGroups] = await Promise.all([
    prisma.heat_cycle_records.findMany({
      select: { heat_cycle_id: true, animal_id: true, heat_start_date: true, heat_end_date: true },
    }),
    prisma.pregnancy_records.findMany({ select: { animal_id: true, status: true } }),
    prisma.heat_cycle_records.groupBy({
      by: ["detection_method"],
      _count: true,
    }),
  ]);

  const activePregs = new Set<number>();
  for (const p of activePregRecords) {
    if (isActivePregnancy(p)) activePregs.add(p.animal_id);
  }

  const minimalRecords: MinimalHeatCycleRecord[] = allRecords.map((r) => ({
    animal_id: r.animal_id,
    heat_start_date: r.heat_start_date ? r.heat_start_date.toISOString() : null,
    heat_end_date: r.heat_end_date ? r.heat_end_date.toISOString() : null,
  }));
  const computation = computeCycleLengths(minimalRecords);

  let inHeatCount = 0;
  let expectedToday = 0;
  let expectedThisWeek = 0;
  let overdueCount = 0;

  for (const [animalId, latest] of computation.latestByAnimal) {
    if (activePregs.has(animalId)) continue;
    if (!latest.heat_start_date) continue;

    const minimal: MinimalHeatCycleRecord = {
      animal_id: animalId,
      heat_start_date: latest.heat_start_date,
      heat_end_date: latest.heat_end_date ?? null,
    };
    const result = getHeatCycleStatus(minimal, computation, activePregs);

    switch (result.status) {
      case "In Heat":       inHeatCount++; break;
      case "Due Today":     expectedToday++; expectedThisWeek++; break;
      case "Upcoming":
        if (result.daysUntil != null && result.daysUntil <= 7) expectedThisWeek++;
        break;
      case "Overdue":       overdueCount++; break;
    }
  }

  const methodBreakdown = (
    methodGroups as Array<{ detection_method: string | null; _count: number }>
  )
    .sort((a, b) => b._count - a._count)
    .map((g) => ({ method: g.detection_method || "Unknown", count: g._count }));

  return {
    inHeatCount,
    expectedToday,
    expectedThisWeek,
    overdueCount,
    methodBreakdown,
  };
}
