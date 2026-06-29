import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { CreateSpeciesInput, UpdateSpeciesInput } from "@/validators/species.validator";
import { NotFoundError } from "@/lib/errors";

export async function findAll(speciesId?: number) {
  const data = await prisma.species.findMany({
    where: speciesId ? { species_id: speciesId } : undefined,
    orderBy: { species_id: "asc" },
    include: { breeds: { where: { is_active: true } } },
  });
  return serialize(data);
}

export async function findById(id: number) {
  const row = await prisma.species.findUnique({
    where: { species_id: id },
    include: { breeds: true },
  });
  if (!row) throw new NotFoundError("Species");
  return serialize(row);
}

export async function create(data: CreateSpeciesInput) {
  const created = await prisma.species.create({ data });
  return serialize(created);
}

export async function update(id: number, data: UpdateSpeciesInput) {
  await findById(id); // ensure exists
  const updated = await prisma.species.update({
    where: { species_id: id },
    data,
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id); // ensure exists
  await prisma.species.delete({ where: { species_id: id } });
}