import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool } from "../types";
import { objectSchema, arr, int } from "./json-schema";
import { round1 } from "./common";

const getFarms: AiTool<Record<string, never>> = {
  name: "getFarms",
  category: "Farms",
  description: "List every farm with its animal count, unit count, and total milk produced to date. Use for 'list farms', 'which farms do we have', or as a first step before drilling into one farm.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    const farms = await prisma.farms.findMany({
      select: {
        farm_id: true,
        farm_name: true,
        owner_name: true,
        city: true,
        province: true,
        is_active: true,
        total_area_acres: true,
        _count: { select: { animals: true, units: true } },
      },
      orderBy: { farm_name: "asc" },
    });

    const milkTotals = await prisma.$queryRaw<Array<{ farm_id: number; liters: number }>>`
      SELECT a.farm_id, COALESCE(SUM(m.milk_liters), 0)::float AS liters
      FROM animals a
      LEFT JOIN milk_logs m ON m.animal_id = a.animal_id
      GROUP BY a.farm_id`;
    const milkByFarm = new Map(milkTotals.map((r) => [r.farm_id, r.liters]));

    return serialize(
      farms.map((f) => ({
        farm_id: f.farm_id,
        farm_name: f.farm_name,
        owner_name: f.owner_name,
        location: [f.city, f.province].filter(Boolean).join(", ") || null,
        is_active: f.is_active,
        total_area_acres: f.total_area_acres,
        animal_count: f._count.animals,
        unit_count: f._count.units,
        total_milk_liters_all_time: round1(milkByFarm.get(f.farm_id) ?? 0),
      })),
    );
  },
};

export async function buildFarmStat(farm_id: number) {
  const farm = await prisma.farms.findUnique({
    where: { farm_id },
    select: { farm_id: true, farm_name: true, owner_name: true, city: true, province: true, total_area_acres: true },
  });
  if (!farm) return null;

  const [animalCount, unitAgg, milkAgg, healthGroups, lifecycleGroups, breedGroups, pregnantCount] =
    await Promise.all([
      prisma.animals.count({ where: { farm_id, is_active: true } }),
      prisma.units.aggregate({ where: { farm_id }, _sum: { capacity: true }, _count: true }),
      prisma.$queryRaw<Array<{ liters: number }>>`
        SELECT COALESCE(SUM(m.milk_liters), 0)::float AS liters
        FROM milk_logs m JOIN animals a ON a.animal_id = m.animal_id
        WHERE a.farm_id = ${farm_id} AND m.production_date >= CURRENT_DATE - INTERVAL '30 days'`,
      prisma.health_incidents.groupBy({
        by: ["status"],
        where: { animals: { farm_id } },
        _count: true,
      }),
      prisma.animals.groupBy({
        by: ["lifecycle_stage"],
        where: { farm_id, is_active: true },
        _count: true,
      }),
      prisma.animals.groupBy({
        by: ["breed_id"],
        where: { farm_id, is_active: true },
        _count: true,
        orderBy: { _count: { breed_id: "desc" } },
        take: 5,
      }),
      prisma.animals.count({
        where: { farm_id, pregnancy_records: { some: { status: { in: ["Pending", "Confirmed", "In Progress"] } } } },
      }),
    ]);

  const breedIds = breedGroups.map((b) => b.breed_id);
  const breeds = breedIds.length
    ? await prisma.breeds.findMany({ where: { breed_id: { in: breedIds } }, select: { breed_id: true, breed_name: true } })
    : [];
  const breedNameById = new Map(breeds.map((b) => [b.breed_id, b.breed_name]));

  return {
    farm_id: farm.farm_id,
    farm_name: farm.farm_name,
    owner_name: farm.owner_name,
    location: [farm.city, farm.province].filter(Boolean).join(", ") || null,
    total_area_acres: farm.total_area_acres,
    active_animal_count: animalCount,
    unit_count: unitAgg._count,
    total_capacity: unitAgg._sum.capacity ?? 0,
    milk_last_30_days_liters: round1(milkAgg[0]?.liters ?? 0),
    currently_pregnant_count: pregnantCount,
    healthIncidentsByStatus: healthGroups.map((g) => ({ status: g.status ?? "Unknown", count: g._count })),
    lifecycleDistribution: lifecycleGroups.map((g) => ({ stage: g.lifecycle_stage ?? "Unknown", count: g._count })),
    topBreeds: breedGroups.map((g) => ({ breed: breedNameById.get(g.breed_id) ?? `#${g.breed_id}`, count: g._count })),
  };
}

const getFarmStatisticsSchema = z.object({ farm_id: z.number().int() });
const getFarmStatistics: AiTool<{ farm_id: number }> = {
  name: "getFarmStatistics",
  category: "Farms",
  description:
    "Get detailed statistics for ONE farm: active animal count, unit capacity, milk produced in the last 30 days, currently pregnant count, health incident breakdown, lifecycle stage distribution, and top breeds. Use `getFarms` first to look up a farm_id by name.",
  parameters: objectSchema({ farm_id: int("The farm's numeric farm_id.") }, ["farm_id"]),
  schema: getFarmStatisticsSchema,
  async handler(args) {
    const stat = await buildFarmStat(args.farm_id);
    if (!stat) return { found: false, message: `No farm found with farm_id ${args.farm_id}.` };
    return serialize({ found: true, ...stat });
  },
};

const compareFarmsSchema = z.object({ farm_ids: z.array(z.number().int()).min(2).max(6) });
const compareFarms: AiTool<{ farm_ids: number[] }> = {
  name: "compareFarms",
  category: "Farms",
  description:
    "Side-by-side comparison of 2-6 farms: active animals, milk in the last 30 days, pregnant count, unit capacity, top breeds. Use `getFarms` first to resolve farm names to farm_ids.",
  parameters: objectSchema(
    { farm_ids: arr({ type: "integer" }, "2 to 6 farm_id values to compare.") },
    ["farm_ids"],
  ),
  schema: compareFarmsSchema,
  async handler(args) {
    const stats = await Promise.all(args.farm_ids.map((id) => buildFarmStat(id)));
    return serialize({
      farms: stats.filter((s): s is NonNullable<typeof s> => s !== null),
      notFound: args.farm_ids.filter((_, i) => stats[i] === null),
    });
  },
};

export const farmTools: AiTool<any, any>[] = [getFarms, getFarmStatistics, compareFarms];
