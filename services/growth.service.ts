import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { CreateGrowthLogInput, UpdateGrowthLogInput } from "@/validators/growth-logs.validator";
import { NotFoundError } from "@/lib/errors";

export async function findByAnimal(animalId: number) {
  const logs = await prisma.growth_logs.findMany({
    where: { animal_id: animalId },
    orderBy: { recorded_date: "asc" },
  });
  return serialize(logs);
}

export async function findById(logId: number) {
  const log = await prisma.growth_logs.findUnique({
    where: { growth_log_id: logId },
  });
  if (!log) throw new NotFoundError("Growth log");
  return serialize(log);
}

export async function create(animalId: number, data: CreateGrowthLogInput) {
  const created = await prisma.growth_logs.create({
    data: {
      animal_id: animalId,
      weight_kg: data.weight_kg,
      recorded_date: new Date(data.recorded_date),
      notes: data.notes ?? null,
    },
  });
  return serialize(created);
}

export async function update(logId: number, data: UpdateGrowthLogInput) {
  await findById(logId); // ensure exists
  const updated = await prisma.growth_logs.update({
    where: { growth_log_id: logId },
    data: {
      ...data,
      recorded_date: data.recorded_date ? new Date(data.recorded_date) : undefined,
    },
  });
  return serialize(updated);
}

export async function remove(logId: number) {
  await findById(logId); // ensure exists
  await prisma.growth_logs.delete({ where: { growth_log_id: logId } });
}