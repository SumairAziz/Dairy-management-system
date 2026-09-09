import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { NotFoundError } from "@/lib/errors";
import { sumDailyMilkLiters } from "@/lib/milk-daily";
import type { CreateFarmInput, UpdateFarmInput } from "@/validators/farm.validator";

export async function findAll() {
  const farms = await prisma.farms.findMany({
    orderBy: { farm_id: "asc" },
    include: { _count: { select: { animals: true, units: true } } },
  });
  return serialize(farms);
}

export async function findById(id: number) {
  const [farm, animalCount, unitCount, dailyMilk, species, health] = await Promise.all([
    prisma.farms.findUnique({ where: { farm_id: id }, include: { units: true } }),
    prisma.animals.count({ where: { farm_id: id, is_active: true } }),
    prisma.units.count({ where: { farm_id: id } }),
    sumDailyMilkLiters({ farmId: id }),
    prisma.$queryRaw`
      SELECT s.species_name AS label, COUNT(a.animal_id)::int AS value
      FROM species s LEFT JOIN breeds b ON b.species_id=s.species_id
      LEFT JOIN animals a ON a.breed_id=b.breed_id AND a.farm_id=${id} AND a.is_active=TRUE
      GROUP BY s.species_name`,
    prisma.health_incidents.groupBy({
      by: ["status"],
      _count: true,
      where: { animals: { farm_id: id, is_active: true } },
    }),
  ]);
  if (!farm) throw new NotFoundError("Farm");
  return serialize({
    farm,
    stats: {
      animalCount,
      unitCount,
      dailyMilk,
      species,
      health,
    },
  });
}

export async function create(data: CreateFarmInput) {
  const created = await prisma.farms.create({ data });
  return serialize(created);
}

export async function update(id: number, data: UpdateFarmInput) {
  await findById(id);
  const updated = await prisma.farms.update({
    where: { farm_id: id },
    data,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id);
  await prisma.farms.delete({ where: { farm_id: id } });
}
