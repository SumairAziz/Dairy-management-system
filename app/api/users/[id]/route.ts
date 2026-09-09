import { NextRequest } from "next/server";
import * as userService from "@/services/user.service";
import { resetUserPasswordSchema, updateUserSchema } from "@/validators/user.validator";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermissionKey, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePermissionKey("users.view");
    const id = await resolveId(ctx.params);
    const users = await userService.listUsers();
    const user = users.find((row) => row.user_id === id);
    if (!user) throw new NotFoundError("User");
    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requirePermissionKey("users.edit");
    const id = await resolveId(ctx.params);
    const body = await req.json();

    if (body?.password) {
      const parsed = resetUserPasswordSchema.parse(body);
      await userService.resetUserPassword(id, parsed.password);
      await auditLog(actor.id, "users", id, "UPDATE", undefined, { action: "reset_password" });
      return successResponse({ success: true });
    }

    const parsed = updateUserSchema.parse(body);
    const updated = await userService.updateUser(actor.id, id, parsed);
    await auditLog(actor.id, "users", id, "UPDATE", undefined, parsed as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requirePermissionKey("users.delete");
    const id = await resolveId(ctx.params);
    await userService.deleteUser(actor.id, id);
    await auditLog(actor.id, "users", id, "DELETE");
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}
