import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  hasModulePermissionAsync,
  hasPermissionKeyAsync,
  refreshPermissionCache,
} from "@/lib/rbac/permission-resolver";
import { normalizeRole } from "@/lib/rbac/permissions";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import type { Role } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError("Authentication required");
  return {
    ...session.user,
    role: normalizeRole(session.user.role) as Role,
  };
}

export async function requirePermission(module: string, action: string) {
  const user = await requireAuth();
  await refreshPermissionCache();
  if (!(await hasModulePermissionAsync(user.role, module, action))) {
    throw new ForbiddenError(`You don't have permission to ${action} ${module}`);
  }
  return user;
}

export async function requirePermissionKey(permission: string) {
  const user = await requireAuth();
  await refreshPermissionCache();
  if (!(await hasPermissionKeyAsync(user.role, permission))) {
    throw new ForbiddenError(`You don't have permission: ${permission}`);
  }
  return user;
}

export async function resolveId(params: Ctx["params"], field = "id"): Promise<number> {
  const p = (await params) as Record<string, string>;
  const id = Number(p[field]);
  if (!id || !Number.isFinite(id)) throw new Error(`Invalid ${field}`);
  return id;
}
