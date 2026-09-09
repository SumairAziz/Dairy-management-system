import { NextRequest } from "next/server";
import * as userService from "@/services/user.service";
import { createUserSchema, userQuerySchema } from "@/validators/user.validator";
import { handleApiError } from "@/lib/errors";
import { createdResponse, successResponse } from "@/lib/api-response";
import { requirePermissionKey } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermissionKey("users.view");
    const params = userQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const users = await userService.listUsers(params.search);
    return successResponse(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermissionKey("users.create");
    const body = await req.json();
    const parsed = createUserSchema.parse(body);
    const created = await userService.createUser(actor.id, parsed);
    await auditLog(actor.id, "users", created.user_id, "CREATE", undefined, {
      email: created.email,
      role: created.role,
    });
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}
