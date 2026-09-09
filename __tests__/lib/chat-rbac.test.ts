import { describe, it, expect } from "vitest";
import { getDefaultPermissionsForRole } from "@/services/role-permission.service";

describe("chat RBAC defaults", () => {
  it("grants messages permissions to all operational roles", () => {
    for (const role of [
      "FARM_MANAGER",
      "VETERINARIAN",
      "INVENTORY_MANAGER",
      "FARM_WORKER",
      "VIEWER",
    ] as const) {
      const defaults = getDefaultPermissionsForRole(role);
      expect(defaults).toContain("messages.view");
      expect(defaults).toContain("messages.send");
    }
  });
});
