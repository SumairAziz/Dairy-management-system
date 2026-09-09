import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/api-auth";
import { touchPresence, markOffline } from "@/services/chat.service";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const offline = Boolean((body as { offline?: boolean }).offline);

    if (offline) {
      await markOffline(user.id);
    } else {
      await touchPresence(user.id);
    }

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
