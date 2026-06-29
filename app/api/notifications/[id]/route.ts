import { NextRequest } from "next/server";
import * as notificationService from "@/services/notifications.service";
import { requireAuth } from "@/lib/api-auth";
import { NotFoundError } from "@/lib/errors";
import { handleApiError, AppError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { log as auditLog } from "@/services/audit.service";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function toNotificationId(raw: string): number {
  const id = Number(raw);
  if (!id || !Number.isFinite(id)) throw new AppError(400, "BAD_REQUEST", "Invalid notification id");
  return id;
}

export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const notificationId = toNotificationId(id);
    const updated = await notificationService.markAsRead(notificationId, user.id);
    await auditLog(user.id, "notifications", notificationId, "UPDATE", undefined, {
      action: "mark_as_read",
    });
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const notificationId = toNotificationId(id);

    // Delete only if it belongs to the current user
    const notification = await prisma.notifications.findFirst({
      where: { id: notificationId, user_id: user.id },
    });
    if (!notification) {
      throw new NotFoundError("Notification");
    }
    const old = notification as unknown as Record<string, unknown>;
    await prisma.notifications.delete({ where: { id: notificationId } });
    await auditLog(user.id, "notifications", notificationId, "DELETE", old);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}