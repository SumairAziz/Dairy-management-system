import { describe, it, expect } from "vitest";
import { hasPermission, requireRole, ROLE_PERMISSIONS } from "@/lib/permissions";
import type { Role } from "@/types";

const ALL_ROLES: Role[] = ["ADMIN", "MANAGER", "VETERINARIAN", "WORKER", "VIEWER"];
const ALL_MODULES = Object.keys(ROLE_PERMISSIONS.ADMIN);
const ALL_ACTIONS: Array<"create" | "read" | "update" | "delete"> = ["create", "read", "update", "delete"];

describe("hasPermission", () => {
  it("ADMIN should have all permissions on all modules", () => {
    for (const mod of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        expect(hasPermission("ADMIN", mod, action)).toBe(true);
      }
    }
  });

  it("MANAGER should have all permissions on all modules", () => {
    for (const mod of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        expect(hasPermission("MANAGER", mod, action)).toBe(true);
      }
    }
  });

  it("VIEWER should only have read on all modules", () => {
    for (const mod of ALL_MODULES) {
      expect(hasPermission("VIEWER", mod, "read")).toBe(true);
      expect(hasPermission("VIEWER", mod, "create")).toBe(false);
      expect(hasPermission("VIEWER", mod, "update")).toBe(false);
      expect(hasPermission("VIEWER", mod, "delete")).toBe(false);
    }
  });

  it("VETERINARIAN should have CRUD on health but only read on animals", () => {
    expect(hasPermission("VETERINARIAN", "health", "create")).toBe(true);
    expect(hasPermission("VETERINARIAN", "health", "delete")).toBe(true);
    expect(hasPermission("VETERINARIAN", "animals", "read")).toBe(true);
    expect(hasPermission("VETERINARIAN", "animals", "create")).toBe(false);
    expect(hasPermission("VETERINARIAN", "animals", "delete")).toBe(false);
  });

  it("WORKER should have create+read on milk but only read on animals", () => {
    expect(hasPermission("WORKER", "milk", "create")).toBe(true);
    expect(hasPermission("WORKER", "milk", "read")).toBe(true);
    expect(hasPermission("WORKER", "milk", "update")).toBe(false);
    expect(hasPermission("WORKER", "milk", "delete")).toBe(false);
    expect(hasPermission("WORKER", "animals", "read")).toBe(true);
    expect(hasPermission("WORKER", "animals", "create")).toBe(false);
  });

  it("WORKER should have create+read on health", () => {
    expect(hasPermission("WORKER", "health", "create")).toBe(true);
    expect(hasPermission("WORKER", "health", "read")).toBe(true);
    expect(hasPermission("WORKER", "health", "update")).toBe(false);
  });

  it("should return false for unknown module", () => {
    expect(hasPermission("ADMIN", "nonexistent", "read")).toBe(false);
    expect(hasPermission("VIEWER", "nonexistent", "read")).toBe(false);
  });

  it("should return false for unknown action", () => {
    expect(hasPermission("ADMIN", "animals", "explode")).toBe(false);
  });
});

describe("requireRole", () => {
  it("should return true when user role is in allowed list", () => {
    expect(requireRole(["ADMIN", "MANAGER"], "ADMIN")).toBe(true);
    expect(requireRole(["ADMIN", "MANAGER"], "MANAGER")).toBe(true);
  });

  it("should return false when user role is not in allowed list", () => {
    expect(requireRole(["ADMIN", "MANAGER"], "VIEWER")).toBe(false);
    expect(requireRole(["VETERINARIAN"], "WORKER")).toBe(false);
  });

  it("should work with single-role list", () => {
    expect(requireRole(["ADMIN"], "ADMIN")).toBe(true);
    expect(requireRole(["ADMIN"], "MANAGER")).toBe(false);
  });
});