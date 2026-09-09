import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { listChatUsers } from "@/services/chat.service";
import { chatUsersQuerySchema } from "@/validators/chat.validator";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("messages", "read");
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = chatUsersQuerySchema.parse(params);
    const users = await listChatUsers(user.id, parsed.search);
    return successResponse(users);
  } catch (error) {
    return handleApiError(error);
  }
}
