import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { markConversationRead } from "@/services/chat.service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("messages", "read");
    const conversationId = await resolveId(ctx.params, "id");
    const result = await markConversationRead(conversationId, user.id);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
