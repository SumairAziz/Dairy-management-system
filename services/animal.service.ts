import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import type { AnimalQueryParams, CreateAnimalInput, UpdateAnimalInput } from "@/validators/animal.validator";

export async function findAll(params: AnimalQueryParams) {
  const { page, pageSize, sortBy, sortDir, ...filters } = params;
  const where: Prisma.animalsWhereInput = {};

  if (filters.farm_id) where.farm_id = filters.farm_id;
  if (filters.unit_id) where.unit_id = filters.unit_id;
  if (filters.breed_id) where.breed_id = filters.breed_id;
  if (filters.species_id) where.breeds = { species_id: filters.species_id };
  if (filters.gender) where.gender = filters.gender;
  if (filters.lifecycle_stage) where.lifecycle_stage = filters.lifecycle_stage;
  if (filters.tag_number) where.tag_number = { contains: filters.tag_number, mode: "insensitive" };
  if (filters.is_active !== undefined) where.is_active = filters.is_active === "true";

  const [data, total] = await Promise.all([
    prisma.animals.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortDir },
      include: {
        farms: true,
        units: true,
        breeds: { include: { species: true } },
      },
    }),
    prisma.animals.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const animal = await prisma.animals.findUnique({
    where: { animal_id: id },
    include: {
      farms: true,
      units: true,
      breeds: { include: { species: true } },
      animals_animals_mother_idToanimals: true,
      animals_animals_father_idToanimals: true,
      growth_logs: { orderBy: { recorded_date: "asc" } },
      health_incidents: { orderBy: { incident_date: "desc" } },
      other_animals_animals_mother_idToanimals: {
        select: { animal_id: true, tag_number: true },
      },
      other_animals_animals_father_idToanimals: {
        select: { animal_id: true, tag_number: true },
      },
      milk_logs: { orderBy: { production_date: "desc" }, take: 30 },
      vaccination_records: { orderBy: { vaccination_date: "desc" } },
      breeding_records_breeding_records_female_animal_idToanimals: true,
      breeding_records_breeding_records_male_animal_idToanimals: true,
      pregnancy_records: { orderBy: { insemination_date: "desc" } },
      heat_cycle_records: { orderBy: { heat_start_date: "desc" } },
    },
  });
  if (!animal) throw new NotFoundError("Animal");
  return serialize(animal);
}

export async function create(data: CreateAnimalInput) {
  const created = await prisma.animals.create({
    data: {
      ...data,
      date_of_birth: new Date(data.date_of_birth),
    },
  });
  return serialize(created);
}

export async function update(id: number, data: UpdateAnimalInput) {
  await findById(id);
  const prismaData: Prisma.animalsUpdateInput = { ...data };
  if (data.date_of_birth) prismaData.date_of_birth = new Date(data.date_of_birth);
  const updated = await prisma.animals.update({
    where: { animal_id: id },
    data: prismaData,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id);
  await prisma.animals.delete({ where: { animal_id: id } });
}