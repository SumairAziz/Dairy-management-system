import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createdResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import {
  getOrCreateDirectConversation,
  listConversations,
} from "@/services/chat.service";
import { createConversationSchema } from "@/validators/chat.validator";

export async function GET() {
  try {
    const user = await requirePermission("messages", "read");
    const conversations = await listConversations(user.id);
    return successResponse(conversations);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("messages", "create");
    const body = await req.json();
    const parsed = createConversationSchema.parse(body);
    const conversation = await getOrCreateDirectConversation(user.id, parsed.user_id);
    return createdResponse({
      conversation_id: conversation.conversation_id,
      type: conversation.type,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
