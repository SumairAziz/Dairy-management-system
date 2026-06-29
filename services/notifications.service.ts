import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { Notification } from "@/types";

export async function findByUser(userId: number, onlyUnread = false) {
  const where: { user_id: number; is_read?: boolean } = { user_id: userId };
  if (onlyUnread) where.is_read = false;

  const data = await prisma.notifications.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 50,
  });
  return serialize(data) as Notification[];
}

export async function countUnread(userId: number): Promise<number> {
  return prisma.notifications.count({
    where: { user_id: userId, is_read: false },
  });
}

export async function markAsRead(notificationId: number, userId: number) {
  const notification = await prisma.notifications.findFirst({
    where: { id: notificationId, user_id: userId },
  });
  if (!notification) {
    throw new Error("Notification not found");
  }
  const updated = await prisma.notifications.update({
    where: { id: notificationId },
    data: { is_read: true },
  });
  return serialize(updated) as Notification;
}

export async function markAllAsRead(userId: number): Promise<number> {
  const result = await prisma.notifications.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true },
  });
  return result.count;
}

export async function create(data: {
  userId: number;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
}) {
  const created = await prisma.notifications.create({
    data: {
      user_id: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
    },
  });
  return serialize(created) as Notification;
}

/**
 * Generates system notifications for upcoming vaccinations, expected
 * deliveries, and critical health incidents. Intended to be invoked from a
 * scheduled job (cron) so admins/managers/vets are proactively alerted.
 * Merged in from the original notification.service.ts implementation.
 */
export async function checkAndGenerateAlerts() {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

  const upcomingVaccinations = await prisma.vaccination_records.findMany({
    where: {
      next_due_date: { lte: sevenDaysFromNow, gte: new Date() },
    },
    include: { animals: { select: { animal_id: true, tag_number: true } } },
  });

  const admins = await prisma.users.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "VETERINARIAN"] } },
  });

  for (const v of upcomingVaccinations) {
    for (const admin of admins) {
      await create({
        userId: admin.user_id,
        type: "VACCINATION_DUE",
        title: "Vaccination Due Soon",
        message: `${v.animals?.tag_number ?? "Animal"}: ${v.vaccine_name} due by ${v.next_due_date?.toISOString().split("T")[0]}`,
        entityType: "vaccination",
        entityId: v.vaccination_id,
      });
    }
  }

  const upcomingDeliveries = await prisma.pregnancy_records.findMany({
    where: {
      expected_delivery_date: { lte: fourteenDaysFromNow, gte: new Date() },
      status: { not: "Delivered" },
    },
    include: { animals: { select: { animal_id: true, tag_number: true } } },
  });

  for (const p of upcomingDeliveries) {
    for (const admin of admins) {
      await create({
        userId: admin.user_id,
        type: "DELIVERY_EXPECTED",
        title: "Delivery Expected Soon",
        message: `${p.animals?.tag_number ?? "Animal"} expected to deliver by ${p.expected_delivery_date?.toISOString().split("T")[0]}`,
        entityType: "pregnancy",
        entityId: p.pregnancy_id,
      });
    }
  }

  const criticalIncidents = await prisma.health_incidents.findMany({
    where: {
      severity: "Critical",
      status: { not: "Resolved" },
    },
    include: { animals: { select: { animal_id: true, tag_number: true } } },
  });

  for (const h of criticalIncidents) {
    for (const admin of admins) {
      await create({
        userId: admin.user_id,
        type: "HEALTH_CRITICAL",
        title: "Critical Health Incident",
        message: `${h.animals?.tag_number ?? "Animal"}: ${h.disease_name ?? "Unknown"} - Critical severity`,
        entityType: "health_incident",
        entityId: h.incident_id!,
      });
    }
  }
}