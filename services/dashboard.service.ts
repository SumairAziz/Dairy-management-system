import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import {
  DEFAULT_MILK_TREND_PERIOD,
  getMilkTrendPeriodConfig,
  mapMilkTrendRows,
  resolveLifetimeGranularity,
  type MilkTrendGranularity,
  type MilkTrendPeriodId,
  type MilkTrendResponse,
} from "@/lib/dashboard-milk-trend";
import {
  ACTIVE_PREGNANCY_STATUSES,
  buildPregnancyDueWithinDaysWhere,
  buildPregnancyStatusWhere,
} from "@/lib/pregnancy-status";
import { buildVaccinationStatusWhere } from "@/lib/vaccination-status";
import { getInventoryDashboardSummary } from "@/services/inventory-stats.service";

async function getFirstMilkProductionDate(): Promise<Date | null> {
  const result = await prisma.milk_logs.aggregate({ _min: { production_date: true } });
  return result._min.production_date;
}

async function queryMilkTrendAggregatedOnly(
  granularity: MilkTrendGranularity,
  since?: Date,
): Promise<Array<{ bucket: Date; value: number }>> {
  if (since) {
    if (granularity === "day") {
      return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
        SELECT production_date::date AS bucket, COALESCE(SUM(milk_liters), 0)::float AS value
        FROM milk_logs
        WHERE production_date::date >= ${since}::date
        GROUP BY 1 ORDER BY 1`;
    }
    if (granularity === "week") {
      return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
        SELECT date_trunc('week', production_date)::date AS bucket,
          COALESCE(SUM(milk_liters), 0)::float AS value
        FROM milk_logs
        WHERE production_date::date >= ${since}::date
        GROUP BY 1 ORDER BY 1`;
    }
    if (granularity === "year") {
      return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
        SELECT date_trunc('year', production_date)::date AS bucket,
          COALESCE(SUM(milk_liters), 0)::float AS value
        FROM milk_logs
        WHERE production_date::date >= ${since}::date
        GROUP BY 1 ORDER BY 1`;
    }
    return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
      SELECT date_trunc('month', production_date)::date AS bucket,
        COALESCE(SUM(milk_liters), 0)::float AS value
      FROM milk_logs
      WHERE production_date::date >= ${since}::date
      GROUP BY 1 ORDER BY 1`;
  }

  if (granularity === "day") {
    return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
      SELECT production_date::date AS bucket, COALESCE(SUM(milk_liters), 0)::float AS value
      FROM milk_logs
      GROUP BY 1 ORDER BY 1`;
  }
  if (granularity === "week") {
    return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
      SELECT date_trunc('week', production_date)::date AS bucket,
        COALESCE(SUM(milk_liters), 0)::float AS value
      FROM milk_logs
      GROUP BY 1 ORDER BY 1`;
  }
  if (granularity === "year") {
    return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
      SELECT date_trunc('year', production_date)::date AS bucket,
        COALESCE(SUM(milk_liters), 0)::float AS value
      FROM milk_logs
      GROUP BY 1 ORDER BY 1`;
  }
  return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
    SELECT date_trunc('month', production_date)::date AS bucket,
      COALESCE(SUM(milk_liters), 0)::float AS value
    FROM milk_logs
    GROUP BY 1 ORDER BY 1`;
}

/** Short rolling daily windows — fills gaps with 0 only within the requested window. */
async function queryMilkTrendDailyFilled(
  days: number,
  firstDataDate: Date | null,
): Promise<Array<{ bucket: Date; value: number }>> {
  const daysBack = days - 1;
  if (firstDataDate) {
    return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
      SELECT d::date AS bucket, COALESCE(SUM(m.milk_liters), 0)::float AS value
      FROM generate_series(
        GREATEST(
          (CURRENT_DATE - (${daysBack} || ' days')::interval)::date,
          ${firstDataDate}::date
        ),
        CURRENT_DATE,
        INTERVAL '1 day'
      ) d
      LEFT JOIN milk_logs m ON m.production_date::date = d::date
      GROUP BY d::date
      ORDER BY d::date`;
  }
  return prisma.$queryRaw<Array<{ bucket: Date; value: number }>>`
    SELECT d::date AS bucket, COALESCE(SUM(m.milk_liters), 0)::float AS value
    FROM generate_series(
      (CURRENT_DATE - (${daysBack} || ' days')::interval)::date,
      CURRENT_DATE,
      INTERVAL '1 day'
    ) d
    LEFT JOIN milk_logs m ON m.production_date::date = d::date
    GROUP BY d::date
    ORDER BY d::date`;
}

function periodSinceDate(config: ReturnType<typeof getMilkTrendPeriodConfig>): Date | undefined {
  const today = new Date();
  if (config.weeks) {
    const since = new Date(today);
    since.setUTCDate(since.getUTCDate() - config.weeks * 7);
    return since;
  }
  if (config.months) {
    const since = new Date(today);
    since.setUTCMonth(since.getUTCMonth() - config.months);
    return since;
  }
  if (config.years) {
    const since = new Date(today);
    since.setUTCFullYear(since.getUTCFullYear() - config.years);
    return since;
  }
  return undefined;
}

export async function getMilkProductionTrend(
  period: MilkTrendPeriodId = DEFAULT_MILK_TREND_PERIOD,
): Promise<MilkTrendResponse> {
  const config = getMilkTrendPeriodConfig(period);
  const firstDataDate = await getFirstMilkProductionDate();

  if (!firstDataDate) {
    return {
      period,
      periodLabel: config.label,
      granularity: config.granularity,
      totalLiters: 0,
      points: [],
    };
  }

  if (config.lifetime) {
    const spanDays = Math.max(
      1,
      Math.ceil((Date.now() - firstDataDate.getTime()) / 86_400_000),
    );
    const granularity = resolveLifetimeGranularity(spanDays);
    const rows = await queryMilkTrendAggregatedOnly(granularity);
    const points = mapMilkTrendRows(rows, granularity);
    const totalLiters = points.reduce((sum, point) => sum + point.value, 0);

    return {
      period,
      periodLabel: config.label,
      granularity,
      totalLiters: Math.round(totalLiters * 10) / 10,
      points,
    };
  }

  let rows: Array<{ bucket: Date; value: number }>;
  let granularity = config.granularity;

  if (granularity === "day" && config.days) {
    rows = await queryMilkTrendDailyFilled(config.days, firstDataDate);
  } else {
    const since = periodSinceDate(config);
    if (since && since < firstDataDate) {
      since.setTime(firstDataDate.getTime());
    }
    rows = await queryMilkTrendAggregatedOnly(granularity, since);
  }

  const points = mapMilkTrendRows(rows, granularity);
  const totalLiters = points.reduce((sum, point) => sum + point.value, 0);

  return {
    period,
    periodLabel: config.label,
    granularity,
    totalLiters: Math.round(totalLiters * 10) / 10,
    points,
  };
}

export async function getDashboardData() {
  const [
    animalCount,
    speciesCount,
    breedCount,
    farmCount,
    unitCount,
    milkAgg,
    healthGroups,
    vaccGroups,
    pregnantCount,
    recent,
    milkByFarm,
    speciesDist,
    breedingStats,
    heatCycleByMethod,
    pregnancyByStatus,
    lifecycleDist,
    overdueVaccinations,
    vaccinationDueSoon,
    vaccinationDueToday,
    farmCapacity,
    animalsInHeat,
    upcomingDeliveries,
    pregnanciesDueSoon,
    inventorySummary,
    milkTrend,
  ] = await Promise.all([
    // --- Existing queries ---
    prisma.animals.count({ where: { is_active: true } }),
    prisma.species.count(),
    prisma.breeds.count(),
    prisma.farms.count(),
    prisma.units.count(),
    prisma.milk_logs.aggregate({ _sum: { milk_liters: true } }),
    prisma.health_incidents.groupBy({ by: ["status"], _count: true }),
    prisma.vaccination_records.groupBy({ by: ["vaccine_name"], _count: true }),
    // Current pregnant animals = any active status (Pending + Confirmed + In Progress)
    prisma.pregnancy_records.count({
      where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
    }),
    prisma.animals.findMany({
      take: 8,
      orderBy: { created_at: "desc" },
      include: {
        farms: true,
        breeds: { include: { species: true } },
        health_incidents: { take: 1, orderBy: { incident_date: "desc" } },
      },
    }),
    prisma.$queryRaw`
      SELECT f.farm_id, f.farm_name, COALESCE(SUM(m.milk_liters),0)::float AS liters
      FROM farms f
      LEFT JOIN animals a ON a.farm_id = f.farm_id AND a.is_active = TRUE
      LEFT JOIN milk_logs m ON m.animal_id = a.animal_id
      GROUP BY f.farm_id, f.farm_name ORDER BY liters DESC LIMIT 10`,
    prisma.$queryRaw`
      SELECT s.species_id AS id, s.species_name AS label, COUNT(a.animal_id)::int AS value
      FROM species s
      LEFT JOIN breeds b ON b.species_id = s.species_id
      LEFT JOIN animals a ON a.breed_id = b.breed_id AND a.is_active = TRUE
      GROUP BY s.species_id, s.species_name ORDER BY value DESC`,

    // --- NEW: Breeding stats (success/failed/pending) ---
    prisma.breeding_records.groupBy({
      by: ["result"],
      _count: true,
    }),

    // --- NEW: Heat cycle detection methods ---
    prisma.heat_cycle_records.groupBy({
      by: ["detection_method"],
      _count: true,
    }),

    // --- NEW: Pregnancy status distribution ---
    prisma.pregnancy_records.groupBy({
      by: ["status"],
      _count: true,
    }),

    // --- NEW: Lifecycle stage distribution ---
    prisma.animals.groupBy({
      by: ["lifecycle_stage"],
      where: { is_active: true },
      _count: true,
    }),

    // Vaccination alert counts — same rules as `/animals/vaccinations?status=`
    prisma.vaccination_records.count({
      where: buildVaccinationStatusWhere("overdue"),
    }),
    prisma.vaccination_records.count({
      where: buildVaccinationStatusWhere("due_soon"),
    }),
    prisma.vaccination_records.count({
      where: buildVaccinationStatusWhere("due_today"),
    }),

    // --- NEW: Farm capacity utilization ---
    prisma.$queryRaw`
      SELECT f.farm_id, f.farm_name,
        (SELECT COUNT(*)::int FROM animals a
         WHERE a.farm_id = f.farm_id AND a.is_active = TRUE) AS animal_count,
        (SELECT COALESCE(SUM(u.capacity), 0)::int FROM units u
         WHERE u.farm_id = f.farm_id) AS total_capacity
      FROM farms f
      ORDER BY f.farm_name
      LIMIT 10`,

    prisma.heat_cycle_records.count({
      where: { heat_end_date: null, heat_start_date: { not: null } },
    }),

    prisma.pregnancy_records.count({
      where: buildPregnancyDueWithinDaysWhere(30),
    }),
    prisma.pregnancy_records.count({
      where: buildPregnancyStatusWhere("due_soon"),
    }),
    getInventoryDashboardSummary(),
    getMilkProductionTrend(DEFAULT_MILK_TREND_PERIOD),
  ]);

  const upcomingVaccinations =
    overdueVaccinations + vaccinationDueSoon + vaccinationDueToday;

  return serialize({
    totals: {
      animalCount,
      speciesCount,
      breedCount,
      farmCount,
      unitCount,
      dailyMilk: Number(milkAgg._sum.milk_liters ?? 0),
      pregnantCount,
    },
    health: healthGroups,
    vaccination: vaccGroups,
    recent,
    milkByFarm,
    speciesDist,
    // New analytics data
    milkTrend: milkTrend.points.map((point) => ({
      label: point.label,
      date: point.date,
      date_from: point.date_from,
      date_to: point.date_to,
      value: point.value,
    })),
    milkTrendMeta: {
      period: milkTrend.period,
      periodLabel: milkTrend.periodLabel,
      granularity: milkTrend.granularity,
      totalLiters: milkTrend.totalLiters,
    },
    breedingStats: (
      breedingStats as Array<{ result: string | null; _count: number }>
    ).map((g) => ({
      label: g.result || "Unknown",
      value: g._count,
    })),
    heatCycleByMethod: (
      heatCycleByMethod as Array<{
        detection_method: string | null;
        _count: number;
      }>
    ).map((g) => ({
      label: g.detection_method || "Unknown",
      value: g._count,
    })),
    pregnancyByStatus: (
      pregnancyByStatus as Array<{ status: string | null; _count: number }>
    ).map((g) => ({
      label: g.status || "Unknown",
      value: g._count,
    })),
    lifecycleDist: (
      lifecycleDist as Array<{ lifecycle_stage: string; _count: number }>
    ).map((g) => ({
      label: g.lifecycle_stage,
      value: g._count,
    })),
    upcomingVaccinations,
    overdueVaccinations,
    vaccinationDueSoon,
    animalsInHeat,
    upcomingDeliveries,
    pregnanciesDueSoon,
    farmCapacity: (
      farmCapacity as Array<{
        farm_id: number;
        farm_name: string;
        animal_count: number;
        total_capacity: number;
      }>
    ).map((f) => ({
      id: f.farm_id,
      label: f.farm_name,
      value: f.animal_count,
      max: f.total_capacity || 1,
    })),
    inventory: inventorySummary,
  });
}
