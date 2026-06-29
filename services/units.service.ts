import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type {
  CreateUnitInput,
  UpdateUnitInput,
} from "@/validators/units.validator";
import { NotFoundError } from "@/lib/errors";

export async function findAll(farmId?: number) {
  const data = await prisma.units.findMany({
    where: farmId ? { farm_id: farmId } : undefined,
    orderBy: { unit_id: "asc" },
    include: { farms: true, _count: { select: { animals: true } } },
  });
  return serialize(data);
}

export async function findById(id: number) {
  const unit = await prisma.units.findUnique({
    where: { unit_id: id },
    include: { farms: true },
  });
  if (!unit) throw new NotFoundError("Unit");

  const [animals, milk, lifecycle] = await Promise.all([
    prisma.animals.findMany({
      where: { unit_id: id, is_active: true },
      include: {
        breeds: { include: { species: true } },
        health_incidents: { orderBy: { incident_id: "desc" }, take: 1 },
        vaccination_records: { orderBy: { vaccination_id: "desc" }, take: 1 },
        growth_logs: { orderBy: { recorded_date: "desc" }, take: 1 },
        pregnancy_records: { orderBy: { pregnancy_id: "desc" }, take: 1 },
        heat_cycle_records: { orderBy: { heat_cycle_id: "desc" }, take: 1 },
        milk_logs: {
          orderBy: { production_date: "desc" },
          take: 1,
        },
      },
    }),
    prisma.milk_logs.aggregate({
      _sum: { milk_liters: true },
      where: { animals: { unit_id: id, is_active: true } },
    }),
    prisma.animals.groupBy({
      by: ["lifecycle_stage"],
      _count: true,
      where: { unit_id: id, is_active: true },
    }),
  ]);

  return serialize({
    unit,
    animals,
    stats: {
      occupancy: animals.length,
      maxCapacity: unit.capacity ?? 0,
      dailyMilk: Number(milk._sum.milk_liters ?? 0),
      lifecycle,
    },
  });
}

export async function create(data: CreateUnitInput) {
  const created = await prisma.units.create({ data });
  return serialize(created);
}

export async function update(id: number, data: UpdateUnitInput) {
  await findById(id); // ensure exists
  const updated = await prisma.units.update({
    where: { unit_id: id },
    data,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.units.delete({ where: { unit_id: id } });
}
