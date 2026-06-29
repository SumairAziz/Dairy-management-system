import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";

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
    milkTrend,
    breedingStats,
    heatCycleByMethod,
    pregnancyByStatus,
    lifecycleDist,
    upcomingVaccinations,
    farmCapacity,
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
    prisma.pregnancy_records.count({ where: { status: "Pregnant" } }),
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
      SELECT s.species_name AS label, COUNT(a.animal_id)::int AS value
      FROM species s
      LEFT JOIN breeds b ON b.species_id = s.species_id
      LEFT JOIN animals a ON a.breed_id = b.breed_id AND a.is_active = TRUE
      GROUP BY s.species_name ORDER BY value DESC`,

    // --- NEW: Milk production trend (last 14 days) ---
    prisma.$queryRaw`
      SELECT d::date AS label, COALESCE(SUM(m.milk_liters),0)::float AS value
      FROM generate_series(
        CURRENT_DATE - INTERVAL '13 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) d
      LEFT JOIN milk_logs m ON m.production_date::date = d::date
      GROUP BY d::date
      ORDER BY d::date`,

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

    // --- NEW: Upcoming/overdue vaccinations ---
    prisma.vaccination_records.count({
      where: {
        next_due_date: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
    }),

    // --- NEW: Farm capacity utilization ---
    prisma.$queryRaw`
      SELECT f.farm_id, f.farm_name,
        COUNT(a.animal_id)::int AS animal_count,
        COALESCE(SUM(u.capacity)::int, 0) AS total_capacity
      FROM farms f
      LEFT JOIN animals a ON a.farm_id = f.farm_id AND a.is_active = TRUE
      LEFT JOIN units u ON u.farm_id = f.farm_id
      GROUP BY f.farm_id, f.farm_name
      ORDER BY f.farm_name
      LIMIT 10`,
  ]);

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
    milkTrend: (
      milkTrend as Array<{ label: string | Date; value: number }>
    ).map((d) => ({
      label: (d.label instanceof Date
        ? d.label.toISOString()
        : String(d.label)
      ).slice(5, 10), // "MM-DD" format
      value: d.value,
    })),
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
    farmCapacity: (
      farmCapacity as Array<{
        farm_id: number;
        farm_name: string;
        animal_count: number;
        total_capacity: number;
      }>
    ).map((f) => ({
      label: f.farm_name,
      value: f.animal_count,
      max: f.total_capacity || 1,
    })),
  });
}
