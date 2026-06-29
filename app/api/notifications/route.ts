import { NextRequest, NextResponse } from "next/server";
import * as notificationService from "@/services/notifications.service";
import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/errors";
import { successResponse, errorResponse } from "@/lib/api-response";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const sp = req.nextUrl.searchParams;
    const onlyUnread = sp.get("unread") === "true";
    const notifications = await notificationService.findByUser(user.id, onlyUnread);
    return successResponse(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const action = body.action;

    if (action === "mark_all_read") {
      const count = await notificationService.markAllAsRead(user.id);
      await auditLog(user.id, "notifications", 0, "UPDATE", undefined, {
        action: "mark_all_read",
        marked_count: count,
      });
      return successResponse({ marked: count });
    }

    return errorResponse("BAD_REQUEST", "Invalid action. Use 'mark_all_read'.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}