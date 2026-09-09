import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { NotFoundError } from "@/lib/errors";
import type { VaccinationQueryParams, CreateVaccinationInput, UpdateVaccinationInput } from "@/validators/vaccination.validator";
import { buildVaccinationStatusWhere, countVaccinationRecordsByStatus } from "@/lib/vaccination-status";

export async function findAll(params: VaccinationQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Prisma.vaccination_recordsWhereInput = {};

  if (filters.animal_id) where.animal_id = filters.animal_id;
  if (filters.animal_search) {
    where.animals = {
      OR: [
        { tag_number: { contains: filters.animal_search, mode: "insensitive" } },
        { animal_name: { contains: filters.animal_search, mode: "insensitive" } },
      ],
    };
  }
  const vaccineQuery = filters.vaccine_search ?? filters.vaccine_name;
  if (vaccineQuery) {
    where.vaccine_name = { contains: vaccineQuery, mode: "insensitive" };
  }
  if (filters.source) where.source = filters.source;
  if (filters.pregnancy_id) where.pregnancy_id = filters.pregnancy_id;
  if (filters.upcoming === "true") {
    where.next_due_date = { gte: new Date() };
  }
  if (filters.status) {
    Object.assign(where, buildVaccinationStatusWhere(filters.status));
  }

  const [data, total] = await Promise.all([
    prisma.vaccination_records.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Pending/upcoming records (null vaccination_date) first, then most-recently-administered
      orderBy: [
        { vaccination_date: { sort: "desc", nulls: "first" } },
        { next_due_date: "asc" },
      ],
      include: { animals: { select: { animal_id: true, tag_number: true, animal_name: true } } },
    }),
    prisma.vaccination_records.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function getStatusCounts(now: Date = new Date()) {
  return countVaccinationRecordsByStatus(
    (where) => prisma.vaccination_records.count({ where }),
    now,
  );
}

export async function findById(id: number) {
  const record = await prisma.vaccination_records.findUnique({
    where: { vaccination_id: id },
    include: { animals: true },
  });
  if (!record) throw new NotFoundError("Vaccination record");
  return serialize(record);
}

export async function create(data: CreateVaccinationInput) {
  const created = await prisma.vaccination_records.create({
    data: {
      ...data,
      vaccination_date: data.vaccination_date ? new Date(data.vaccination_date) : null,
      next_due_date: data.next_due_date ? new Date(data.next_due_date) : null,
    },
  });
  return serialize(created);
}

export async function update(id: number, data: UpdateVaccinationInput) {
  await findById(id);
  const updated = await prisma.vaccination_records.update({
    where: { vaccination_id: id },
    data: {
      ...data,
      vaccination_date: data.vaccination_date ? new Date(data.vaccination_date) : null,
      next_due_date: data.next_due_date ? new Date(data.next_due_date) : null,
    },
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id);
  await prisma.vaccination_records.delete({ where: { vaccination_id: id } });
}
