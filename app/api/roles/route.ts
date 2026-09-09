import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermissionKey } from "@/lib/api-auth";
import {
  invalidatePermissionCache,
  refreshPermissionCache,
} from "@/lib/rbac/permission-resolver";
import { ASSIGNABLE_ROLES, normalizeRole } from "@/lib/rbac/permissions";
import {
  getRoleMatrix,
  seedDefaultRolePermissions,
  updateRolePermissions,
} from "@/services/role-permission.service";
import { updateRolePermissionsSchema } from "@/validators/role.validator";
import type { Role } from "@/types";

export async function GET(req: NextRequest) {
  try {
    await requirePermissionKey("roles.view");
    await refreshPermissionCache(true);

    const roleParam = req.nextUrl.searchParams.get("role");
    const role = roleParam ? normalizeRole(roleParam) : null;

    if (role) {
      return successResponse({
        role,
        editable: role !== "ADMIN",
        matrix: await getRoleMatrix(role),
      });
    }

    const roles = await Promise.all(
      ASSIGNABLE_ROLES.map(async (entry) => ({
        role: entry,
        editable: entry !== "ADMIN",
        matrix: await getRoleMatrix(entry as Role),
      })),
    );

    return successResponse({ roles });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requirePermissionKey("roles.edit");
    const body = await req.json();
    const parsed = updateRolePermissionsSchema.parse(body);
    const role = normalizeRole(parsed.role);

    const saved = await updateRolePermissions(role, parsed.permissions);
    invalidatePermissionCache();
    await refreshPermissionCache(true);

    return successResponse({
      role,
      permissions: saved,
      matrix: await getRoleMatrix(role),
      message: "Role permissions updated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
