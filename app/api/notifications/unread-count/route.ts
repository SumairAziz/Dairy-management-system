import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { countUnread } from "@/services/notifications.service";

export async function GET() {
  try {
    const user = await requireAuth();
    const count = await countUnread(user.id);
    return successResponse({ count });
  } catch (error) {
    return handleApiError(error);
  }
}