import { describe, it, expect } from "vitest";
import {
  hasModulePermission,
  hasPermissionKey,
  normalizeRole,
} from "@/lib/rbac/permissions";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/types";

const ROLES: Role[] = [
  "ADMIN",
  "FARM_MANAGER",
  "VETERINARIAN",
  "INVENTORY_MANAGER",
  "FARM_WORKER",
  "VIEWER",
];

describe("RBAC permissions", () => {
  it("ADMIN has full module access", () => {
    expect(hasPermission("ADMIN", "animals", "delete")).toBe(true);
    expect(hasPermissionKey("ADMIN", "users.delete")).toBe(true);
  });

  it("FARM_MANAGER can manage farms but not users", () => {
    expect(hasPermission("FARM_MANAGER", "farms", "create")).toBe(true);
    expect(hasPermissionKey("FARM_MANAGER", "users.view")).toBe(false);
  });

  it("VETERINARIAN can manage vaccinations and animal records but not delete animals", () => {
    expect(hasPermission("VETERINARIAN", "vaccinations", "create")).toBe(true);
    expect(hasPermission("VETERINARIAN", "animals", "create")).toBe(true);
    expect(hasPermission("VETERINARIAN", "animals", "delete")).toBe(false);
    expect(hasPermission("VETERINARIAN", "inventory", "stock_out")).toBe(true);
  });

  it("INVENTORY_MANAGER can manage inventory and view animals", () => {
    expect(hasPermissionKey("INVENTORY_MANAGER", "inventory.stock_in")).toBe(true);
    expect(hasPermission("INVENTORY_MANAGER", "animals", "read")).toBe(true);
    expect(hasPermission("INVENTORY_MANAGER", "farms", "read")).toBe(false);
  });

  it("FARM_WORKER can log milk and vaccinations only", () => {
    expect(hasPermission("FARM_WORKER", "milk", "create")).toBe(true);
    expect(hasPermission("FARM_WORKER", "vaccinations", "create")).toBe(true);
    expect(hasPermission("FARM_WORKER", "breeding", "create")).toBe(false);
  });

  it("normalizes legacy role aliases", () => {
    expect(normalizeRole("MANAGER")).toBe("FARM_MANAGER");
    expect(normalizeRole("WORKER")).toBe("FARM_WORKER");
    expect(hasModulePermission("MANAGER", "farms", "read")).toBe(true);
  });
});

describe("legacy hasPermission compatibility", () => {
  it("VIEWER remains read-only", () => {
    for (const role of ROLES) {
      if (role !== "VIEWER") continue;
      expect(hasPermission(role, "animals", "read")).toBe(true);
      expect(hasPermission(role, "animals", "create")).toBe(false);
    }
  });
});
