import { describe, it, expect } from "vitest";
import { resolveId } from "@/lib/api-auth";

describe("resolveId", () => {
  it("should parse a valid numeric id from params", async () => {
    const params = Promise.resolve({ id: "42" });
    const result = await resolveId(params);
    expect(result).toBe(42);
  });

  it("should resolve with custom field name", async () => {
    const params = Promise.resolve({ incidentId: "7" });
    const result = await resolveId(params, "incidentId");
    expect(result).toBe(7);
  });

  it("should throw on non-numeric string", async () => {
    const params = Promise.resolve({ id: "abc" });
    await expect(resolveId(params)).rejects.toThrow("Invalid id");
  });

  it("should throw on zero", async () => {
    const params = Promise.resolve({ id: "0" });
    await expect(resolveId(params)).rejects.toThrow("Invalid id");
  });

  it("should accept negative numbers (only checks truthy + finite)", async () => {
    // Note: resolveId uses `!id` which doesn't catch negatives.
    // Number("-5") = -5, !(-5) = false, isFinite(-5) = true → returns -5
    const params = Promise.resolve({ id: "-5" });
    const result = await resolveId(params);
    expect(result).toBe(-5);
  });

  it("should accept float strings as valid finite numbers", async () => {
    const params = Promise.resolve({ id: "3.14" });
    const result = await resolveId(params);
    expect(result).toBe(3.14);
  });

  it("should throw on Infinity", async () => {
    const params = Promise.resolve({ id: "Infinity" });
    await expect(resolveId(params)).rejects.toThrow("Invalid id");
  });

  it("should throw on empty string", async () => {
    const params = Promise.resolve({ id: "" });
    await expect(resolveId(params)).rejects.toThrow("Invalid id");
  });
});