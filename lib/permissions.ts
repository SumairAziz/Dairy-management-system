import type { Role } from "@/types";
import {
  ASSIGNABLE_ROLES,
  getRolePermissionMatrix,
  hasModulePermission,
  hasPermissionKey,
  normalizeRole,
  PERMISSION_MODULES,
  ROLE_PERMISSION_GRANTS,
} from "@/lib/rbac/permissions";

export {
  ASSIGNABLE_ROLES,
  getRolePermissionMatrix,
  hasPermissionKey,
  normalizeRole,
  PERMISSION_MODULES,
  ROLE_PERMISSION_GRANTS,
};

/** Backward-compatible module/action permission check used by API routes. */
export function hasPermission(
  userRole: Role | string,
  module: string,
  action: string,
): boolean {
  return hasModulePermission(String(userRole), module, action);
}

export function requireRole(allowedRoles: Role[], userRole: Role | string): boolean {
  const normalized = normalizeRole(String(userRole));
  return allowedRoles.includes(normalized);
}

/** Legacy export — derived from RBAC grants for tests expecting module/action shape. */
export const ROLE_PERMISSIONS: Record<
  Role,
  Record<string, Array<"create" | "read" | "update" | "delete">>
> = Object.fromEntries(
  (Object.keys(ROLE_PERMISSION_GRANTS) as Role[]).map((role) => {
    const modules: Record<string, Array<"create" | "read" | "update" | "delete">> = {};
    for (const [module, actions] of Object.entries({
      animals: ["read", "create", "update", "delete"],
      milk: ["read", "create", "update", "delete"],
      health: ["read", "create", "update", "delete"],
      farms: ["read", "create", "update", "delete"],
      reports: ["read"],
      vaccinations: ["read", "create", "update", "delete"],
      breeding: ["read", "create", "update", "delete"],
      heatCycles: ["read", "create", "update", "delete"],
      units: ["read", "create", "update", "delete"],
      species: ["read", "create", "update", "delete"],
      breeds: ["read", "create", "update", "delete"],
      pregnancy: ["read", "create", "update", "delete"],
      calving: ["read", "create", "update", "delete"],
      inventory: ["read", "create", "update", "delete"],
    })) {
      modules[module] = actions.filter((action) =>
        hasPermission(role, module, action),
      ) as Array<"create" | "read" | "update" | "delete">;
    }
    return [role, modules];
  }),
) as Record<Role, Record<string, Array<"create" | "read" | "update" | "delete">>>;
