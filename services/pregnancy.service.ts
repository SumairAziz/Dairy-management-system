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
  buildPregnancyStatusWhere,
  TERMINAL_PREGNANCY_STATUSES,
  type PregnancyStatusKey,
} from "@/lib/pregnancy-status";

const COMPUTED_STATUS_KEYS = new Set<PregnancyStatusKey>([
  "pending",
  "confirmed",
  "due_soon",
  "overdue",
  "delivered",
  "failed",
]);

export async function findAll(params: PregnancyQueryParams) {
  const { page, pageSize, ...filters } = params;
  const andParts: Prisma.pregnancy_recordsWhereInput[] = [];

  if (filters.animal_id) andParts.push({ animal_id: filters.animal_id });
  if (filters.confirmed === "yes") andParts.push({ pregnancy_confirmed: true });
  if (filters.confirmed === "no") {
    andParts.push({
      OR: [{ pregnancy_confirmed: false }, { pregnancy_confirmed: null }],
    });
  }
  if (filters.status && COMPUTED_STATUS_KEYS.has(filters.status as PregnancyStatusKey)) {
    andParts.push(
      buildPregnancyStatusWhere(filters.status as PregnancyStatusKey) as Prisma.pregnancy_recordsWhereInput,
    );
  } else if (filters.status) {
    andParts.push({ status: filters.status });
  }

  const where: Prisma.pregnancy_recordsWhereInput =
    andParts.length > 0 ? { AND: andParts } : {};

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

  if (isActivePregnancy({ status: data.status })) {
    // Keep the animal's denormalized pregnancy_status in sync with any
    // active status (Pending/Confirmed/In Progress), not just "Confirmed" —
    // records default to "Pending" on creation, and that already counts as
    // pregnant everywhere else (dashboard counts, breeding eligibility).
    await prisma.animals.update({
      where: { animal_id: created.animal_id },
      data: { pregnancy_status: "PREGNANT" },
    }).catch(() => {});
  }

  if (data.status === "Confirmed") {
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
    const newStatus = data.status !== undefined ? data.status : oldStatus;
    const wasActive = isActivePregnancy({ status: oldStatus });
    const nowActive = isActivePregnancy({ status: newStatus });
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
    } else if (!wasActive && nowActive) {
      // Reactivated into Pending/In Progress without going through the
      // explicit "Confirmed" transition above — e.g. correcting a mistaken
      // Failed/Delivered edit back to Pending. Keep pregnancy_status in
      // sync; vaccination reminders stay tied to an actual Confirmed
      // transition, so no workflow trigger here.
      await prisma.animals.update({
        where: { animal_id: updated.animal_id },
        data: { pregnancy_status: "PREGNANT" },
      }).catch(() => {});
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

/**
 * Aggregated pregnancy statistics for the dashboard section.
 * Uses SQL counts so the frontend doesn't need to fetch all records.
 */
export async function getStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    total,
    confirmed,
    pendingConfirmation,
    dueThisMonth,
    overdue,
    activePregnancies,
    delivered,
    failed,
  ] = await Promise.all([
    prisma.pregnancy_records.count(),
    prisma.pregnancy_records.count({ where: { status: "Confirmed" } }),
    prisma.pregnancy_records.count({
      where: { status: { notIn: ["Confirmed", "Delivered", "Failed"] } },
    }),
    prisma.pregnancy_records.count({
      where: {
        expected_delivery_date: { gte: monthStart, lte: monthEnd },
        status: { notIn: [...TERMINAL_PREGNANCY_STATUSES] },
        actual_delivery_date: null,
      },
    }),
    // Overdue: expected delivery is past, not yet delivered/failed
    prisma.pregnancy_records.count({
      where: {
        expected_delivery_date: { lt: now },
        actual_delivery_date: null,
        status: { notIn: [...TERMINAL_PREGNANCY_STATUSES] },
      },
    }),
    // Active (non-terminal) pregnancies
    prisma.pregnancy_records.count({
      where: { status: { notIn: ["Delivered", "Failed"] } },
    }),
    prisma.pregnancy_records.count({ where: { status: "Delivered" } }),
    prisma.pregnancy_records.count({ where: { status: "Failed" } }),
  ]);

  return {
    total,
    confirmed,
    pendingConfirmation,
    dueThisMonth,
    overdue,
    activePregnancies,
    delivered,
    failed,
  };
}
