/**
 * Normalize unit names/types and animal-to-unit assignments from existing data.
 * Safe to run multiple times (idempotent).
 *
 * Run: npm run db:normalize-units
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

const CANONICAL_UNIT_TYPES = [
  "Milking Unit",
  "Calf Shed",
  "Dry Unit",
  "Bull Unit",
  "Maternity Unit",
  "Isolation Unit",
] as const;

type CanonicalUnitType = (typeof CANONICAL_UNIT_TYPES)[number];

const STAGE_TO_UNIT_TYPE: Record<string, CanonicalUnitType> = {
  Calf: "Calf Shed",
  Heifer: "Milking Unit",
  "Pregnant Heifer": "Maternity Unit",
  Lactating: "Milking Unit",
  Dry: "Dry Unit",
  Bull: "Bull Unit",
  "Breeding Bull": "Bull Unit",
};

const NAME_TO_UNIT_TYPE: Record<string, CanonicalUnitType> = {
  "main dairy shed": "Milking Unit",
  "milking unit": "Milking Unit",
  "calf shed": "Calf Shed",
  "dry animals unit": "Dry Unit",
  "dry unit": "Dry Unit",
  "bull unit": "Bull Unit",
  "pregnant animals unit": "Maternity Unit",
  "maternity unit": "Maternity Unit",
  "isolation unit": "Isolation Unit",
};

function inferTypeFromName(unitName: string): CanonicalUnitType | null {
  const key = unitName.trim().toLowerCase();
  return NAME_TO_UNIT_TYPE[key] ?? null;
}

function inferTypeFromAnimals(
  stages: Array<{ lifecycle_stage: string | null; count: number }>,
): CanonicalUnitType | null {
  const totals = new Map<string, number>();
  for (const row of stages) {
    if (!row.lifecycle_stage) continue;
    totals.set(row.lifecycle_stage, (totals.get(row.lifecycle_stage) ?? 0) + row.count);
  }
  if (totals.size === 0) return null;

  const bullCount =
    (totals.get("Bull") ?? 0) + (totals.get("Breeding Bull") ?? 0);
  const calfCount = totals.get("Calf") ?? 0;
  const dryCount = totals.get("Dry") ?? 0;
  const lactatingCount = totals.get("Lactating") ?? 0;
  const pregnantCount =
    (totals.get("Pregnant Heifer") ?? 0) + (totals.get("Pregnant") ?? 0);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);

  if (bullCount > 0 && bullCount >= total * 0.5) return "Bull Unit";
  if (calfCount >= total * 0.5) return "Calf Shed";
  if (dryCount >= total * 0.5) return "Dry Unit";
  if (pregnantCount >= total * 0.5) return "Maternity Unit";
  if (lactatingCount >= total * 0.5) return "Milking Unit";
  return null;
}

async function ensureFarmUnitType(
  farmId: number,
  unitType: CanonicalUnitType,
  unitName: string,
  capacity: number,
) {
  const existing = await prisma.units.findFirst({
    where: { farm_id: farmId, unit_type: unitType },
  });
  if (existing) return existing;

  return prisma.units.create({
    data: {
      farm_id: farmId,
      unit_name: unitName,
      unit_type: unitType,
      capacity,
      is_active: true,
    },
  });
}

async function main() {
  console.log("Normalizing unit types and animal assignments…");

  const units = await prisma.units.findMany({
    include: {
      animals: {
        where: { is_active: true },
        select: { animal_id: true, lifecycle_stage: true },
      },
    },
  });

  let typesFixed = 0;
  for (const unit of units) {
    const stageCounts = Object.entries(
      unit.animals.reduce<Record<string, number>>((acc, a) => {
        const stage = a.lifecycle_stage ?? "Unknown";
        acc[stage] = (acc[stage] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([lifecycle_stage, count]) => ({ lifecycle_stage, count }));

    const fromName = inferTypeFromName(unit.unit_name);
    const fromAnimals = inferTypeFromAnimals(stageCounts);
    const nextType = fromName ?? fromAnimals;

    if (nextType && unit.unit_type !== nextType) {
      await prisma.units.update({
        where: { unit_id: unit.unit_id },
        data: { unit_type: nextType, updated_at: new Date() },
      });
      console.log(
        `  unit #${unit.unit_id} "${unit.unit_name}": ${unit.unit_type} → ${nextType}`,
      );
      typesFixed++;
    }
  }

  const farms = await prisma.farms.findMany({ select: { farm_id: true, farm_name: true } });
  for (const farm of farms) {
    const farmUnits = await prisma.units.findMany({ where: { farm_id: farm.farm_id } });
    const unitByType = new Map(farmUnits.map((u) => [u.unit_type, u]));

    const needsDry = await prisma.animals.count({
      where: { farm_id: farm.farm_id, is_active: true, lifecycle_stage: "Dry" },
    });
    if (needsDry > 0 && !unitByType.has("Dry Unit")) {
      const created = await ensureFarmUnitType(farm.farm_id, "Dry Unit", "Dry Animals Unit", 10);
      unitByType.set("Dry Unit", created);
      console.log(`  created Dry Unit for farm "${farm.farm_name}"`);
    }

    const needsMilking = await prisma.animals.count({
      where: {
        farm_id: farm.farm_id,
        is_active: true,
        lifecycle_stage: { in: ["Lactating", "Heifer"] },
      },
    });
    if (needsMilking > 0 && !unitByType.has("Milking Unit")) {
      const created = await ensureFarmUnitType(
        farm.farm_id,
        "Milking Unit",
        "Main Dairy Shed",
        40,
      );
      unitByType.set("Milking Unit", created);
      console.log(`  created Milking Unit for farm "${farm.farm_name}"`);
    }
  }

  let moves = 0;
  const animals = await prisma.animals.findMany({
    where: { is_active: true, unit_id: { not: null } },
    select: { animal_id: true, farm_id: true, unit_id: true, lifecycle_stage: true, units: true },
  });

  for (const animal of animals) {
    const stage = animal.lifecycle_stage ?? "";
    const targetType = STAGE_TO_UNIT_TYPE[stage];
    if (!targetType) continue;

    const currentType = animal.units?.unit_type;
    if (currentType === targetType) continue;

    const targetUnit = await prisma.units.findFirst({
      where: { farm_id: animal.farm_id, unit_type: targetType },
      orderBy: { unit_id: "asc" },
    });
    if (!targetUnit || targetUnit.unit_id === animal.unit_id) continue;

    await prisma.animals.update({
      where: { animal_id: animal.animal_id },
      data: { unit_id: targetUnit.unit_id, updated_at: new Date() },
    });
    moves++;
  }

  // Bull units must not hold milking herd animals.
  const bullUnits = await prisma.units.findMany({
    where: { unit_type: "Bull Unit" },
    select: { unit_id: true, farm_id: true },
  });
  for (const bullUnit of bullUnits) {
    const misplaced = await prisma.animals.findMany({
      where: {
        unit_id: bullUnit.unit_id,
        is_active: true,
        lifecycle_stage: { notIn: ["Bull", "Breeding Bull"] },
      },
      select: { animal_id: true, lifecycle_stage: true },
    });
    for (const animal of misplaced) {
      const targetType = STAGE_TO_UNIT_TYPE[animal.lifecycle_stage ?? ""] ?? "Milking Unit";
      const targetUnit = await prisma.units.findFirst({
        where: { farm_id: bullUnit.farm_id, unit_type: targetType },
        orderBy: { unit_id: "asc" },
      });
      if (!targetUnit) continue;
      await prisma.animals.update({
        where: { animal_id: animal.animal_id },
        data: { unit_id: targetUnit.unit_id, updated_at: new Date() },
      });
      moves++;
    }
  }

  console.log(`Done. Unit types corrected: ${typesFixed}, animals reassigned: ${moves}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
