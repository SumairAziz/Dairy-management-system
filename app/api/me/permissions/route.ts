import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/api-auth";
import { getPermissionsForRoleAsync } from "@/lib/rbac/permission-resolver";

export async function GET() {
  try {
    const user = await requireAuth();
    const permissions = await getPermissionsForRoleAsync(user.role);
    return successResponse({ role: user.role, permissions });
  } catch (error) {
    return handleApiError(error);
  }
}
