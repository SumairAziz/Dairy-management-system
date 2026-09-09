import {
  hasModulePermissionFromGrants,
  hasPermissionKeyFromGrants,
  normalizeRole,
  setRuntimePermissionCache,
} from "@/lib/rbac/permissions";
import { loadAllRolePermissionSets } from "@/services/role-permission.service";
import type { Role } from "@/types";

let cachePromise: Promise<Map<Role, Set<string>>> | null = null;

export async function refreshPermissionCache(force = false): Promise<Map<Role, Set<string>>> {
  if (!force && cachePromise) {
    return cachePromise;
  }

  cachePromise = loadAllRolePermissionSets().then((map) => {
    setRuntimePermissionCache(map);
    return map;
  });

  return cachePromise;
}

export function invalidatePermissionCache() {
  cachePromise = null;
  setRuntimePermissionCache(null);
}

async function getGrantsForRole(role: string): Promise<Set<string>> {
  const map = await refreshPermissionCache();
  const normalized = normalizeRole(role);
  return map.get(normalized) ?? new Set<string>();
}

export async function hasPermissionKeyAsync(role: string, permission: string): Promise<boolean> {
  const grants = await getGrantsForRole(role);
  return hasPermissionKeyFromGrants(grants, permission);
}

export async function hasModulePermissionAsync(
  role: string,
  module: string,
  action: string,
): Promise<boolean> {
  const grants = await getGrantsForRole(role);
  return hasModulePermissionFromGrants(grants, module, action);
}

export async function getPermissionsForRoleAsync(role: string): Promise<string[]> {
  const grants = await getGrantsForRole(role);
  return Array.from(grants);
}
