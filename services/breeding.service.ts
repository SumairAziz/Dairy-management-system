import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { BreedingQueryParams } from "@/validators";
import type { CreateBreedingRecordInput, UpdateBreedingRecordInput } from "@/validators/breeding.validator";
import { NotFoundError } from "@/lib/errors";

export async function findAll(params: BreedingQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Parameters<typeof prisma.breeding_records.findMany>[0]["where"] = {};

  if (filters.female_animal_id) where.female_animal_id = filters.female_animal_id;
  if (filters.male_animal_id) where.male_animal_id = filters.male_animal_id;
  if (filters.method) where.method = { contains: filters.method, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.breeding_records.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { breeding_date: "desc" },
      include: {
        animals_breeding_records_female_animal_idToanimals: { select: { animal_id: true, tag_number: true, animal_name: true } },
        animals_breeding_records_male_animal_idToanimals: { select: { animal_id: true, tag_number: true, animal_name: true } },
      },
    }),
    prisma.breeding_records.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const record = await prisma.breeding_records.findUnique({
    where: { breeding_id: id },
    include: {
      animals_breeding_records_female_animal_idToanimals: true,
      animals_breeding_records_male_animal_idToanimals: true,
    },
  });
  if (!record) throw new NotFoundError("Breeding record");
  return serialize(record);
}

export async function create(data: CreateBreedingRecordInput) {
  const { female_animal_id, male_animal_id, ...rest } = data;
  const created = await prisma.breeding_records.create({
    data: {
      ...rest,
      breeding_date: rest.breeding_date ? new Date(rest.breeding_date) : null,
      animals_breeding_records_female_animal_idToanimals: female_animal_id
        ? { connect: { animal_id: female_animal_id } }
        : undefined,
      animals_breeding_records_male_animal_idToanimals: male_animal_id
        ? { connect: { animal_id: male_animal_id } }
        : undefined,
    },
  });
  return serialize(created);
}

export async function update(id: number, data: UpdateBreedingRecordInput) {
  await findById(id);
  const { female_animal_id, male_animal_id, ...rest } = data;
  const updated = await prisma.breeding_records.update({
    where: { breeding_id: id },
    data: {
      ...rest,
      breeding_date: rest.breeding_date ? new Date(rest.breeding_date) : null,
      animals_breeding_records_female_animal_idToanimals: female_animal_id
        ? { connect: { animal_id: female_animal_id } }
        : { disconnect: true },
      animals_breeding_records_male_animal_idToanimals: male_animal_id
        ? { connect: { animal_id: male_animal_id } }
        : { disconnect: true },
    },
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.breeding_records.delete({ where: { breeding_id: id } });
}