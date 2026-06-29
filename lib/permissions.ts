import type { Role } from "@/types";

type Action = "create" | "read" | "update" | "delete";

const ROLE_PERMISSIONS: Record<Role, Record<string, Action[]>> = {
  ADMIN: {
    animals: ["create", "read", "update", "delete"],
    milk: ["create", "read", "update", "delete"],
    health: ["create", "read", "update", "delete"],
    farms: ["create", "read", "update", "delete"],
    reports: ["create", "read", "update", "delete"],
    vaccinations: ["create", "read", "update", "delete"],
    breeding: ["create", "read", "update", "delete"],
    heatCycles: ["create", "read", "update", "delete"],
    units: ["create", "read", "update", "delete"],
    species: ["create", "read", "update", "delete"],
    breeds: ["create", "read", "update", "delete"],
    pregnancy: ["create", "read", "update", "delete"],
  },
  MANAGER: {
    animals: ["create", "read", "update", "delete"],
    milk: ["create", "read", "update", "delete"],
    health: ["create", "read", "update", "delete"],
    farms: ["create", "read", "update", "delete"],
    reports: ["create", "read", "update", "delete"],
    vaccinations: ["create", "read", "update", "delete"],
    breeding: ["create", "read", "update", "delete"],
    heatCycles: ["create", "read", "update", "delete"],
    units: ["create", "read", "update", "delete"],
    species: ["create", "read", "update", "delete"],
    breeds: ["create", "read", "update", "delete"],
    pregnancy: ["create", "read", "update", "delete"],
  },
  VETERINARIAN: {
    animals: ["read"],
    milk: ["read"],
    health: ["create", "read", "update", "delete"],
    farms: ["read"],
    reports: ["read"],
    vaccinations: ["create", "read", "update", "delete"],
    breeding: ["create", "read", "update", "delete"],
    heatCycles: ["read"],
    units: ["read"],
    species: ["read"],
    breeds: ["read"],
    pregnancy: ["create", "read", "update", "delete"],
  },
  WORKER: {
    animals: ["read"],
    milk: ["create", "read"],
    health: ["create", "read"],
    farms: ["read"],
    reports: ["read"],
    vaccinations: ["create", "read"],
    breeding: ["read"],
    heatCycles: ["read"],
    units: ["read"],
    species: ["read"],
    breeds: ["read"],
    pregnancy: ["read"],
  },
  VIEWER: {
    animals: ["read"],
    milk: ["read"],
    health: ["read"],
    farms: ["read"],
    reports: ["read"],
    vaccinations: ["read"],
    breeding: ["read"],
    heatCycles: ["read"],
    units: ["read"],
    species: ["read"],
    breeds: ["read"],
    pregnancy: ["read"],
  },
};

export function hasPermission(
  userRole: Role,
  module: string,
  action: string
): boolean {
  const perms = ROLE_PERMISSIONS[userRole]?.[module];
  if (!perms) return false;
  return perms.includes(action as Action);
}

export function requireRole(
  allowedRoles: Role[],
  userRole: Role
): boolean {
  return allowedRoles.includes(userRole);
}

export { ROLE_PERMISSIONS };
