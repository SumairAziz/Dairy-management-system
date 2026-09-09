import "dotenv/config";
import { prisma } from "@/lib/db";
import { ACTIVE_PREGNANCY_STATUSES } from "@/lib/pregnancy-status";

const TODAY = new Date("2026-08-24T00:00:00.000Z");

async function audit() {
  const farms = await prisma.farms.count();
  const animals = await prisma.animals.findMany({
    select: {
      animal_id: true,
      tag_number: true,
      gender: true,
      lifecycle_stage: true,
      is_active: true,
      date_of_birth: true,
      pregnancy_status: true,
      lactation_status: true,
    },
  });

  const byStage: Record<string, number> = {};
  for (const a of animals) {
    const k = a.lifecycle_stage ?? "null";
    byStage[k] = (byStage[k] ?? 0) + 1;
  }

  const latest = {
    milk: await prisma.milk_logs.aggregate({ _max: { production_date: true } }),
    breeding: await prisma.breeding_records.aggregate({ _max: { breeding_date: true } }),
    pregnancy: await prisma.pregnancy_records.aggregate({ _max: { insemination_date: true } }),
    calving: await prisma.calving_records.aggregate({ _max: { calving_date: true } }),
    heat: await prisma.heat_cycle_records.aggregate({ _max: { heat_start_date: true } }),
    vaccination: await prisma.vaccination_records.aggregate({ _max: { vaccination_date: true } }),
    growth: await prisma.growth_logs.aggregate({ _max: { recorded_date: true } }),
    health: await prisma.health_incidents.aggregate({ _max: { incident_date: true } }),
    treatment: await prisma.treatment_records.aggregate({ _max: { treatment_date: true } }),
    birth: await prisma.animals.aggregate({ _max: { date_of_birth: true } }),
  };

  const pregnantRecords = await prisma.pregnancy_records.findMany({
    where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
    include: { animals: { select: { tag_number: true } } },
  });

  const overduePregnancies = await prisma.pregnancy_records.findMany({
    where: {
      status: { in: [...ACTIVE_PREGNANCY_STATUSES] },
      expected_delivery_date: { lt: TODAY },
    },
    include: { animals: { select: { tag_number: true } } },
  });

  const report = {
    farms,
    totalAnimals: animals.length,
    activeAnimals: animals.filter((a) => a.is_active !== false).length,
    inactiveAnimals: animals.filter((a) => a.is_active === false).length,
    males: animals.filter((a) => a.gender === "M").length,
    females: animals.filter((a) => a.gender === "F").length,
    byStage,
    latest: {
      milk: latest.milk._max.production_date,
      breeding: latest.breeding._max.breeding_date,
      pregnancy: latest.pregnancy._max.insemination_date,
      calving: latest.calving._max.calving_date,
      heat: latest.heat._max.heat_start_date,
      vaccination: latest.vaccination._max.vaccination_date,
      growth: latest.growth._max.recorded_date,
      health: latest.health._max.incident_date,
      treatment: latest.treatment._max.treatment_date,
      birth: latest.birth._max.date_of_birth,
    },
    pregnantCount: pregnantRecords.length,
    pregnant: pregnantRecords.map((p) => ({
      tag: p.animals?.tag_number,
      status: p.status,
      edd: p.expected_delivery_date,
      insem: p.insemination_date,
    })),
    overduePregnancies: overduePregnancies.map((p) => ({
      tag: p.animals?.tag_number,
      edd: p.expected_delivery_date,
      status: p.status,
    })),
    lactatingCount: animals.filter(
      (a) => a.lifecycle_stage === "Lactating" || a.lactation_status === "LACTATING",
    ).length,
    dryCount: animals.filter(
      (a) => a.lifecycle_stage === "Dry" || a.lactation_status === "DRY",
    ).length,
  };

  console.log(JSON.stringify(report, null, 2));
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
