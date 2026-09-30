import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import {
  TERMINAL_PREGNANCY_STATUSES,
  getPregnantAnimalsFilter,
} from "@/lib/pregnancy-status";
import { buildVaccinationStatusWhere } from "@/lib/vaccination-status";
import {
  HEALTH_ISSUE_STATUSES,
  MATURE_AGE_MONTHS,
  type StageBucket,
} from "@/lib/animal-rules";
import { countByProductionStatus } from "@/services/lactation.service";

const STAGE_ORDER: StageBucket[] = ["Calves", "Heifers", "Adults", "Seniors"];
const TOP_BREEDS_LIMIT = 6;

/** Map lifecycle_stage values to their display bucket. Matches lib/animal-rules.ts STAGE_BUCKET_MAP. */
const STAGE_BUCKET_SQL = `
  CASE lifecycle_stage
    WHEN 'Calf'           THEN 'Calves'
    WHEN 'Heifer'         THEN 'Heifers'
    WHEN 'Pregnant Heifer' THEN 'Heifers'
    WHEN 'Lactating'      THEN 'Adults'
    WHEN 'Dry'            THEN 'Adults'
    WHEN 'Bull'           THEN 'Adults'
    WHEN 'Breeding Bull'  THEN 'Adults'
    WHEN 'Retired'        THEN 'Seniors'
    ELSE NULL
  END
`;

/**
 * Aggregate herd overview for the Animals page dashboard section.
 *
 * All counts and distributions are computed via SQL aggregation —
 * no full-table fetch into JS memory.
 */
export async function getAnimalStats() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Breeding eligibility cutoff: females born at least MATURE_AGE_MONTHS ago
  const breedingCutoff = new Date();
  breedingCutoff.setMonth(breedingCutoff.getMonth() - MATURE_AGE_MONTHS);

  const [
    // 1. Basic counts — all via SQL COUNT
    totalCount,
    femaleCount,
    maleCount,
    activeCount,

    // 2. Calves breakdown
    calvesCount,
    calvesMale,
    calvesFemale,

    // 3. Production counts (already SQL-based via countByProductionStatus)
    productionCounts,

    // 4. Pregnant + due within 30 days (already SQL-based)
    pregnantCount,
    dueWithin30Days,

    // 5. In heat (already SQL-based)
    inHeatCount,

    // 6. Breeding eligible — SQL count matching isBreedingEligible() logic
    breedingEligibleCount,

    // 7. Health issues — SQL count of distinct animals
    healthIssueCount,

    // 8. Vaccination due — SQL counts using same WHERE as vaccination page
    vaccOverdueAnimals,
    vaccDueSoonAnimals,

    // 9. Stage distribution — SQL GROUP BY
    stageDist,

    // 10. Breed distribution — SQL GROUP BY with JOIN
    breedDist,

    // 11. Farm distribution — SQL GROUP BY with JOIN
    farmDist,
  ] = await Promise.all([
    // 1. Basic counts
    prisma.animals.count(),
    prisma.animals.count({ where: { gender: "F" } }),
    prisma.animals.count({ where: { gender: "M" } }),
    prisma.animals.count({ where: { is_active: true } }),

    // 2. Calves
    prisma.animals.count({ where: { lifecycle_stage: "Calf" } }),
    prisma.animals.count({ where: { lifecycle_stage: "Calf", gender: "M" } }),
    prisma.animals.count({ where: { lifecycle_stage: "Calf", gender: "F" } }),

    // 3. Production status counts
    countByProductionStatus(),

    // 4. Pregnancy counts
    prisma.animals.count({ where: getPregnantAnimalsFilter() }),
    prisma.pregnancy_records.count({
      where: {
        expected_delivery_date: { gte: now, lte: in30Days },
        status: { notIn: [...TERMINAL_PREGNANCY_STATUSES] },
      },
    }),

    // 5. In heat count
    prisma.heat_cycle_records.count({
      where: { heat_end_date: null, heat_start_date: { not: null } },
    }),

    // 6. Breeding eligible: active females, old enough, not pregnant, correct stage
    prisma.animals.count({
      where: {
        gender: "F",
        is_active: true,
        date_of_birth: { lte: breedingCutoff },
        pregnancy_status: { not: "PREGNANT" },
        lifecycle_stage: { notIn: ["Dry", "Retired", "Sold", "Deceased", "Calf"] },
      },
    }),

    // 7. Health issues: distinct animals with active health incidents
    prisma.health_incidents.findMany({
      where: { status: { in: HEALTH_ISSUE_STATUSES } },
      distinct: ["animal_id"],
      select: { animal_id: true },
    }),

    // 8. Vaccination due: distinct animals with overdue or due-soon records
    prisma.vaccination_records.findMany({
      where: buildVaccinationStatusWhere("overdue"),
      distinct: ["animal_id"],
      select: { animal_id: true },
    }),
    prisma.vaccination_records.findMany({
      where: {
        OR: [
          buildVaccinationStatusWhere("due_today") as Record<string, unknown>,
          buildVaccinationStatusWhere("due_soon") as Record<string, unknown>,
        ],
      },
      distinct: ["animal_id"],
      select: { animal_id: true },
    }),

    // 9. Stage distribution (active herd only)
    prisma.$queryRawUnsafe<Array<{ bucket: string; value: number }>>(`
      SELECT ${STAGE_BUCKET_SQL} AS bucket, COUNT(*)::int AS value
      FROM animals
      WHERE is_active = TRUE AND ${STAGE_BUCKET_SQL} IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket
    `),

    // 10. Breed distribution (active herd only, top N + Other)
    prisma.$queryRaw<Array<{ id: number | null; label: string; value: number }>>`
      SELECT b.breed_id AS id, b.breed_name AS label, COUNT(a.animal_id)::int AS value
      FROM animals a
      LEFT JOIN breeds b ON b.breed_id = a.breed_id
      WHERE a.is_active = TRUE
      GROUP BY b.breed_id, b.breed_name
      ORDER BY value DESC
    `,

    // 11. Farm distribution (active herd only)
    prisma.$queryRaw<Array<{ id: number | null; label: string; value: number }>>`
      SELECT f.farm_id AS id, f.farm_name AS label, COUNT(a.animal_id)::int AS value
      FROM animals a
      LEFT JOIN farms f ON f.farm_id = a.farm_id
      WHERE a.is_active = TRUE
      GROUP BY f.farm_id, f.farm_name
      ORDER BY value DESC
    `,
  ]);

  const inactiveCount = totalCount - activeCount;
  const lactatingCount = productionCounts.lactating;
  const dryCount = productionCounts.dry;
  const neverLactatedCount = productionCounts.never_lactated;
  const lactatingPct = totalCount > 0 ? (lactatingCount / totalCount) * 100 : 0;

  // Merge overdue + due_soon animal ID sets for distinct count
  const vaccDueAnimalIds = new Set<number>();
  for (const r of vaccOverdueAnimals) { if (r.animal_id) vaccDueAnimalIds.add(r.animal_id); }
  for (const r of vaccDueSoonAnimals) { if (r.animal_id) vaccDueAnimalIds.add(r.animal_id); }

  // Stage distribution: map raw results to ordered array
  const stageMap = new Map<string, number>();
  for (const row of stageDist) {
    if (row.bucket) stageMap.set(row.bucket, row.value);
  }
  const stageDistribution = STAGE_ORDER.map((label) => ({
    label,
    value: stageMap.get(label) ?? 0,
  }));

  // Breed distribution: top N + Other bucket
  const rawBreeds = breedDist.map((r) => ({
    id: r.id ?? null,
    label: r.label ?? "Unknown",
    value: r.value,
  }));
  const topBreeds = rawBreeds.slice(0, TOP_BREEDS_LIMIT);
  const otherBreedsTotal = rawBreeds
    .slice(TOP_BREEDS_LIMIT)
    .reduce((s, b) => s + b.value, 0);
  const breedDistribution =
    otherBreedsTotal > 0
      ? [...topBreeds, { id: null, label: "Other", value: otherBreedsTotal }]
      : topBreeds;

  // Farm distribution
  const farmDistribution = farmDist.map((r) => ({
    id: r.id ?? null,
    label: r.label ?? "Unknown",
    value: r.value,
  }));

  return serialize({
    total: { count: totalCount, female: femaleCount, male: maleCount },
    active: { count: activeCount, inactiveCount },
    lactating: { count: lactatingCount, percentOfHerd: Number(lactatingPct.toFixed(1)) },
    pregnant: { count: pregnantCount, dueWithin30Days },
    inHeat: { count: inHeatCount },
    calves: { count: calvesCount, male: calvesMale, female: calvesFemale },
    stageDistribution,
    breedDistribution,
    farmDistribution,
    vaccinationDue: { count: vaccDueAnimalIds.size },
    breedingEligible: { count: breedingEligibleCount },
    dry: { count: dryCount },
    neverLactated: { count: neverLactatedCount },
    healthIssues: { count: healthIssueCount.length },
  });
}
