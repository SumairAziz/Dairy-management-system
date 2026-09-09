import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import {
  TERMINAL_PREGNANCY_STATUSES,
  getPregnantAnimalsFilter,
} from "@/lib/pregnancy-status";
import { getAnimalVaccinationStatus } from "@/lib/vaccination-status";
import {
  stageBucket,
  isBreedingEligible,
  HEALTH_ISSUE_STATUSES,
  type StageBucket,
} from "@/lib/animal-rules";
import { countByProductionStatus } from "@/services/lactation.service";

const STAGE_ORDER: StageBucket[] = ["Calves", "Heifers", "Adults", "Seniors"];
const TOP_BREEDS_LIMIT = 6;

/**
 * Aggregate herd overview for the Animals page dashboard section. Mirrors
 * dashboard.service.ts's predicates (ACTIVE_PREGNANCY_STATUSES, open-heat-cycle
 * check, health status list) so the numbers stay consistent with the main
 * dashboard rather than reinventing the same rules differently.
 */
export async function getAnimalStats() {
  const animals = await prisma.animals.findMany({
    select: {
      animal_id: true,
      gender: true,
      is_active: true,
      date_of_birth: true,
      lifecycle_stage: true,
      pregnancy_status: true,
      lactation_status: true,
      breeds: { select: { breed_id: true, breed_name: true } },
      farms: { select: { farm_id: true, farm_name: true } },
    },
  });

  const total = animals.length;
  const female = animals.filter((a) => a.gender === "F").length;
  const male = animals.filter((a) => a.gender === "M").length;

  const activeAnimals = animals.filter((a) => a.is_active);
  const activeCount = activeAnimals.length;
  const inactiveCount = total - activeCount;

  const productionCounts = await countByProductionStatus();
  const lactatingCount = productionCounts.lactating;
  const dryCount = productionCounts.dry;
  const neverLactatedCount = productionCounts.never_lactated;
  const lactatingPct = total > 0 ? (lactatingCount / total) * 100 : 0;

  const calfAnimals = animals.filter((a) => a.lifecycle_stage === "Calf");
  const calvesMale = calfAnimals.filter((a) => a.gender === "M").length;
  const calvesFemale = calfAnimals.filter((a) => a.gender === "F").length;

  const breedingEligibleCount = animals.filter((a) => isBreedingEligible(a)).length;

  // Stage distribution — active herd only, matching how the main dashboard's
  // lifecycleDist is scoped (is_active: true).
  const stageCounts: Record<StageBucket, number> = { Calves: 0, Heifers: 0, Adults: 0, Seniors: 0 };
  for (const a of activeAnimals) {
    const bucket = stageBucket(a.lifecycle_stage);
    if (bucket) stageCounts[bucket] += 1;
  }
  const stageDistribution = STAGE_ORDER.map((label) => ({ label, value: stageCounts[label] }));

  // Breed distribution — top N breeds by count, remainder grouped as "Other".
  // Keyed by breed_id (not name) so the chart can carry a real drill-down id;
  // "Unknown"/"Other" buckets have no id and stay non-clickable.
  const breedCounts = new Map<string, { id: number | null; label: string; value: number }>();
  for (const a of activeAnimals) {
    const id = a.breeds?.breed_id ?? null;
    const key = id !== null ? String(id) : "unknown";
    const label = a.breeds?.breed_name ?? "Unknown";
    const existing = breedCounts.get(key);
    if (existing) existing.value += 1;
    else breedCounts.set(key, { id, label, value: 1 });
  }
  const sortedBreeds = [...breedCounts.values()].sort((a, b) => b.value - a.value);
  const topBreeds = sortedBreeds.slice(0, TOP_BREEDS_LIMIT);
  const otherBreedsTotal = sortedBreeds.slice(TOP_BREEDS_LIMIT).reduce((s, b) => s + b.value, 0);
  const breedDistribution =
    otherBreedsTotal > 0
      ? [...topBreeds, { id: null, label: "Other", value: otherBreedsTotal }]
      : topBreeds;

  // Farm distribution — keyed by farm_id for the same reason.
  const farmCounts = new Map<string, { id: number | null; label: string; value: number }>();
  for (const a of activeAnimals) {
    const id = a.farms?.farm_id ?? null;
    const key = id !== null ? String(id) : "unknown";
    const label = a.farms?.farm_name ?? "Unknown";
    const existing = farmCounts.get(key);
    if (existing) existing.value += 1;
    else farmCounts.set(key, { id, label, value: 1 });
  }
  const farmDistribution = [...farmCounts.values()].sort((a, b) => b.value - a.value);

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [pregnantCount, dueWithin30Days, inHeatCount, healthIssueAnimals, vaccinationRecords] = await Promise.all([
    prisma.animals.count({ where: getPregnantAnimalsFilter() }),
    prisma.pregnancy_records.count({
      where: {
        expected_delivery_date: { gte: now, lte: in30Days },
        status: { notIn: [...TERMINAL_PREGNANCY_STATUSES] },
      },
    }),
    prisma.heat_cycle_records.count({ where: { heat_end_date: null, heat_start_date: { not: null } } }),
    prisma.health_incidents.findMany({
      where: { status: { in: HEALTH_ISSUE_STATUSES } },
      distinct: ["animal_id"],
      select: { animal_id: true },
    }),
    prisma.vaccination_records.findMany({
      select: { animal_id: true, next_due_date: true, vaccination_date: true },
    }),
  ]);

  // Vaccination-due = distinct animals whose latest record is overdue or due
  // soon, using the exact same classification the Vaccinations page uses.
  const byAnimal = new Map<number, Array<{ next_due_date: string | null; vaccination_date: string | null }>>();
  for (const r of vaccinationRecords) {
    if (!r.animal_id) continue;
    const list = byAnimal.get(r.animal_id) ?? [];
    list.push({
      next_due_date: r.next_due_date ? r.next_due_date.toISOString() : null,
      vaccination_date: r.vaccination_date ? r.vaccination_date.toISOString() : null,
    });
    byAnimal.set(r.animal_id, list);
  }
  let vaccinationDueCount = 0;
  for (const records of byAnimal.values()) {
    const status = getAnimalVaccinationStatus(records);
    if (status === "overdue" || status === "due_for_vaccination") vaccinationDueCount++;
  }

  return serialize({
    total: { count: total, female, male },
    active: { count: activeCount, inactiveCount },
    lactating: { count: lactatingCount, percentOfHerd: Number(lactatingPct.toFixed(1)) },
    pregnant: { count: pregnantCount, dueWithin30Days },
    inHeat: { count: inHeatCount },
    calves: { count: calfAnimals.length, male: calvesMale, female: calvesFemale },
    stageDistribution,
    breedDistribution,
    farmDistribution,
    vaccinationDue: { count: vaccinationDueCount },
    breedingEligible: { count: breedingEligibleCount },
    dry: { count: dryCount },
    neverLactated: { count: neverLactatedCount },
    healthIssues: { count: healthIssueAnimals.length },
  });
}
