import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { PregnancyQueryParams } from "@/validators";
import type { CreatePregnancyRecordInput, UpdatePregnancyRecordInput } from "@/validators/pregnancy.validator";
import { NotFoundError } from "@/lib/errors";

export async function findAll(params: PregnancyQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Parameters<typeof prisma.pregnancy_records.findMany>[0]["where"] = {};

  if (filters.animal_id) where.animal_id = filters.animal_id;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.pregnancy_records.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { insemination_date: "desc" },
      include: { animals: { select: { animal_id: true, tag_number: true, animal_name: true, breeds: { include: { species: true } } } } },
    }),
    prisma.pregnancy_records.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const record = await prisma.pregnancy_records.findUnique({
    where: { pregnancy_id: id },
    include: { animals: true },
  });
  if (!record) throw new NotFoundError("Pregnancy record");
  return serialize(record);
}

export async function create(data: CreatePregnancyRecordInput) {
  const prismaData = {
    ...data,
    insemination_date: new Date(data.insemination_date),
    confirmation_date: data.confirmation_date ? new Date(data.confirmation_date) : null,
    expected_delivery_date: data.expected_delivery_date ? new Date(data.expected_delivery_date) : null,
    actual_delivery_date: data.actual_delivery_date ? new Date(data.actual_delivery_date) : null,
  };
  const created = await prisma.pregnancy_records.create({ data: prismaData });
  return serialize(created);
}

export async function update(id: number, data: UpdatePregnancyRecordInput) {
  await findById(id);
  const updated = await prisma.pregnancy_records.update({
    where: { pregnancy_id: id },
    data: {
      ...data,
      insemination_date: data.insemination_date ? new Date(data.insemination_date) : undefined,
      confirmation_date: data.confirmation_date ? new Date(data.confirmation_date) : null,
      expected_delivery_date: data.expected_delivery_date ? new Date(data.expected_delivery_date) : null,
      actual_delivery_date: data.actual_delivery_date ? new Date(data.actual_delivery_date) : null,
    },
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.pregnancy_records.delete({ where: { pregnancy_id: id } });
}