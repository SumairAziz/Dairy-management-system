/**
 * Deterministic end-to-end lifecycle test animal (single cow, full history).
 *
 * Idempotent: removes only tags in E2E_LIFECYCLE_TAGS before recreating.
 * Safe to call after the main demo seed or standalone when farms/breeds exist.
 *
 * Run: npm run db:seed:e2e-lifecycle
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import * as breedingService from "@/services/breeding.service";
import * as pregnancyService from "@/services/pregnancy.service";
import * as calvingService from "@/services/calving.service";
import * as vaccinationService from "@/services/vaccination.service";
import {
  isActivePregnancy,
  getPregnantAnimalsFilter,
} from "@/lib/pregnancy-status";

export const E2E_LIFECYCLE_TAG = "GVD-E2E-LIFE";
export const E2E_OFFSPRING_TAG_1 = "GVD-E2E-C1";
export const E2E_OFFSPRING_TAG_2 = "GVD-E2E-C2";
const E2E_LIFECYCLE_TAGS = [E2E_LIFECYCLE_TAG, E2E_OFFSPRING_TAG_1, E2E_OFFSPRING_TAG_2] as const;

const GESTATION_DAYS = 283;
const VET = "Dr. Aisha Raza";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addDays(date: Date, days: number): Date {
  const x = new Date(date);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export interface E2eLifecycleReport {
  tag: string;
  birthDate: string;
  deathDate: string;
  events: Array<{ label: string; date: string }>;
  counts: {
    pregnancies: number;
    deliveredPregnancies: number;
    activePregnancies: number;
    calvings: number;
    offspring: number;
    heatCycles: number;
    breedingRecords: number;
    milkLogs: number;
    vaccinations: number;
    healthIncidents: number;
    treatments: number;
  };
  verification: {
    animalActive: boolean;
    lifecycleStage: string | null;
    deliveredNotActive: boolean;
    historyAccessible: boolean;
  };
  schemaGaps: string[];
}

async function purgeE2eLifecycleAnimal(farmId: number) {
  const animals = await prisma.animals.findMany({
    where: { farm_id: farmId, tag_number: { in: [...E2E_LIFECYCLE_TAGS] } },
  });
  if (animals.length === 0) return;

  const ids = animals.map((a) => a.animal_id);

  await prisma.milk_logs.deleteMany({ where: { animal_id: { in: ids } } });
  await prisma.growth_logs.deleteMany({ where: { animal_id: { in: ids } } });
  await prisma.heat_cycle_records.deleteMany({ where: { animal_id: { in: ids } } });

  const pregnancies = await prisma.pregnancy_records.findMany({
    where: { animal_id: { in: ids } },
    select: { pregnancy_id: true },
  });
  const pregnancyIds = pregnancies.map((p) => p.pregnancy_id);
  if (pregnancyIds.length) {
    await prisma.vaccination_records.deleteMany({ where: { pregnancy_id: { in: pregnancyIds } } });
  }

  const breedings = await prisma.breeding_records.findMany({
    where: { female_animal_id: { in: ids } },
    select: { breeding_id: true },
  });
  const breedingIds = breedings.map((b) => b.breeding_id);
  if (breedingIds.length) {
    await prisma.vaccination_records.deleteMany({ where: { breeding_id: { in: breedingIds } } });
  }

  await prisma.vaccination_records.deleteMany({ where: { animal_id: { in: ids } } });
  await prisma.calving_records.deleteMany({
    where: { OR: [{ mother_id: { in: ids } }, { calf_id: { in: ids } }] },
  });
  await prisma.pregnancy_records.deleteMany({ where: { animal_id: { in: ids } } });
  await prisma.breeding_records.deleteMany({ where: { female_animal_id: { in: ids } } });

  const incidents = await prisma.health_incidents.findMany({
    where: { animal_id: { in: ids } },
    select: { incident_id: true },
  });
  const incidentIds = incidents.map((i) => i.incident_id);
  if (incidentIds.length) {
    await prisma.treatment_records.deleteMany({ where: { incident_id: { in: incidentIds } } });
  }
  await prisma.health_incidents.deleteMany({ where: { animal_id: { in: ids } } });

  const offspring = animals.filter((a) => a.tag_number !== E2E_LIFECYCLE_TAG);
  for (const o of offspring) {
    await prisma.animals.delete({ where: { animal_id: o.animal_id } });
  }
  const mother = animals.find((a) => a.tag_number === E2E_LIFECYCLE_TAG);
  if (mother) {
    await prisma.animals.delete({ where: { animal_id: mother.animal_id } });
  }
}

async function seedMilkSessions(
  animalId: number,
  start: Date,
  days: number,
  baseLiters: number,
) {
  const rows: Array<{
    animal_id: number;
    production_date: Date;
    session: string;
    milk_liters: number;
    quality_grade: string;
  }> = [];
  for (let i = 0; i < days; i++) {
    const productionDate = addDays(start, i);
    const curve = Math.max(0.7, 1 - i / (days + 30));
    const dayTotal = baseLiters * curve;
    const splits: Array<[string, number]> = [
      ["Morning", 0.42],
      ["Afternoon", 0.28],
      ["Evening", 0.3],
    ];
    for (const [session, share] of splits) {
      rows.push({
        animal_id: animalId,
        production_date: productionDate,
        session,
        milk_liters: Number((dayTotal * share).toFixed(2)),
        quality_grade: "A",
      });
    }
  }
  await prisma.milk_logs.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

export async function seedE2eLifecycleAnimal(): Promise<E2eLifecycleReport> {
  const schemaGaps: string[] = [
    "No dedicated death/calving event table — end-of-life uses animals.lifecycle_stage = Deceased and is_active = false.",
    "Semen inventory is mock-only (semen_batch_id string on breeding_records).",
  ];

  const farm = await prisma.farms.findFirst({ where: { farm_name: "Green Valley Dairy" } });
  if (!farm) {
    throw new Error("E2E lifecycle seed requires Green Valley Dairy (run npm run db:seed first).");
  }

  const breed = await prisma.breeds.findFirst({
    where: { breed_name: "Holstein Friesian", species: { species_name: "Cow" } },
  });
  if (!breed) {
    throw new Error("E2E lifecycle seed requires Holstein Friesian breed.");
  }

  const calfUnit = await prisma.units.findFirst({
    where: { farm_id: farm.farm_id, unit_type: "Calf Shed" },
  });
  const milkUnit = await prisma.units.findFirst({
    where: { farm_id: farm.farm_id, unit_type: "Milking Unit" },
  });
  const bull = await prisma.animals.findFirst({
    where: {
      farm_id: farm.farm_id,
      gender: "M",
      lifecycle_stage: { in: ["Breeding Bull", "Bull"] },
    },
  });

  await purgeE2eLifecycleAnimal(farm.farm_id);

  const events: E2eLifecycleReport["events"] = [];

  const birthDate = d("2019-03-10");
  events.push({ label: "Birth", date: toDateStr(birthDate) });

  const mother = await prisma.animals.create({
    data: {
      farm_id: farm.farm_id,
      unit_id: calfUnit?.unit_id ?? null,
      breed_id: breed.breed_id,
      tag_number: E2E_LIFECYCLE_TAG,
      animal_name: "Lifecycle QA Cow",
      gender: "F",
      date_of_birth: birthDate,
      birth_weight_kg: 38.5,
      lifecycle_stage: "Calf",
      is_active: true,
      created_at: birthDate,
    },
  });

  const growthDates: Array<[string, number]> = [
    ["2019-06-10", 48],
    ["2019-09-10", 92],
    ["2019-12-10", 138],
    ["2020-03-10", 185],
    ["2020-09-10", 268],
    ["2021-01-05", 310],
  ];
  for (const [iso, kg] of growthDates) {
    await prisma.growth_logs.create({
      data: {
        animal_id: mother.animal_id,
        weight_kg: kg,
        recorded_date: d(iso),
        notes: "E2E lifecycle weigh-in",
      },
    });
    events.push({ label: "Growth", date: iso });
  }

  await vaccinationService.create({
    animal_id: mother.animal_id,
    vaccine_name: "Clostridial (Calf)",
    vaccination_date: toDateStr(d("2019-04-12")),
    next_due_date: toDateStr(d("2019-10-12")),
    administered_by: VET,
    notes: "Calf starter vaccination",
    source: null,
  } as never);
  await vaccinationService.create({
    animal_id: mother.animal_id,
    vaccine_name: "IBR/BVD (Calf)",
    vaccination_date: toDateStr(d("2019-06-15")),
    next_due_date: toDateStr(d("2020-06-15")),
    administered_by: VET,
    notes: "Booster",
    source: null,
  } as never);
  events.push({ label: "Calf vaccination (1)", date: "2019-04-12" });
  events.push({ label: "Calf vaccination (2)", date: "2019-06-15" });

  const calfIncident = await prisma.health_incidents.create({
    data: {
      animal_id: mother.animal_id,
      incident_date: d("2019-08-22"),
      disease_name: "Calf Scours",
      severity: "Mild",
      symptoms: "Loose stool, mild dehydration.",
      treatment: "Electrolytes and monitoring.",
      status: "Resolved",
    },
  });
  await prisma.treatment_records.create({
    data: {
      incident_id: calfIncident.incident_id,
      dosage: "2 L electrolyte / 12h",
      treatment_date: d("2019-08-23"),
      remarks: "Recovered within 48 hours.",
    },
  });
  events.push({ label: "Calf health incident", date: "2019-08-22" });

  await prisma.animals.update({
    where: { animal_id: mother.animal_id },
    data: { lifecycle_stage: "Heifer", unit_id: milkUnit?.unit_id ?? calfUnit?.unit_id ?? null },
  });
  events.push({ label: "Heifer stage", date: "2020-03-10" });

  const heatDates = ["2020-07-18", "2020-08-24", "2020-12-30", "2022-05-03"] as const;
  for (const iso of heatDates) {
    const start = d(iso);
    await prisma.heat_cycle_records.create({
      data: {
        animal_id: mother.animal_id,
        heat_start_date: start,
        heat_end_date: addDays(start, 1),
        detection_method: "Visual Observation",
        confidence_score: 4.2,
        notes: "E2E lifecycle heat",
      },
    });
    events.push({ label: "Heat cycle", date: iso });
  }

  const firstBreedingDate = d("2021-01-08");
  events.push({ label: "First breeding (AI)", date: toDateStr(firstBreedingDate) });
  const breeding1 = await breedingService.create({
    female_animal_id: mother.animal_id,
    male_animal_id: bull?.animal_id ?? null,
    breeding_date: toDateStr(firstBreedingDate),
    method: "Artificial Insemination",
    result: "Success",
    semen_batch_id: "SEM-HOL-1042",
    notes: "First lactation cycle — AI",
  });

  const firstConfirm = d("2021-02-18");
  const firstEdd = addDays(firstBreedingDate, GESTATION_DAYS);
  events.push({ label: "First pregnancy confirmed", date: toDateStr(firstConfirm) });
  const pregnancy1 = await pregnancyService.create({
    animal_id: mother.animal_id,
    breeding_id: breeding1.breeding_id,
    insemination_date: toDateStr(firstBreedingDate),
    pregnancy_confirmed: true,
    confirmation_date: toDateStr(firstConfirm),
    expected_delivery_date: toDateStr(firstEdd),
    status: "Confirmed",
  } as never);

  const firstCalvingDate = addDays(firstEdd, -2);
  events.push({ label: "First calving", date: toDateStr(firstCalvingDate) });

  const calf1 = await prisma.animals.create({
    data: {
      farm_id: farm.farm_id,
      unit_id: calfUnit?.unit_id ?? null,
      breed_id: breed.breed_id,
      tag_number: E2E_OFFSPRING_TAG_1,
      animal_name: "Lifecycle QA Calf 1",
      gender: "F",
      date_of_birth: firstCalvingDate,
      mother_id: mother.animal_id,
      father_id: bull?.animal_id ?? null,
      birth_weight_kg: 36,
      lifecycle_stage: "Calf",
      is_active: true,
      created_at: firstCalvingDate,
    },
  });

  await calvingService.create({
    mother_id: mother.animal_id,
    pregnancy_id: pregnancy1.pregnancy_id,
    calving_date: toDateStr(firstCalvingDate),
    outcome: "Live Birth",
    calf_gender: "F",
    calf_tag: E2E_OFFSPRING_TAG_1,
    calf_id: calf1.animal_id,
    notes: "First E2E calving — heifer calf",
  });

  await prisma.animals.update({
    where: { animal_id: mother.animal_id },
    data: { lifecycle_stage: "Lactating" },
  });

  const milk1Days = await seedMilkSessions(mother.animal_id, addDays(firstCalvingDate, 3), 21, 26);
  events.push({ label: "Lactation milk (1st)", date: toDateStr(addDays(firstCalvingDate, 3)) });

  const secondBreedingDate = d("2022-05-06");
  events.push({ label: "Second breeding (AI)", date: toDateStr(secondBreedingDate) });
  const breeding2 = await breedingService.create({
    female_animal_id: mother.animal_id,
    male_animal_id: bull?.animal_id ?? null,
    breeding_date: toDateStr(secondBreedingDate),
    method: "Artificial Insemination",
    result: "Success",
    semen_batch_id: "SEM-HOL-1108",
    notes: "Second lactation cycle — AI",
  });

  const secondConfirm = d("2022-06-16");
  const secondEdd = addDays(secondBreedingDate, GESTATION_DAYS);
  events.push({ label: "Second pregnancy confirmed", date: toDateStr(secondConfirm) });
  const pregnancy2 = await pregnancyService.create({
    animal_id: mother.animal_id,
    breeding_id: breeding2.breeding_id,
    insemination_date: toDateStr(secondBreedingDate),
    pregnancy_confirmed: true,
    confirmation_date: toDateStr(secondConfirm),
    expected_delivery_date: toDateStr(secondEdd),
    status: "Confirmed",
  } as never);

  const secondCalvingDate = addDays(secondEdd, -1);
  events.push({ label: "Second calving", date: toDateStr(secondCalvingDate) });

  const calf2 = await prisma.animals.create({
    data: {
      farm_id: farm.farm_id,
      unit_id: calfUnit?.unit_id ?? null,
      breed_id: breed.breed_id,
      tag_number: E2E_OFFSPRING_TAG_2,
      animal_name: "Lifecycle QA Calf 2",
      gender: "M",
      date_of_birth: secondCalvingDate,
      mother_id: mother.animal_id,
      father_id: bull?.animal_id ?? null,
      birth_weight_kg: 39,
      lifecycle_stage: "Calf",
      is_active: true,
      created_at: secondCalvingDate,
    },
  });

  await calvingService.create({
    mother_id: mother.animal_id,
    pregnancy_id: pregnancy2.pregnancy_id,
    calving_date: toDateStr(secondCalvingDate),
    outcome: "Live Birth",
    calf_gender: "M",
    calf_tag: E2E_OFFSPRING_TAG_2,
    calf_id: calf2.animal_id,
    notes: "Second E2E calving — bull calf",
  });

  const milk2Days = await seedMilkSessions(mother.animal_id, addDays(secondCalvingDate, 5), 14, 24);
  events.push({ label: "Lactation milk (2nd)", date: toDateStr(addDays(secondCalvingDate, 5)) });

  await vaccinationService.create({
    animal_id: mother.animal_id,
    vaccine_name: "Foot and Mouth Disease (FMD)",
    vaccination_date: toDateStr(d("2023-01-20")),
    next_due_date: toDateStr(d("2024-01-20")),
    administered_by: VET,
    notes: "Annual FMD",
    source: null,
  } as never);
  await vaccinationService.create({
    animal_id: mother.animal_id,
    vaccine_name: "Hemorrhagic Septicemia (HS)",
    vaccination_date: toDateStr(d("2024-03-05")),
    next_due_date: toDateStr(d("2025-03-05")),
    administered_by: VET,
    notes: "Annual HS",
    source: null,
  } as never);

  const lateIncident = await prisma.health_incidents.create({
    data: {
      animal_id: mother.animal_id,
      incident_date: d("2024-06-12"),
      disease_name: "Mastitis",
      severity: "Moderate",
      symptoms: "Swollen quarter, reduced milk yield.",
      treatment: "Intramammary antibiotics and NSAID.",
      status: "Resolved",
    },
  });
  await prisma.treatment_records.create({
    data: {
      incident_id: lateIncident.incident_id,
      dosage: "5 days intramammary course",
      treatment_date: d("2024-06-13"),
      remarks: "Culture negative; full recovery.",
    },
  });
  events.push({ label: "Late-life mastitis", date: "2024-06-12" });

  const deathDate = d("2025-11-08");
  events.push({ label: "Death / retirement", date: toDateStr(deathDate) });
  await prisma.animals.update({
    where: { animal_id: mother.animal_id },
    data: {
      lifecycle_stage: "Deceased",
      is_active: false,
      lactation_status: null,
      pregnancy_status: null,
      updated_at: deathDate,
    },
  });

  const animalId = mother.animal_id;
  const [
    pregnancies,
    deliveredPregnancies,
    activePregnancies,
    calvings,
    offspring,
    heatCycles,
    breedingRecords,
    milkLogs,
    vaccinations,
    healthIncidents,
    treatments,
    refreshed,
    activePregnantAnimals,
  ] = await Promise.all([
    prisma.pregnancy_records.count({ where: { animal_id: animalId } }),
    prisma.pregnancy_records.count({ where: { animal_id: animalId, status: "Delivered" } }),
    prisma.pregnancy_records.count({
      where: { animal_id: animalId, status: { in: ["Pending", "Confirmed", "In Progress"] } },
    }),
    prisma.calving_records.count({ where: { mother_id: animalId } }),
    prisma.animals.count({ where: { mother_id: animalId } }),
    prisma.heat_cycle_records.count({ where: { animal_id: animalId } }),
    prisma.breeding_records.count({ where: { female_animal_id: animalId } }),
    prisma.milk_logs.count({ where: { animal_id: animalId } }),
    prisma.vaccination_records.count({ where: { animal_id: animalId } }),
    prisma.health_incidents.count({ where: { animal_id: animalId } }),
    prisma.treatment_records.count({
      where: { health_incidents: { animal_id: animalId } },
    }),
    prisma.animals.findUnique({ where: { animal_id: animalId } }),
    prisma.animals.count({
      where: { animal_id: animalId, ...getPregnantAnimalsFilter() },
    }),
  ]);

  const deliveredRows = await prisma.pregnancy_records.findMany({
    where: { animal_id: animalId },
    select: { pregnancy_id: true, status: true },
  });
  const deliveredNotActive = deliveredRows.every(
    (p) => !isActivePregnancy({ status: p.status }),
  );

  console.log("  E2E lifecycle animal seeded:", E2E_LIFECYCLE_TAG);
  console.log(`    pregnancies: ${pregnancies} (delivered: ${deliveredPregnancies}, active: ${activePregnancies})`);
  console.log(`    calvings: ${calvings}, offspring: ${offspring}, heat: ${heatCycles}, breeding: ${breedingRecords}`);
  console.log(`    milk logs: ${milkLogs} (seeded blocks: ${milk1Days + milk2Days})`);
  console.log(`    vaccinations: ${vaccinations}, health: ${healthIncidents}, treatments: ${treatments}`);
  console.log(`    active after death: ${refreshed?.is_active}, stage: ${refreshed?.lifecycle_stage}`);
  console.log(`    still in active-pregnant filter: ${activePregnantAnimals}`);

  return {
    tag: E2E_LIFECYCLE_TAG,
    birthDate: toDateStr(birthDate),
    deathDate: toDateStr(deathDate),
    events,
    counts: {
      pregnancies,
      deliveredPregnancies,
      activePregnancies,
      calvings,
      offspring,
      heatCycles,
      breedingRecords,
      milkLogs,
      vaccinations,
      healthIncidents,
      treatments,
    },
    verification: {
      animalActive: refreshed?.is_active ?? true,
      lifecycleStage: refreshed?.lifecycle_stage ?? null,
      deliveredNotActive: deliveredNotActive && activePregnancies === 0,
      historyAccessible:
        pregnancies >= 2 &&
        calvings >= 2 &&
        milkLogs > 0 &&
        growthDates.length > 0,
    },
    schemaGaps,
  };
}

async function mainStandalone() {
  const report = await seedE2eLifecycleAnimal();
  console.log("\n──────── E2E lifecycle report ────────");
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  mainStandalone()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
