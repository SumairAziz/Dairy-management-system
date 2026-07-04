/**
 * Calving Service
 *
 * Recording a calving event cascades several automatic updates:
 *   • Mother's pregnancy_status → "CALVED"
 *   • Mother's lactation_status → "LACTATING"
 *   • Linked pregnancy_record: actual_delivery_date = calving_date, status = "Delivered"
 *   • Cancel any remaining pending auto-generated vaccination reminders from the
 *     pregnancy workflow that have not yet been administered (they're now moot).
 *
 * None of these are undoable via simple deletion of the calving record — the
 * animal state updates are intentional permanent history.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { NotFoundError } from "@/lib/errors";
import { cancelWorkflow as cancelPregnancyWorkflow } from "@/services/pregnancy-workflow.service";
import type { CreateCalvingInput, UpdateCalvingInput, CalvingQueryParams } from "@/validators/calving.validator";

export async function findAll(params: CalvingQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Prisma.calving_recordsWhereInput = {};

  if (filters.mother_id) where.mother_id = filters.mother_id;
  if (filters.pregnancy_id) where.pregnancy_id = filters.pregnancy_id;

  const [data, total] = await Promise.all([
    prisma.calving_records.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { calving_date: "desc" },
      include: {
        mother: { select: { animal_id: true, tag_number: true, animal_name: true } },
        calf: { select: { animal_id: true, tag_number: true, animal_name: true } },
        pregnancy_records: { select: { pregnancy_id: true, insemination_date: true, expected_delivery_date: true } },
      },
    }),
    prisma.calving_records.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const record = await prisma.calving_records.findUnique({
    where: { calving_id: id },
    include: {
      mother: true,
      calf: true,
      pregnancy_records: true,
    },
  });
  if (!record) throw new NotFoundError("Calving record");
  return serialize(record);
}

export async function create(data: CreateCalvingInput) {
  const calvingDate = new Date(data.calving_date);

  const created = await prisma.calving_records.create({
    data: {
      mother_id: data.mother_id,
      pregnancy_id: data.pregnancy_id ?? null,
      calving_date: calvingDate,
      outcome: data.outcome ?? null,
      calf_gender: data.calf_gender ?? null,
      calf_tag: data.calf_tag ?? null,
      calf_id: data.calf_id ?? null,
      notes: data.notes ?? null,
    },
  });

  // ── Cascade updates ──────────────────────────────────────────────────────

  // 1. Update mother's reproductive state
  await prisma.animals.update({
    where: { animal_id: data.mother_id },
    data: { pregnancy_status: "CALVED", lactation_status: "LACTATING" },
  }).catch((err) => console.error("[calving] Failed to update mother state:", err));

  // 2. Update linked pregnancy record to Delivered
  if (data.pregnancy_id) {
    await prisma.pregnancy_records.update({
      where: { pregnancy_id: data.pregnancy_id },
      data: {
        actual_delivery_date: calvingDate,
        status: "Delivered",
      },
    }).catch((err) => console.error("[calving] Failed to update pregnancy record:", err));

    // 3. Cancel any remaining pending pregnancy workflow vaccination reminders
    try {
      await cancelPregnancyWorkflow(data.pregnancy_id);
    } catch (err) {
      console.error("[calving] Failed to cancel pregnancy workflow:", err);
    }
  }

  // 4. Notify staff about successful calving
  const mother = await prisma.animals.findUnique({
    where: { animal_id: data.mother_id },
    select: { tag_number: true, animal_name: true },
  });
  const motherLabel = mother
    ? `#${mother.tag_number}${mother.animal_name ? ` (${mother.animal_name})` : ""}`
    : `Animal #${data.mother_id}`;

  const calfInfo = data.calf_tag
    ? ` Calf: ${data.calf_gender === "F" ? "Female" : data.calf_gender === "M" ? "Male" : "Unknown"} #${data.calf_tag}.`
    : "";

  const recipients = await prisma.users.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "VETERINARIAN"] }, is_active: true },
    select: { user_id: true },
  });

  const notifData = recipients.map((u) => ({
    user_id: u.user_id,
    type: "CALVING_RECORDED",
    title: "Calving Recorded",
    message: `${motherLabel} calved on ${data.calving_date}. Outcome: ${data.outcome ?? "Unspecified"}.${calfInfo} Animal is now lactating.`,
    entity_type: "calving",
    entity_id: created.calving_id,
  }));

  if (notifData.length > 0) {
    await prisma.notifications.createMany({ data: notifData }).catch(() => {});
  }

  return serialize(created);
}

export async function update(id: number, data: UpdateCalvingInput) {
  await findById(id);
  const updated = await prisma.calving_records.update({
    where: { calving_id: id },
    data: {
      ...data,
      calving_date: data.calving_date ? new Date(data.calving_date) : undefined,
    },
  });
  return serialize(updated);
}

export async function remove(id: number) {
  await findById(id);
  await prisma.calving_records.delete({ where: { calving_id: id } });
}
