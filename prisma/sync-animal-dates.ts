/**
 * Reconcile animals.* status fields and related DOBs from dated history records.
 *
 * Run: npm run db:sync-animals
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import {
  ACTIVE_PREGNANCY_STATUSES,
  isActivePregnancy,
  isDeliveredPregnancy,
  isFailedPregnancy,
} from "@/lib/pregnancy-status";
import { ageInMonths } from "@/lib/animal-rules";

const DEFAULT_TODAY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

function resolveAsOf(asOf?: Date): Date {
  if (asOf) return toDateOnly(asOf);
  if (process.env.SIMULATION_DATE) {
    return new Date(`${process.env.SIMULATION_DATE}T00:00:00.000Z`);
  }
  return DEFAULT_TODAY;
}

const TERMINAL_STAGES = new Set(["Deceased", "Sold", "Retired"]);
const CALF_MAX_MONTHS = 11;
const HEIFER_MAX_MONTHS = 29;

function toDateOnly(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

function inferLifecycleStage(input: {
  gender: string;
  date_of_birth: Date;
  lifecycle_stage: string | null;
  is_active: boolean | null;
  hasCalvingHistory: boolean;
  hasActivePregnancy: boolean;
  lactation_status: string | null;
}, asOf: Date): string | null {
  const stage = input.lifecycle_stage ?? "Calf";
  if (TERMINAL_STAGES.has(stage)) return stage;

  const months = ageInMonths(input.date_of_birth, asOf);

  if (input.gender === "M") {
    if (months >= 30) return stage === "Breeding Bull" ? "Breeding Bull" : "Bull";
    return "Calf";
  }

  if (input.hasActivePregnancy && months < HEIFER_MAX_MONTHS) {
    return "Pregnant Heifer";
  }

  if (input.hasCalvingHistory) {
    if (input.lactation_status === "DRY") return "Dry";
    return "Lactating";
  }

  if (months <= CALF_MAX_MONTHS) return "Calf";
  if (months <= HEIFER_MAX_MONTHS) return "Heifer";
  return "Dry";
}

function inferPregnancyStatus(
  pregnancies: Array<{ status: string | null }>,
): string | null {
  if (pregnancies.some((p) => isActivePregnancy({ status: p.status }))) {
    return "PREGNANT";
  }
  const sorted = [...pregnancies].sort((a, b) => {
    const aDelivered = isDeliveredPregnancy(a.status) ? 1 : 0;
    const bDelivered = isDeliveredPregnancy(b.status) ? 1 : 0;
    return bDelivered - aDelivered;
  });
  const latest = sorted[0];
  if (!latest) return null;
  if (isFailedPregnancy(latest.status)) return "FAILED";
  if (isDeliveredPregnancy(latest.status)) return "CALVED";
  return null;
}

function inferLactationStatus(input: {
  gender: string;
  lifecycle_stage: string | null;
  hasCalvingHistory: boolean;
  latestCalvingDate: Date | null;
}): string | null {
  if (input.gender !== "F" || !input.hasCalvingHistory) return null;
  if (input.lifecycle_stage === "Dry") return "DRY";
  if (input.latestCalvingDate) return "LACTATING";
  return null;
}

export async function syncAnimalDates(asOf?: Date) {
  const TODAY = resolveAsOf(asOf);
  const animals = await prisma.animals.findMany({
    include: {
      pregnancy_records: { select: { status: true, insemination_date: true } },
      calving_records_as_mother: { select: { calving_date: true, calving_id: true, calf_id: true } },
    },
  });

  let animalsUpdated = 0;
  let offspringDobFixed = 0;

  for (const animal of animals) {
    const isTerminal = TERMINAL_STAGES.has(animal.lifecycle_stage ?? "");

    const hasCalvingHistory = animal.calving_records_as_mother.length > 0;
    const latestCalving = animal.calving_records_as_mother.reduce<Date | null>((latest, row) => {
      if (!latest || row.calving_date > latest) return row.calving_date;
      return latest;
    }, null);

    const hasActivePregnancy = animal.pregnancy_records.some((p) =>
      (ACTIVE_PREGNANCY_STATUSES as readonly string[]).includes(p.status ?? ""),
    );

    let lifecycle_stage = animal.lifecycle_stage;
    let pregnancy_status = animal.pregnancy_status;
    let lactation_status = animal.lactation_status;
    let is_active = animal.is_active;

    if (!isTerminal) {
      pregnancy_status = inferPregnancyStatus(animal.pregnancy_records);

      lifecycle_stage =
        inferLifecycleStage({
          gender: animal.gender,
          date_of_birth: animal.date_of_birth,
          lifecycle_stage: animal.lifecycle_stage,
          is_active: animal.is_active,
          hasCalvingHistory,
          hasActivePregnancy,
          lactation_status: animal.lactation_status,
        }, TODAY) ?? animal.lifecycle_stage;

      lactation_status = inferLactationStatus({
        gender: animal.gender,
        lifecycle_stage,
        hasCalvingHistory,
        latestCalvingDate: latestCalving,
      });
    } else if (animal.lifecycle_stage === "Deceased" || animal.lifecycle_stage === "Sold") {
      is_active = false;
      lactation_status = null;
      pregnancy_status = null;
    }

    const patch: {
      lifecycle_stage?: string;
      pregnancy_status?: string | null;
      lactation_status?: string | null;
      is_active?: boolean;
    } = {};

    if (animal.lifecycle_stage !== lifecycle_stage && lifecycle_stage) {
      patch.lifecycle_stage = lifecycle_stage;
    }
    if (animal.pregnancy_status !== pregnancy_status) {
      patch.pregnancy_status = pregnancy_status;
    }
    if (animal.lactation_status !== lactation_status) {
      patch.lactation_status = lactation_status;
    }
    if (animal.is_active !== is_active && is_active !== undefined) {
      patch.is_active = is_active;
    }

    if (Object.keys(patch).length > 0) {
      await prisma.animals.update({
        where: { animal_id: animal.animal_id },
        data: patch,
      });
      animalsUpdated++;
    }
  }

  const calvings = await prisma.calving_records.findMany({
    where: { calf_id: { not: null } },
    include: { calf: { select: { animal_id: true, date_of_birth: true } } },
  });

  for (const calving of calvings) {
    if (!calving.calf) continue;
    const calvingDay = toDateOnly(calving.calving_date);
    const calfDob = toDateOnly(calving.calf.date_of_birth);
    if (calvingDay.getTime() !== calfDob.getTime()) {
      await prisma.animals.update({
        where: { animal_id: calving.calf.animal_id },
        data: { date_of_birth: calvingDay },
      });
      offspringDobFixed++;
    }
  }

  return { animalsUpdated, offspringDobFixed, total: animals.length };
}

async function main() {
  const result = await syncAnimalDates();
  console.log("Animal date sync complete.");
  console.log(`  animals reconciled: ${result.animalsUpdated} / ${result.total}`);
  console.log(`  offspring DOBs aligned to calving dates: ${result.offspringDobFixed}`);
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
