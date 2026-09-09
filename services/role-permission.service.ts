import { prisma } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_ROLES,
  getRolePermissionMatrixFromGrants,
  ROLE_PERMISSION_GRANTS,
  normalizeRole,
} from "@/lib/rbac/permissions";
import type { Role } from "@/types";

const VALID_PERMISSIONS = new Set<string>(ALL_PERMISSIONS);

function rolePermissionsModel() {
  return (prisma as { role_permissions?: typeof prisma.role_permissions }).role_permissions;
}

export function getDefaultPermissionsForRole(role: Role): string[] {
  return Array.from(ROLE_PERMISSION_GRANTS[role] ?? []);
}

export async function getPermissionSetForRole(role: string): Promise<Set<string>> {
  const normalized = normalizeRole(role);
  const model = rolePermissionsModel();

  if (!model) {
    return new Set(getDefaultPermissionsForRole(normalized));
  }

  try {
    const rows = await model.findMany({
      where: { role: normalized },
      select: { permission_key: true },
    });

    if (rows.length === 0) {
      return new Set(getDefaultPermissionsForRole(normalized));
    }

    return new Set(rows.map((row) => row.permission_key));
  } catch (error) {
    console.error("[RBAC] Failed to load role permissions, using defaults:", error);
    return new Set(getDefaultPermissionsForRole(normalized));
  }
}

export async function getPermissionsForRole(role: string): Promise<string[]> {
  return Array.from(await getPermissionSetForRole(role));
}

export async function loadAllRolePermissionSets(): Promise<Map<Role, Set<string>>> {
  const map = new Map<Role, Set<string>>();
  for (const role of ASSIGNABLE_ROLES) {
    map.set(role, await getPermissionSetForRole(role));
  }
  return map;
}

export async function getRoleMatrix(role: Role) {
  const grants = await getPermissionSetForRole(role);
  return getRolePermissionMatrixFromGrants(role, grants);
}

export async function updateRolePermissions(role: string, permissions: string[]) {
  const normalized = normalizeRole(role);

  if (normalized === "ADMIN") {
    throw new ForbiddenError("ADMIN role permissions are immutable");
  }

  const unique = [...new Set(permissions)].filter((key) => VALID_PERMISSIONS.has(key));

  if (unique.length === 0) {
    throw new ValidationError("At least one permission must be enabled");
  }

  const model = rolePermissionsModel();
  if (!model) {
    throw new ValidationError(
      "Role permissions storage is unavailable. Run: npx prisma generate && restart the dev server.",
    );
  }

  await prisma.$transaction([
    model.deleteMany({ where: { role: normalized } }),
    model.createMany({
      data: unique.map((permission_key) => ({
        role: normalized,
        permission_key,
        updated_at: new Date(),
      })),
    }),
  ]);

  return unique;
}

export async function seedDefaultRolePermissions() {
  const model = rolePermissionsModel();
  if (!model) {
    console.warn("[RBAC] role_permissions model missing — run npx prisma generate");
    return { added: 0 };
  }

  let added = 0;

  for (const role of ASSIGNABLE_ROLES) {
    const defaults = getDefaultPermissionsForRole(role);
    if (defaults.length === 0) continue;

    const existing = await model.findMany({
      where: { role },
      select: { permission_key: true },
    });
    const existingSet = new Set(existing.map((row) => row.permission_key));
    const missing = defaults.filter((permission) => !existingSet.has(permission));

    if (missing.length === 0) continue;

    await model.createMany({
      data: missing.map((permission_key) => ({ role, permission_key })),
    });

    added += missing.length;
    console.log(`  ✓ ${role.padEnd(18)} +${missing.length} permissions`);
    if (missing.some((key) => key.startsWith("messages."))) {
      console.log(`      messages: ${missing.filter((key) => key.startsWith("messages.")).join(", ")}`);
    }
  }

  return { added };
}

/** Ensures every role has messages module access in the database. */
export async function ensureMessagesPermissionsForAllRoles() {
  const model = rolePermissionsModel();
  if (!model) return { added: 0 };

  const messageKeys = ["messages.view", "messages.send"] as const;
  let added = 0;

  for (const role of ASSIGNABLE_ROLES) {
    for (const permission_key of messageKeys) {
      const exists = await model.findFirst({
        where: { role, permission_key },
        select: { id: true },
      });
      if (exists) continue;
      await model.create({ data: { role, permission_key } });
      added += 1;
    }
  }

  return { added };
}
