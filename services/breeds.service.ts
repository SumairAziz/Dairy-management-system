import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { CreateBreedInput, UpdateBreedInput } from "@/validators/breeds.validator";
import { NotFoundError } from "@/lib/errors";

export async function findAll(speciesId?: number) {
  const data = await prisma.breeds.findMany({
    where: speciesId ? { species_id: speciesId } : undefined,
    orderBy: { breed_id: "asc" },
    include: { species: true },
  });
  return serialize(data);
}

export async function findById(id: number) {
  const row = await prisma.breeds.findUnique({
    where: { breed_id: id },
    include: { species: true },
  });
  if (!row) throw new NotFoundError("Breed");
  return serialize(row);
}

export async function create(data: CreateBreedInput) {
  const created = await prisma.breeds.create({ data });
  return serialize(created);
}

export async function update(id: number, data: UpdateBreedInput) {
  await findById(id); // ensure exists
  const updated = await prisma.breeds.update({
    where: { breed_id: id },
    data,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.breeds.delete({ where: { breed_id: id } });
}