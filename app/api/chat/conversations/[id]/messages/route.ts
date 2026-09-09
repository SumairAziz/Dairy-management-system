import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createdResponse, successResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import {
  getInitialMessages,
  getOlderMessages,
  markConversationRead,
  sendMessage,
} from "@/services/chat.service";
import { olderMessagesQuerySchema, sendMessageSchema } from "@/validators/chat.validator";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission("messages", "read");
    const conversationId = await resolveId(ctx.params, "id");
    const before = req.nextUrl.searchParams.get("before");

    if (before) {
      const parsed = olderMessagesQuerySchema.parse({
        before,
        limit: req.nextUrl.searchParams.get("limit") ?? undefined,
      });
      const result = await getOlderMessages(
        conversationId,
        user.id,
        parsed.before,
        parsed.limit,
      );
      return successResponse(result);
    }

    const result = await getInitialMessages(conversationId, user.id);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission("messages", "create");
    const conversationId = await resolveId(ctx.params, "id");
    const body = await req.json();
    const parsed = sendMessageSchema.parse(body);
    const message = await sendMessage(conversationId, user.id, parsed);
    return createdResponse(message);
  } catch (error) {
    return handleApiError(error);
  }
}
