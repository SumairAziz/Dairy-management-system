import { describe, it, expect, vi } from "vitest";

// Registry.ts aggregates every domain tool file, each of which imports
// "@/lib/db" — mock it so importing the full registry never attempts a real
// database connection during this structural smoke test.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getAllTools, getToolSpecs, getTool, TOOL_REGISTRY } from "@/lib/ai/tools/registry";

describe("lib/ai/tools/registry", () => {
  it("registers at least one tool per module named in the feature spec", () => {
    const names = getAllTools().map((t) => t.name);
    const expected = [
      "getAnimals",
      "getAnimalHistory",
      "getMilkProduction",
      "getPregnancyRecords",
      "getVaccinationStatus",
      "getFarmStatistics",
      "compareFarms",
      "getDashboardSummary",
      "getInventory",
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  it("has no duplicate tool names across modules", () => {
    const names = getAllTools().map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool exposes a valid object JSON schema, a zod schema, a description, and a category", () => {
    for (const tool of getAllTools()) {
      expect(tool.parameters.type).toBe("object");
      expect(typeof tool.parameters.properties).toBe("object");
      expect(typeof tool.schema.safeParse).toBe("function");
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.category.length).toBeGreaterThan(0);
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("getToolSpecs() mirrors every registered tool without leaking the handler/schema", () => {
    const specs = getToolSpecs();
    expect(specs).toHaveLength(getAllTools().length);
    for (const spec of specs) {
      expect(spec).not.toHaveProperty("handler");
      expect(spec).not.toHaveProperty("schema");
      expect(TOOL_REGISTRY.has(spec.name)).toBe(true);
    }
  });

  it("getTool returns the matching tool, or undefined for an unknown name", () => {
    expect(getTool("getAnimals")?.name).toBe("getAnimals");
    expect(getTool("this-tool-does-not-exist")).toBeUndefined();
  });
});
