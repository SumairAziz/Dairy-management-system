import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { HeatCycleQueryParams } from "@/validators";
import type { CreateHeatCycleInput, UpdateHeatCycleInput } from "@/validators/heat-cycle.validator";
import { NotFoundError } from "@/lib/errors";

export async function findAll(params: HeatCycleQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Parameters<typeof prisma.heat_cycle_records.findMany>[0]["where"] = {};

  if (filters.animal_id) where.animal_id = filters.animal_id;
  if (filters.date_from || filters.date_to) {
    where.heat_start_date = {};
    if (filters.date_from) (where.heat_start_date as { gte?: Date }).gte = new Date(filters.date_from);
    if (filters.date_to) (where.heat_start_date as { lte?: Date }).lte = new Date(filters.date_to);
  }

  const [data, total] = await Promise.all([
    prisma.heat_cycle_records.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { heat_start_date: "desc" },
      include: { animals: { select: { animal_id: true, tag_number: true, animal_name: true } } },
    }),
    prisma.heat_cycle_records.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const record = await prisma.heat_cycle_records.findUnique({
    where: { heat_cycle_id: id },
    include: { animals: true },
  });
  if (!record) throw new NotFoundError("Heat cycle record");
  return serialize(record);
}

export async function create(data: CreateHeatCycleInput) {
  const prismaData = {
    ...data,
    heat_start_date: data.heat_start_date ? new Date(data.heat_start_date) : null,
    heat_end_date: data.heat_end_date ? new Date(data.heat_end_date) : null,
  };
  const created = await prisma.heat_cycle_records.create({ data: prismaData });
  return serialize(created);
}

export async function update(id: number, data: UpdateHeatCycleInput) {
  await findById(id); // ensure exists
  const prismaData = {
    ...data,
    heat_start_date: data.heat_start_date ? new Date(data.heat_start_date) : null,
    heat_end_date: data.heat_end_date ? new Date(data.heat_end_date) : null,
  };
  const updated = await prisma.heat_cycle_records.update({
    where: { heat_cycle_id: id },
    data: prismaData,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.heat_cycle_records.delete({ where: { heat_cycle_id: id } });
}