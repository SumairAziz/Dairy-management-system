import { describe, it, expect } from "vitest";
import {
  getStockStatus,
  getExpiryStatus,
  matchesExpiryDaysFilter,
  itemNeedsAttention,
} from "@/lib/inventory-status";
import { summarizeInventoryItems, enrichInventoryItem } from "@/lib/inventory-enrich";
import { movementDecreasesStock, MOVEMENT_GROUP_TREATMENT, MOVEMENT_STOCK_IN } from "@/lib/inventory-movements";

describe("inventory-enrich", () => {
  it("computes consistent stock and expiry status", () => {
    const item = enrichInventoryItem({
      item_id: 1,
      farm_id: null,
      item_name: "Ivermectin",
      category: "Medicines",
      quantity: 8 as never,
      unit: "doses",
      reorder_level: 10 as never,
      unit_cost: 50 as never,
      supplier: "VetCo",
      expiry_date: new Date("2026-12-01"),
      notes: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    expect(item.stock_status).toBe("low_stock");
    expect(item.total_value).toBe(400);
    expect(itemNeedsAttention(item)).toBe(true);
  });

  it("summarizes inventory counts from enriched items", () => {
    const items = [
      enrichInventoryItem({
        item_id: 1,
        farm_id: null,
        item_name: "A",
        category: "Feed",
        quantity: 0 as never,
        unit: "kg",
        reorder_level: 5 as never,
        unit_cost: 1 as never,
        supplier: null,
        expiry_date: null,
        notes: null,
        is_active: true,
        created_at: null,
        updated_at: null,
      }),
      enrichInventoryItem({
        item_id: 2,
        farm_id: null,
        item_name: "B",
        category: "Medicines",
        quantity: 3 as never,
        unit: "doses",
        reorder_level: 10 as never,
        unit_cost: 2 as never,
        supplier: null,
        expiry_date: new Date("2026-09-10"),
        notes: null,
        is_active: true,
        created_at: null,
        updated_at: null,
      }),
    ];

    const summary = summarizeInventoryItems(items, new Date("2026-09-05"));
    expect(summary.outOfStock).toBe(1);
    expect(summary.lowStock).toBe(1);
    expect(summary.attentionCount).toBe(2);
  });
});

describe("inventory-status expiry days", () => {
  const now = new Date("2026-09-05");

  it("matches items expiring within 7 days", () => {
    expect(matchesExpiryDaysFilter({ expiry_date: "2026-09-08" }, 7, now)).toBe(true);
    expect(matchesExpiryDaysFilter({ expiry_date: "2026-09-20" }, 7, now)).toBe(false);
    expect(matchesExpiryDaysFilter({ expiry_date: "2026-09-01" }, 7, now)).toBe(false);
  });
});

describe("inventory-movements", () => {
  it("classifies movement direction", () => {
    expect(movementDecreasesStock(MOVEMENT_GROUP_TREATMENT)).toBe(true);
    expect(movementDecreasesStock(MOVEMENT_STOCK_IN)).toBe(false);
  });
});

describe("inventory status helpers", () => {
  it("returns low stock when quantity at reorder level", () => {
    expect(getStockStatus({ quantity: 10, reorder_level: 10 })).toBe("low_stock");
  });

  it("returns expiring soon within 30 days", () => {
    const status = getExpiryStatus({ expiry_date: "2026-09-20" }, new Date("2026-09-05"));
    expect(status).toBe("expiring_soon");
  });
});
