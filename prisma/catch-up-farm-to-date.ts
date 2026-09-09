/**
 * Continue existing farm data from each entity's last known date → CURRENT_DATE.
 * Inserts only — no truncate/reset. Uses existing service workflows.
 *
 * Run: npm run db:catch-up
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import * as breedingService from "@/services/breeding.service";
import * as pregnancyService from "@/services/pregnancy.service";
import * as calvingService from "@/services/calving.service";
import * as vaccinationService from "@/services/vaccination.service";
import {
  ACTIVE_PREGNANCY_STATUSES,
  GESTATION_DAYS,
  isActivePregnancy,
} from "@/lib/pregnancy-status";
import { ageInMonths, isBreedingEligible, MATURE_AGE_MONTHS } from "@/lib/animal-rules";
import { syncAnimalDates } from "./sync-animal-dates";
import { addUtcDays, getFarmToday, toUtcDateString } from "@/lib/farm-date";

/** Rolling simulation anchor — always the current UTC calendar date. */
export const CURRENT_DATE = getFarmToday();
const VET = "Dr. Aisha Raza";
const SEMEN_BATCHES = ["SEM-HOL-1042", "SEM-JER-0871", "SEM-HOL-1108", "SEM-SAH-0512"];
const ROUTINE_VACCINES = [
  "Foot and Mouth Disease (FMD)",
  "Hemorrhagic Septicemia (HS)",
  "Brucellosis",
  "Deworming",
];

type AuditSnapshot = Awaited<ReturnType<typeof collectAudit>>;

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function toDateStr(date: Date): string {
  return toUtcDateString(date);
}
function addDays(date: Date, days: number): Date {
  return addUtcDays(date, days);
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function frac(seed: number): number {
  const r = Math.sin(seed * 12.9898) * 43758.5453;
  return r - Math.floor(r);
}

async function collectAudit() {
  const animals = await prisma.animals.findMany({
    select: {
      animal_id: true,
      gender: true,
      lifecycle_stage: true,
      is_active: true,
      lactation_status: true,
      pregnancy_status: true,
    },
  });
  const byStage: Record<string, number> = {};
  for (const a of animals) {
    const k = a.lifecycle_stage ?? "null";
    byStage[k] = (byStage[k] ?? 0) + 1;
  }
  const latest = {
    milk: (await prisma.milk_logs.aggregate({ _max: { production_date: true } }))._max.production_date,
    breeding: (await prisma.breeding_records.aggregate({ _max: { breeding_date: true } }))._max.breeding_date,
    pregnancy: (await prisma.pregnancy_records.aggregate({ _max: { insemination_date: true } }))._max
      .insemination_date,
    calving: (await prisma.calving_records.aggregate({ _max: { calving_date: true } }))._max.calving_date,
    vaccination: (await prisma.vaccination_records.aggregate({ _max: { vaccination_date: true } }))._max
      .vaccination_date,
    growth: (await prisma.growth_logs.aggregate({ _max: { recorded_date: true } }))._max.recorded_date,
  };
  const pregnant = await prisma.pregnancy_records.count({
    where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
  });
  return {
    totalAnimals: animals.length,
    activeAnimals: animals.filter((a) => a.is_active !== false).length,
    males: animals.filter((a) => a.gender === "M").length,
    females: animals.filter((a) => a.gender === "F").length,
    byStage,
    latest,
    pregnant,
    lactating: animals.filter(
      (a) => a.lifecycle_stage === "Lactating" || a.lactation_status === "LACTATING",
    ).length,
    dry: animals.filter((a) => a.lifecycle_stage === "Dry" || a.lactation_status === "DRY").length,
    calves: animals.filter((a) => a.lifecycle_stage === "Calf").length,
  };
}

async function gestationDaysFor(animalId: number): Promise<number> {
  const animal = await prisma.animals.findUnique({
    where: { animal_id: animalId },
    include: { breeds: { include: { species: true } } },
  });
  const species = animal?.breeds?.species?.species_name;
  return species === "Buffalo" ? 310 : GESTATION_DAYS;
}

async function allocateCalfTag(farmId: number): Promise<string> {
  const any = await prisma.animals.findFirst({
    where: { farm_id: farmId },
    orderBy: { animal_id: "asc" },
  });
  const prefix = any?.tag_number.split("-")[0] ?? "GVD";
  const existing = await prisma.animals.findMany({
    where: { farm_id: farmId, tag_number: { startsWith: `${prefix}-C` } },
    select: { tag_number: true },
  });
  let max = 0;
  for (const row of existing) {
    const m = row.tag_number.match(/-C(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-C${String(max + 1).padStart(3, "0")}`;
}

async function resolveOverdueCalvings(stats: Record<string, number>) {
  const overdue = await prisma.pregnancy_records.findMany({
    where: {
      status: { in: [...ACTIVE_PREGNANCY_STATUSES] },
      expected_delivery_date: { lte: CURRENT_DATE },
    },
    include: {
      animals: {
        include: {
          breeds: { include: { species: true } },
          farms: true,
        },
      },
      breeding_records: true,
    },
  });

  for (const preg of overdue) {
    const mother = preg.animals;
    if (!mother || !preg.expected_delivery_date) continue;

    const existingCalving = await prisma.calving_records.findFirst({
      where: { pregnancy_id: preg.pregnancy_id },
    });
    if (existingCalving) continue;

    const jitter = Math.floor(frac(preg.pregnancy_id * 7) * 5) - 2;
    let calvingDate = addDays(preg.expected_delivery_date, jitter);
    if (calvingDate > CURRENT_DATE) calvingDate = addDays(CURRENT_DATE, -1);
    if (calvingDate < preg.insemination_date) calvingDate = addDays(preg.expected_delivery_date, 0);

    const calfUnit = await prisma.units.findFirst({
      where: { farm_id: mother.farm_id, unit_type: "Calf Shed" },
    });
    const tag = await allocateCalfTag(mother.farm_id);
    const calfGender = frac(preg.pregnancy_id * 3) > 0.5 ? "F" : "M";

    const calf = await prisma.animals.create({
      data: {
        farm_id: mother.farm_id,
        unit_id: calfUnit?.unit_id ?? mother.unit_id,
        breed_id: mother.breed_id,
        tag_number: tag,
        animal_name: null,
        gender: calfGender,
        date_of_birth: calvingDate,
        mother_id: mother.animal_id,
        father_id: preg.breeding_records?.male_animal_id ?? null,
        birth_weight_kg: 34 + frac(preg.pregnancy_id) * 8,
        lifecycle_stage: "Calf",
        is_active: true,
        created_at: calvingDate,
      },
    });

    await calvingService.create({
      mother_id: mother.animal_id,
      pregnancy_id: preg.pregnancy_id,
      calving_date: toDateStr(calvingDate),
      outcome: "Live Birth",
      calf_gender: calfGender,
      calf_tag: tag,
      calf_id: calf.animal_id,
      notes: "Catch-up calving for overdue pregnancy",
    });

    await prisma.animals.update({
      where: { animal_id: mother.animal_id },
      data: { lifecycle_stage: "Lactating" },
    });

    stats.calvings++;
    stats.newAnimals++;
  }
}

async function confirmPendingPregnancies(stats: Record<string, number>) {
  const pending = await prisma.pregnancy_records.findMany({
    where: { status: "Pending" },
    include: { animals: true },
  });

  for (const preg of pending) {
    const daysSince = daysBetween(preg.insemination_date, CURRENT_DATE);
    if (daysSince < 35) continue;

    const gestation = await gestationDaysFor(preg.animal_id);
    const confirmDate = addDays(preg.insemination_date, 38 + Math.floor(frac(preg.pregnancy_id) * 5));
    const cappedConfirm = confirmDate > CURRENT_DATE ? addDays(CURRENT_DATE, -3) : confirmDate;
    const edd = addDays(preg.insemination_date, gestation);

    await pregnancyService.update(preg.pregnancy_id, {
      status: "Confirmed",
      pregnancy_confirmed: true,
      confirmation_date: toDateStr(cappedConfirm),
      expected_delivery_date: toDateStr(edd),
    });
    stats.pregnancyUpdates++;
  }
}

async function extendMilkProduction(stats: Record<string, number>) {
  const breeds = await prisma.breeds.findMany();
  const breedYield = new Map(breeds.map((b) => [b.breed_id, Number(b.average_milk_production ?? 15)]));

  const animals = await prisma.animals.findMany({
    where: { is_active: { not: false }, gender: "F" },
    include: {
      pregnancy_records: {
        where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
        select: { expected_delivery_date: true, status: true },
      },
      calving_records_as_mother: {
        orderBy: { calving_date: "desc" },
        take: 1,
        select: { calving_date: true },
      },
      milk_logs: {
        orderBy: { production_date: "desc" },
        take: 1,
        select: { production_date: true },
      },
    },
  });

  const sessions = ["Morning", "Afternoon", "Evening"] as const;
  const shares = [0.42, 0.28, 0.3];
  const rows: Array<{
    animal_id: number;
    production_date: Date;
    session: string;
    milk_liters: number;
    quality_grade: string;
  }> = [];

  for (const a of animals) {
    if (a.lifecycle_stage === "Dry" || a.lifecycle_stage === "Calf") continue;
    if (a.lifecycle_stage === "Deceased" || a.lifecycle_stage === "Sold" || a.lifecycle_stage === "Retired") {
      continue;
    }

    const activePreg = a.pregnancy_records.find((p) => isActivePregnancy({ status: p.status }));
    if (activePreg?.expected_delivery_date) {
      const daysToEdd = daysBetween(CURRENT_DATE, activePreg.expected_delivery_date);
      if (daysToEdd <= 60 && daysToEdd >= 0) continue;
    }

    const lastCalving = a.calving_records_as_mother[0]?.calving_date ?? null;
    const isLactating =
      a.lifecycle_stage === "Lactating" ||
      a.lactation_status === "LACTATING" ||
      (lastCalving && daysBetween(lastCalving, CURRENT_DATE) < 305);

    if (!isLactating) continue;

    let start: Date;
    if (a.milk_logs[0]?.production_date) {
      start = addDays(a.milk_logs[0].production_date, 1);
    } else if (lastCalving) {
      start = addDays(lastCalving, 3);
    } else {
      continue;
    }

    if (start > CURRENT_DATE) continue;

    const base = breedYield.get(a.breed_id) ?? 15;
    const cowFactor = 0.9 + frac(a.animal_id) * 0.2;
    let dayIndex = 0;

    for (let cur = new Date(start); cur <= CURRENT_DATE; cur = addDays(cur, 1)) {
      const dayTotal = base * cowFactor * (0.85 + frac(a.animal_id + dayIndex) * 0.25);
      sessions.forEach((session, i) => {
        rows.push({
          animal_id: a.animal_id,
          production_date: new Date(cur),
          session,
          milk_liters: Number((dayTotal * shares[i]).toFixed(2)),
          quality_grade: "A",
        });
      });
      dayIndex++;
    }
  }

  if (rows.length === 0) return;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const inserted = await prisma.milk_logs.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    stats.milk += inserted.count;
  }
}

async function continueHeatCycles(stats: Record<string, number>) {
  const females = await prisma.animals.findMany({
    where: { gender: "F", is_active: { not: false } },
    include: {
      pregnancy_records: { where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } } },
      heat_cycle_records: { orderBy: { heat_start_date: "desc" }, take: 1 },
    },
  });

  for (const a of females) {
    if (a.pregnancy_records.length > 0) continue;
    if (!isBreedingEligible(a, CURRENT_DATE)) continue;
    if (["Deceased", "Sold", "Retired"].includes(a.lifecycle_stage ?? "")) continue;

    let lastHeat = a.heat_cycle_records[0]?.heat_start_date ?? addDays(CURRENT_DATE, -45);
    let next = addDays(lastHeat, 21);

    while (next <= CURRENT_DATE) {
      const end = addDays(next, 1);
      await prisma.heat_cycle_records.create({
        data: {
          animal_id: a.animal_id,
          heat_start_date: next,
          heat_end_date: end <= CURRENT_DATE ? end : null,
          detection_method: "Visual Observation",
          confidence_score: 3.5 + frac(a.animal_id + next.getTime()) * 1.5,
          notes: "Catch-up heat cycle",
        },
      });
      stats.heat++;
      lastHeat = next;
      next = addDays(lastHeat, 21);
    }
  }
}

async function continueBreeding(stats: Record<string, number>) {
  const bulls = await prisma.animals.findMany({
    where: {
      gender: "M",
      lifecycle_stage: { in: ["Breeding Bull", "Bull"] },
      is_active: { not: false },
    },
  });
  if (bulls.length === 0) return;

  const heats = await prisma.heat_cycle_records.findMany({
    where: {
      heat_start_date: { gte: d("2026-08-01"), lte: CURRENT_DATE },
      animals: {
        gender: "F",
        is_active: { not: false },
        pregnancy_records: { none: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } } },
      },
    },
    include: { animals: true },
    orderBy: { heat_start_date: "asc" },
  });

  const bred = new Set<number>();
  for (const heat of heats) {
    const animalId = heat.animal_id;
    if (!animalId || bred.has(animalId)) continue;
    const animal = heat.animals;
    if (!animal || !isBreedingEligible(animal, CURRENT_DATE)) continue;

    const breedingDate = addDays(heat.heat_start_date!, 1);
    if (breedingDate > CURRENT_DATE) continue;

    const existing = await prisma.breeding_records.findFirst({
      where: {
        female_animal_id: animalId,
        breeding_date: breedingDate,
      },
    });
    if (existing) continue;

    const bull = bulls.find((b) => b.farm_id === animal.farm_id) ?? bulls[0];
    const useAi = frac(animalId) > 0.4;

    const breeding = await breedingService.create({
      female_animal_id: animalId,
      male_animal_id: useAi ? null : bull.animal_id,
      breeding_date: toDateStr(breedingDate),
      method: useAi ? "Artificial Insemination" : "Natural Mating",
      result: "Success",
      semen_batch_id: useAi ? SEMEN_BATCHES[animalId % SEMEN_BATCHES.length] : null,
      notes: "Catch-up breeding after detected heat",
    });

    const gestation = await gestationDaysFor(animalId);
    await pregnancyService.create({
      animal_id: animalId,
      breeding_id: breeding.breeding_id,
      insemination_date: toDateStr(breedingDate),
      pregnancy_confirmed: daysBetween(breedingDate, CURRENT_DATE) >= 35,
      confirmation_date:
        daysBetween(breedingDate, CURRENT_DATE) >= 35
          ? toDateStr(addDays(breedingDate, 40))
          : undefined,
      expected_delivery_date:
        daysBetween(breedingDate, CURRENT_DATE) >= 35
          ? toDateStr(addDays(breedingDate, gestation))
          : undefined,
      status: daysBetween(breedingDate, CURRENT_DATE) >= 35 ? "Confirmed" : "Pending",
    } as never);

    stats.breeding++;
    if (daysBetween(breedingDate, CURRENT_DATE) >= 35) stats.pregnancies++;
    else stats.pregnancies++;
    bred.add(animalId);
    if (stats.breeding >= 3) break;
  }
}

async function catchUpVaccinations(stats: Record<string, number>) {
  const due = await prisma.vaccination_records.findMany({
    where: {
      vaccination_date: null,
      next_due_date: { lte: CURRENT_DATE },
      animal_id: { not: null },
    },
  });

  for (const v of due) {
    const dueDate = v.next_due_date ?? CURRENT_DATE;
    const adminDate = dueDate > CURRENT_DATE ? CURRENT_DATE : dueDate;
    await vaccinationService.update(v.vaccination_id, {
      vaccination_date: toDateStr(adminDate),
      administered_by: VET,
    });
    stats.vaccinations++;
  }

  const youngCalves = await prisma.animals.findMany({
    where: {
      lifecycle_stage: "Calf",
      is_active: { not: false },
      date_of_birth: { gte: d("2026-01-01") },
    },
  });

  for (const calf of youngCalves) {
    const ageDays = daysBetween(calf.date_of_birth, CURRENT_DATE);
    if (ageDays < 30 || ageDays > 120) continue;
    const exists = await prisma.vaccination_records.findFirst({
      where: {
        animal_id: calf.animal_id,
        vaccine_name: "Clostridial (Calf)",
      },
    });
    if (exists) continue;
    await vaccinationService.create({
      animal_id: calf.animal_id,
      vaccine_name: "Clostridial (Calf)",
      vaccination_date: toDateStr(addDays(calf.date_of_birth, 30)),
      next_due_date: toDateStr(addDays(calf.date_of_birth, 180)),
      administered_by: VET,
      notes: "Catch-up calf vaccination",
      source: null,
    } as never);
    stats.vaccinations++;
  }
}

async function continueGrowth(stats: Record<string, number>) {
  const young = await prisma.animals.findMany({
    where: { is_active: { not: false } },
    include: {
      growth_logs: { orderBy: { recorded_date: "desc" }, take: 1 },
      breeds: { include: { species: true } },
    },
  });

  for (const a of young) {
    const months = ageInMonths(a.date_of_birth, CURRENT_DATE);
    if (months > 24) continue;
    if (["Deceased", "Sold", "Retired"].includes(a.lifecycle_stage ?? "")) continue;

    const isSmall = a.breeds?.species?.species_name === "Goat" || a.breeds?.species?.species_name === "Sheep";
    const last = a.growth_logs[0];
    let nextDate = last ? addDays(last.recorded_date, 90) : addDays(a.date_of_birth, 60);
    let weight = last ? Number(last.weight_kg) : isSmall ? 3.5 : 40;

    while (nextDate <= CURRENT_DATE) {
      weight += isSmall ? 2 + frac(a.animal_id) * 2 : 25 + frac(a.animal_id + nextDate.getTime()) * 15;
      await prisma.growth_logs.create({
        data: {
          animal_id: a.animal_id,
          weight_kg: Number(weight.toFixed(2)),
          recorded_date: nextDate,
          notes: "Catch-up growth weigh-in",
        },
      });
      stats.growth++;
      nextDate = addDays(nextDate, 90);
    }
  }
}

async function minimalHealthCatchUp(stats: Record<string, number>) {
  const recent = await prisma.health_incidents.count({
    where: { incident_date: { gte: d("2026-07-01") } },
  });
  if (recent >= 2) return;

  const candidate = await prisma.animals.findFirst({
    where: {
      lifecycle_stage: "Lactating",
      is_active: true,
      gender: "F",
      tag_number: { not: { startsWith: "GVD-E2E" } },
    },
    orderBy: { animal_id: "asc" },
  });
  if (!candidate) return;

  const incidentDate = d("2026-08-10");
  const incident = await prisma.health_incidents.create({
    data: {
      animal_id: candidate.animal_id,
      incident_date: incidentDate,
      disease_name: "Mastitis",
      severity: "Mild",
      symptoms: "Slight swelling in one quarter; treated promptly.",
      treatment: "Intramammary antibiotic tube.",
      status: "Resolved",
    },
  });
  await prisma.treatment_records.create({
    data: {
      incident_id: incident.incident_id,
      dosage: "3 applications / 24h",
      treatment_date: d("2026-08-11"),
      remarks: "Recovered; milk withheld 72h.",
    },
  });
  stats.health++;
  stats.treatments++;
}

async function validate(): Promise<string[]> {
  const issues: string[] = [];
  const futureMilk = await prisma.milk_logs.count({
    where: { production_date: { gt: CURRENT_DATE } },
  });
  if (futureMilk > 0) issues.push(`Future milk records: ${futureMilk}`);

  const maleMilk = await prisma.milk_logs.count({
    where: { animals: { gender: "M" } },
  });
  if (maleMilk > 0) issues.push(`Milk records for males: ${maleMilk}`);

  const dupMilk = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) as c FROM (
      SELECT animal_id, production_date, session, COUNT(*) n
      FROM milk_logs GROUP BY 1,2,3 HAVING COUNT(*) > 1
    ) d`;
  if (Number(dupMilk[0]?.c ?? 0) > 0) issues.push("Duplicate milk session rows found");

  const overdueStill = await prisma.pregnancy_records.count({
    where: {
      status: { in: [...ACTIVE_PREGNANCY_STATUSES] },
      expected_delivery_date: { lt: CURRENT_DATE },
    },
  });
  if (overdueStill > 0) issues.push(`Still overdue active pregnancies: ${overdueStill}`);

  return issues;
}

export async function catchUpFarmToDate() {
  const before = await collectAudit();
  const stats = {
    milk: 0,
    breeding: 0,
    pregnancies: 0,
    pregnancyUpdates: 0,
    calvings: 0,
    newAnimals: 0,
    growth: 0,
    heat: 0,
    vaccinations: 0,
    health: 0,
    treatments: 0,
  };

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(before, null, 2));

  await confirmPendingPregnancies(stats);
  await resolveOverdueCalvings(stats);
  await extendMilkProduction(stats);
  await continueHeatCycles(stats);
  await continueBreeding(stats);
  await catchUpVaccinations(stats);
  await continueGrowth(stats);
  await minimalHealthCatchUp(stats);
  await syncAnimalDates(CURRENT_DATE);

  const after = await collectAudit();
  const validation = await validate();

  const report = { before, generated: stats, after, validation };
  console.log("\n=== GENERATED ===");
  console.log(JSON.stringify(stats, null, 2));
  console.log("\n=== AFTER (current date) ===");
  console.log(JSON.stringify(after, null, 2));
  console.log("\n=== VALIDATION ===");
  console.log(validation.length ? validation : ["All checks passed"]);
  return report;
}

async function main() {
  await catchUpFarmToDate();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
