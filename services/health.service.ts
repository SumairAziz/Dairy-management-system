import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { CreateHealthIncidentInput, UpdateHealthIncidentInput } from "@/validators/health-incidents.validator";
import { NotFoundError } from "@/lib/errors";

export async function findByAnimal(animalId: number) {
  const incidents = await prisma.health_incidents.findMany({
    where: { animal_id: animalId },
    orderBy: { incident_date: "desc" },
  });
  return serialize(incidents);
}

export async function findById(incidentId: number) {
  const incident = await prisma.health_incidents.findUnique({
    where: { incident_id: incidentId },
  });
  if (!incident) throw new NotFoundError("Health incident");
  return serialize(incident);
}

export async function create(animalId: number, data: CreateHealthIncidentInput) {
  const prismaData = {
    animal_id: animalId,
    ...data,
    incident_date: data.incident_date ? new Date(data.incident_date) : null,
  };
  const created = await prisma.health_incidents.create({ data: prismaData });
  return serialize(created);
}

export async function update(incidentId: number, data: UpdateHealthIncidentInput) {
  await findById(incidentId); // ensure exists
  const prismaData = {
    ...data,
    incident_date: data.incident_date ? new Date(data.incident_date) : null,
  };
  const updated = await prisma.health_incidents.update({
    where: { incident_id: incidentId },
    data: prismaData,
  });
  return serialize(updated);
}

export async function remove(incidentId: number) {
  await findById(incidentId); // ensure exists
  await prisma.health_incidents.delete({ where: { incident_id: incidentId } });
}