import { describe, it, expect } from "vitest";
import {
  getDefaultPermissionsForRole,
  updateRolePermissions,
} from "@/services/role-permission.service";
import { ALL_PERMISSIONS } from "@/lib/rbac/permissions";

describe("role-permission.service defaults", () => {
  it("ADMIN defaults include user and role administration", () => {
    const defaults = getDefaultPermissionsForRole("ADMIN");
    expect(defaults).toContain("users.view");
    expect(defaults).toContain("roles.edit");
    expect(defaults.length).toBe(ALL_PERMISSIONS.length);
  });

  it("FARM_WORKER defaults are limited operational permissions", () => {
    const defaults = getDefaultPermissionsForRole("FARM_WORKER");
    expect(defaults).toContain("animals.view");
    expect(defaults).toContain("milk.create");
    expect(defaults).not.toContain("animals.create");
  });

  it("rejects ADMIN permission updates", async () => {
    await expect(updateRolePermissions("ADMIN", ["dashboard.view"])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
