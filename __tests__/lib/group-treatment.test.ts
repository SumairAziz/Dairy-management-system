import { describe, it, expect } from "vitest";
import {
  calculateInventorySummary,
  calculateRequiredQuantity,
  filterProductsBySearch,
  inventoryCategoriesForType,
  matchesInventoryCategory,
} from "@/lib/group-treatment";

describe("group-treatment helpers", () => {
  it("calculates required quantity as animals × dosage", () => {
    expect(calculateRequiredQuantity(25, 5)).toBe(125);
    expect(calculateRequiredQuantity(30, 5)).toBe(150);
  });

  it("calculates inventory summary with shortfall when insufficient", () => {
    const summary = calculateInventorySummary(20, 10, 150);
    expect(summary.requiredQuantity).toBe(200);
    expect(summary.sufficient).toBe(false);
    expect(summary.shortfall).toBe(50);
    expect(summary.remainingAfter).toBe(-50);
  });

  it("calculates inventory summary when stock is sufficient", () => {
    const summary = calculateInventorySummary(30, 5, 500);
    expect(summary.requiredQuantity).toBe(150);
    expect(summary.sufficient).toBe(true);
    expect(summary.shortfall).toBe(0);
    expect(summary.remainingAfter).toBe(350);
  });

  it("maps treatment type to inventory categories", () => {
    expect(inventoryCategoriesForType("vaccination")).toEqual(["Vaccines"]);
    expect(inventoryCategoriesForType("medicine")).toEqual(["Medicines"]);
  });

  it("matches inventory categories case-insensitively", () => {
    expect(matchesInventoryCategory("Medicines", "medicine")).toBe(true);
    expect(matchesInventoryCategory("medicines", "medicine")).toBe(true);
    expect(matchesInventoryCategory("Vaccines", "vaccination")).toBe(true);
    expect(matchesInventoryCategory("Feed", "medicine")).toBe(false);
  });

  it("filters products by name case-insensitively", () => {
    const products = [
      { item_id: 1, item_name: "Oxytetracycline Injection" },
      { item_id: 2, item_name: "Ivermectin Dewormer" },
    ];
    expect(filterProductsBySearch(products, "oxy")).toHaveLength(1);
    expect(filterProductsBySearch(products, "DEWORM")).toHaveLength(1);
    expect(filterProductsBySearch(products, "missing")).toHaveLength(0);
    expect(filterProductsBySearch(products, "")).toHaveLength(2);
  });
});
