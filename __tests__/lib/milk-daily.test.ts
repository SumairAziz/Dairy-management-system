import { describe, it, expect } from "vitest";
import {
  getTodayProductionDate,
  dailyMilkLogWhere,
  MILK_PRODUCING_LIFECYCLE,
} from "@/lib/milk-daily";

describe("milk-daily helpers", () => {
  it("uses UTC calendar date for today", () => {
    const today = getTodayProductionDate(new Date("2026-09-09T23:30:00.000Z"));
    expect(today.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("scopes farm daily milk to lactating active animals only", () => {
    const where = dailyMilkLogWhere({ farmId: 5 });
    expect(where.production_date).toEqual({ equals: getTodayProductionDate() });
    expect(where.animals).toMatchObject({
      farm_id: 5,
      is_active: true,
      gender: "F",
    });
    expect(where.animals).not.toMatchObject({
      lactation_status: "DRY",
    });
  });

  it("scopes unit daily milk by unit_id", () => {
    const where = dailyMilkLogWhere({ unitId: 12 });
    expect(where.animals).toMatchObject({
      unit_id: 12,
      gender: "F",
    });
  });
});
