import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { PregnancyQueryParams } from "@/validators";
import type { CreatePregnancyRecordInput, UpdatePregnancyRecordInput } from "@/validators/pregnancy.validator";
import { NotFoundError } from "@/lib/errors";
import {
  triggerWorkflow,
  cancelWorkflow,
  updateWorkflowDates,
} from "@/services/pregnancy-workflow.service";
import {
  isActivePregnancy,
  isDeliveredPregnancy,
  isFailedPregnancy,
} from "@/lib/pregnancy-status";

export async function findAll(params: PregnancyQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Prisma.pregnancy_recordsWhereInput = {};

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

  if (data.status === "Confirmed") {
    // Update animal's pregnancy status
    await prisma.animals.update({
      where: { animal_id: created.animal_id },
      data: { pregnancy_status: "PREGNANT" },
    }).catch(() => {});

    // Create vaccination reminders (dry-off, pre-calving)
    try {
      await triggerWorkflow(
        created.pregnancy_id,
        created.animal_id,
        new Date(data.insemination_date),
        data.expected_delivery_date ? new Date(data.expected_delivery_date) : null,
      );
    } catch (err) {
      console.error("[pregnancy-workflow] create trigger failed:", err);
    }
  }

  return serialize(created);
}

export async function update(id: number, data: UpdatePregnancyRecordInput) {
  const old = await findById(id);

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

  // ── Workflow side effects ────────────────────────────────────────────────
  try {
    const wasConfirmed = (old as { status?: string | null }).status === "Confirmed";
    const nowConfirmed = data.status === "Confirmed";
    const oldStatus = (old as { status?: string | null }).status;
    const nowFailed = isFailedPregnancy(data.status) && !isFailedPregnancy(oldStatus);
    const nowDelivered = isDeliveredPregnancy(data.status) && !isDeliveredPregnancy(oldStatus);

    if (nowFailed) {
      // Pregnancy lost — clear the animal's pregnancy state
      await prisma.animals.update({
        where: { animal_id: updated.animal_id },
        data: { pregnancy_status: null },
      }).catch(() => {});
      await cancelWorkflow(id);
    } else if (nowDelivered) {
      // Manual Delivered edit (no calving record) — mark animal no longer pregnant
      await prisma.animals.update({
        where: { animal_id: updated.animal_id },
        data: { pregnancy_status: "CALVED", lactation_status: "LACTATING" },
      }).catch(() => {});
      await cancelWorkflow(id);
    } else if (!wasConfirmed && nowConfirmed) {
      // Newly confirmed: mark animal as pregnant + create reminders
      await prisma.animals.update({
        where: { animal_id: updated.animal_id },
        data: { pregnancy_status: "PREGNANT" },
      }).catch(() => {});

      const inseminationDate = new Date(
        data.insemination_date ?? (old as unknown as { insemination_date: string }).insemination_date,
      );
      const eddRaw =
        data.expected_delivery_date ??
        (old as { expected_delivery_date?: string | null }).expected_delivery_date ??
        null;

      await triggerWorkflow(
        id,
        updated.animal_id,
        inseminationDate,
        eddRaw ? new Date(eddRaw) : null,
      );
    } else if (wasConfirmed && data.expected_delivery_date) {
      const oldEdd = (old as { expected_delivery_date?: string | null }).expected_delivery_date;
      if (data.expected_delivery_date !== oldEdd?.slice(0, 10)) {
        await updateWorkflowDates(id, new Date(data.expected_delivery_date));
      }
    }
  } catch (err) {
    console.error("[pregnancy-workflow] update side-effect failed:", err);
  }

  return serialize(updated);
}

export async function remove(id: number) {
  const record = await findById(id);

  try {
    await cancelWorkflow(id);
  } catch (err) {
    console.error("[pregnancy-workflow] cancel on delete failed:", err);
  }

  // Clear pregnancy_status on the animal if this was an active (non-terminal) pregnancy
  const recordStatus = (record as { status?: string | null }).status;
  if (isActivePregnancy({ status: recordStatus })) {
    await prisma.animals.update({
      where: { animal_id: (record as unknown as { animal_id: number }).animal_id },
      data: { pregnancy_status: null },
    }).catch(() => {});
  }

  await prisma.pregnancy_records.delete({ where: { pregnancy_id: id } });
}
