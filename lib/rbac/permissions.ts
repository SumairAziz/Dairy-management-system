import type { Role } from "@/types";

/** CRUD-style action used by existing API `requirePermission(module, action)` helpers. */
export type ModuleAction = "create" | "read" | "update" | "delete" | "stock_in" | "stock_out";

export type PermissionModule = {
  label: string;
  permissions: readonly string[];
};

/** Permission matrix rows for the admin UI. */
export const PERMISSION_MODULES: Record<string, PermissionModule> = {
  dashboard: { label: "Dashboard", permissions: ["dashboard.view"] },
  reports: {
    label: "Reports",
    permissions: ["reports.create", "reports.update", "reports.delete"],
  },
  farms: {
    label: "Farms",
    permissions: ["farms.view", "farms.create", "farms.edit", "farms.delete"],
  },
  units: {
    label: "Units",
    permissions: ["units.view", "units.create", "units.edit", "units.delete"],
  },
  species_breeds: {
    label: "Species & Breeds",
    permissions: [
      "species_breeds.view",
      "species_breeds.create",
      "species_breeds.edit",
      "species_breeds.delete",
    ],
  },
  animals: {
    label: "Animals",
    permissions: ["animals.view", "animals.create", "animals.edit", "animals.delete"],
  },
  milk: {
    label: "Milk Production",
    permissions: ["milk.view", "milk.create", "milk.edit", "milk.delete"],
  },
  inventory: {
    label: "Inventory",
    permissions: [
      "inventory.view",
      "inventory.create",
      "inventory.edit",
      "inventory.delete",
      "inventory.stock_in",
      "inventory.stock_out",
    ],
  },
  vaccinations: {
    label: "Vaccinations",
    permissions: [
      "vaccinations.view",
      "vaccinations.create",
      "vaccinations.edit",
      "vaccinations.delete",
    ],
  },
  breeding: {
    label: "Breeding",
    permissions: ["breeding.view", "breeding.create", "breeding.edit", "breeding.delete"],
  },
  heat_cycles: {
    label: "Heat Cycles",
    permissions: [
      "heat_cycles.view",
      "heat_cycles.create",
      "heat_cycles.edit",
      "heat_cycles.delete",
    ],
  },
  pregnancy: {
    label: "Pregnancy",
    permissions: ["pregnancy.view", "pregnancy.create", "pregnancy.edit", "pregnancy.delete"],
  },
  calving: {
    label: "Calving",
    permissions: ["calving.view", "calving.create", "calving.edit", "calving.delete"],
  },
  health: {
    label: "Health / Treatments",
    permissions: ["health.view", "health.create", "health.edit", "health.delete"],
  },
  ai_assistant: { label: "AI Assistant", permissions: ["ai_assistant.view"] },
  messages: { label: "Messages", permissions: ["messages.view", "messages.send"] },
  settings: { label: "Settings", permissions: ["settings.view"] },
  users: {
    label: "Users",
    permissions: ["users.view", "users.create", "users.edit", "users.delete"],
  },
  roles: { label: "Roles", permissions: ["roles.view", "roles.edit"] },
};

export const ALL_PERMISSIONS = Object.values(PERMISSION_MODULES).flatMap(
  (module) => module.permissions,
);

const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS);

function grant(...permissions: string[]): Set<string> {
  return new Set(permissions);
}

function crud(prefix: string): string[] {
  return [`${prefix}.view`, `${prefix}.create`, `${prefix}.edit`, `${prefix}.delete`];
}

function inventoryCrud(): string[] {
  return [...crud("inventory"), "inventory.stock_in", "inventory.stock_out"];
}

/** Maps legacy API module names to dot-notation permission keys. */
export const MODULE_ACTION_TO_PERMISSION: Record<string, Partial<Record<ModuleAction, string>>> = {
  reports: {
    read: "dashboard.view",
    create: "reports.create",
    update: "reports.update",
    delete: "reports.delete",
  },
  farms: {
    read: "farms.view",
    create: "farms.create",
    update: "farms.edit",
    delete: "farms.delete",
  },
  units: {
    read: "units.view",
    create: "units.create",
    update: "units.edit",
    delete: "units.delete",
  },
  species: {
    read: "species_breeds.view",
    create: "species_breeds.create",
    update: "species_breeds.edit",
    delete: "species_breeds.delete",
  },
  breeds: {
    read: "species_breeds.view",
    create: "species_breeds.create",
    update: "species_breeds.edit",
    delete: "species_breeds.delete",
  },
  animals: {
    read: "animals.view",
    create: "animals.create",
    update: "animals.edit",
    delete: "animals.delete",
  },
  milk: {
    read: "milk.view",
    create: "milk.create",
    update: "milk.edit",
    delete: "milk.delete",
  },
  inventory: {
    read: "inventory.view",
    create: "inventory.create",
    update: "inventory.edit",
    delete: "inventory.delete",
    stock_in: "inventory.stock_in",
    stock_out: "inventory.stock_out",
  },
  vaccinations: {
    read: "vaccinations.view",
    create: "vaccinations.create",
    update: "vaccinations.edit",
    delete: "vaccinations.delete",
  },
  breeding: {
    read: "breeding.view",
    create: "breeding.create",
    update: "breeding.edit",
    delete: "breeding.delete",
  },
  heatCycles: {
    read: "heat_cycles.view",
    create: "heat_cycles.create",
    update: "heat_cycles.edit",
    delete: "heat_cycles.delete",
  },
  pregnancy: {
    read: "pregnancy.view",
    create: "pregnancy.create",
    update: "pregnancy.edit",
    delete: "pregnancy.delete",
  },
  calving: {
    read: "calving.view",
    create: "calving.create",
    update: "calving.edit",
    delete: "calving.delete",
  },
  health: {
    read: "health.view",
    create: "health.create",
    update: "health.edit",
    delete: "health.delete",
  },
  assistant: {
    read: "ai_assistant.view",
    create: "ai_assistant.view",
    update: "ai_assistant.view",
    delete: "ai_assistant.view",
  },
  messages: {
    read: "messages.view",
    create: "messages.send",
    update: "messages.send",
    delete: "messages.send",
  },
  settings: { read: "settings.view" },
  users: {
    read: "users.view",
    create: "users.create",
    update: "users.edit",
    delete: "users.delete",
  },
  roles: { read: "roles.view", update: "roles.edit" },
};

export const ROLE_PERMISSION_GRANTS: Record<Role, Set<string>> = {
  ADMIN: ALL_PERMISSIONS_SET,
  FARM_MANAGER: grant(
    "dashboard.view",
    "reports.create",
    "reports.update",
    "reports.delete",
    "settings.view",
    "ai_assistant.view",
    ...crud("farms"),
    ...crud("units"),
    ...crud("species_breeds"),
    ...crud("animals"),
    ...crud("milk"),
    ...inventoryCrud(),
    ...crud("vaccinations"),
    ...crud("breeding"),
    ...crud("heat_cycles"),
    ...crud("pregnancy"),
    ...crud("calving"),
    ...crud("health"),
    "messages.view",
    "messages.send",
  ),
  VETERINARIAN: grant(
    "dashboard.view",
    "settings.view",
    "messages.view",
    "messages.send",
    "animals.view",
    "animals.create",
    "animals.edit",
    "species_breeds.view",
    ...crud("vaccinations"),
    ...crud("breeding"),
    ...crud("heat_cycles"),
    ...crud("pregnancy"),
    ...crud("calving"),
    ...crud("health"),
    "inventory.view",
    "inventory.edit",
    "inventory.stock_out",
  ),
  INVENTORY_MANAGER: grant(
    "dashboard.view",
    "settings.view",
    "messages.view",
    "messages.send",
    "animals.view",
    ...inventoryCrud(),
    "vaccinations.view",
    "vaccinations.create",
    "health.view",
    "health.create",
  ),
  FARM_WORKER: grant(
    "dashboard.view",
    "settings.view",
    "messages.view",
    "messages.send",
    "animals.view",
    "milk.view",
    "milk.create",
    "vaccinations.view",
    "vaccinations.create",
    "heat_cycles.view",
    "health.view",
    "health.create",
  ),
  /** Legacy read-only role kept for backward compatibility. */
  VIEWER: grant(
    "dashboard.view",
    "settings.view",
    "messages.view",
    "messages.send",
    "farms.view",
    "units.view",
    "species_breeds.view",
    "animals.view",
    "milk.view",
    "inventory.view",
    "vaccinations.view",
    "breeding.view",
    "heat_cycles.view",
    "pregnancy.view",
    "calving.view",
    "health.view",
  ),
};

const LEGACY_ROLE_ALIASES: Record<string, Role> = {
  MANAGER: "FARM_MANAGER",
  WORKER: "FARM_WORKER",
};

let runtimePermissionCache: Map<Role, Set<string>> | null = null;

export function setRuntimePermissionCache(cache: Map<Role, Set<string>> | null) {
  runtimePermissionCache = cache;
}

function getGrantsForRole(role: Role): Set<string> {
  return runtimePermissionCache?.get(role) ?? ROLE_PERMISSION_GRANTS[role] ?? new Set();
}

export function hasPermissionKeyFromGrants(grants: Set<string>, permission: string): boolean {
  return grants.has(permission);
}

export function hasModulePermissionFromGrants(
  grants: Set<string>,
  module: string,
  action: string,
): boolean {
  const permission =
    MODULE_ACTION_TO_PERMISSION[module]?.[action as ModuleAction] ??
    `${module}.${action === "read" ? "view" : action === "update" ? "edit" : action}`;
  return hasPermissionKeyFromGrants(grants, permission);
}

export function canAccessRouteWithGrants(grants: Set<string>, pathname: string): boolean {
  const required = resolveRoutePermission(pathname);
  if (!required) return true;
  return hasPermissionKeyFromGrants(grants, required);
}

export const ASSIGNABLE_ROLES: Role[] = [
  "ADMIN",
  "FARM_MANAGER",
  "VETERINARIAN",
  "INVENTORY_MANAGER",
  "FARM_WORKER",
  "VIEWER",
];

export function normalizeRole(role: string): Role {
  const aliased = LEGACY_ROLE_ALIASES[role] ?? role;
  if (aliased in ROLE_PERMISSION_GRANTS) return aliased as Role;
  return "VIEWER";
}

export function hasPermissionKey(role: string, permission: string): boolean {
  const normalized = normalizeRole(role);
  return hasPermissionKeyFromGrants(getGrantsForRole(normalized), permission);
}

export function hasModulePermission(
  role: string,
  module: string,
  action: string,
): boolean {
  const normalized = normalizeRole(role);
  return hasModulePermissionFromGrants(getGrantsForRole(normalized), module, action);
}

export function canAccessRoute(role: string, pathname: string): boolean {
  const normalized = normalizeRole(role);
  return canAccessRouteWithGrants(getGrantsForRole(normalized), pathname);
}

export function resolveRoutePermission(pathname: string): string | null {
  if (pathname === "/forbidden") return null;
  if (pathname.startsWith("/settings/users")) return "users.view";
  if (pathname.startsWith("/settings/roles")) return "roles.view";
  if (pathname.startsWith("/settings")) return "settings.view";

  const rules: Array<[string, string]> = [
    ["/animals/assistant", "ai_assistant.view"],
    ["/animals/dashboard", "dashboard.view"],
    ["/animals/farms", "farms.view"],
    ["/animals/units", "units.view"],
    ["/animals/species-breeds", "species_breeds.view"],
    ["/animals/list", "animals.view"],
    ["/animals/milk-production", "milk.view"],
    ["/animals/vaccinations", "vaccinations.view"],
    ["/animals/breeding", "breeding.view"],
    ["/animals/heat-cycles", "heat_cycles.view"],
    ["/animals/pregnancy", "pregnancy.view"],
    ["/animals/calving", "calving.view"],
    ["/inventory", "inventory.view"],
    ["/messages", "messages.view"],
  ];

  if (pathname === "/" || pathname === "/animals") return "dashboard.view";

  for (const [prefix, permission] of rules) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return permission;
    }
  }

  return null;
}

export function getRolePermissionMatrixFromGrants(role: Role, grants: Set<string>) {
  return Object.entries(PERMISSION_MODULES).map(([key, module]) => ({
    key,
    label: module.label,
    permissions: module.permissions.map((permission) => ({
      key: permission,
      allowed: grants.has(permission),
    })),
  }));
}

export function getRolePermissionMatrix(role: Role) {
  return getRolePermissionMatrixFromGrants(role, getGrantsForRole(role));
}

/** Sidebar / navigation visibility permission per route href. */
export const NAV_PERMISSIONS: Record<string, string> = {
  "/animals/assistant": "ai_assistant.view",
  "/animals/dashboard": "dashboard.view",
  "/animals/farms": "farms.view",
  "/animals/units": "units.view",
  "/animals/species-breeds": "species_breeds.view",
  "/animals/list": "animals.view",
  "/animals/milk-production": "milk.view",
  "/inventory": "inventory.view",
  "/animals/vaccinations": "vaccinations.view",
  "/animals/breeding": "breeding.view",
  "/animals/heat-cycles": "heat_cycles.view",
  "/animals/pregnancy": "pregnancy.view",
  "/animals/calving": "calving.view",
  "/messages": "messages.view",
  "/settings": "settings.view",
};
