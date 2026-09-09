import { describe, it, expect } from "vitest";
import {
  getProductionStatus,
  productionStatusWhere,
  plannedDryOffDate,
  PRODUCTION_STATUS_LABELS,
} from "@/lib/production-status";

describe("getProductionStatus", () => {
  it("marks males as not applicable", () => {
    expect(getProductionStatus({ gender: "M", lifecycle_stage: "Bull" })).toBe(
      "not_applicable",
    );
  });

  it("marks calves as never lactated", () => {
    expect(getProductionStatus({ gender: "F", lifecycle_stage: "Calf" })).toBe(
      "never_lactated",
    );
  });

  it("marks heifers without history as never lactated", () => {
    expect(getProductionStatus({ gender: "F", lifecycle_stage: "Heifer" })).toBe(
      "never_lactated",
    );
  });

  it("marks explicit dry cows with lactation history as dry", () => {
    expect(
      getProductionStatus({
        gender: "F",
        lifecycle_stage: "Dry",
        lactation_status: "DRY",
        hasCalvingHistory: true,
      }),
    ).toBe("dry");
  });

  it("does not mark animals without lactation history as dry", () => {
    expect(
      getProductionStatus({
        gender: "F",
        lifecycle_stage: "Dry",
        lactation_status: "DRY",
      }),
    ).toBe("never_lactated");
  });

  it("marks lactating cows explicitly", () => {
    expect(
      getProductionStatus({
        gender: "F",
        lifecycle_stage: "Lactating",
        lactation_status: "LACTATING",
        hasMilkHistory: true,
      }),
    ).toBe("lactating");
  });
});

describe("productionStatusWhere", () => {
  it("dry filter requires prior lactation history", () => {
    const where = productionStatusWhere("dry");
    expect(where.gender).toBe("F");
    expect(JSON.stringify(where)).toContain("calving_records_as_mother");
  });

  it("never lactated excludes prior lactation", () => {
    const where = productionStatusWhere("never_lactated");
    expect(where.NOT).toBeTruthy();
  });
});

describe("plannedDryOffDate", () => {
  it("is 60 days before expected calving", () => {
    const edd = new Date("2026-12-01");
    const dryOff = plannedDryOffDate(edd);
    expect(dryOff.toISOString().slice(0, 10)).toBe("2026-10-02");
  });
});

describe("PRODUCTION_STATUS_LABELS", () => {
  it("has human labels for all statuses", () => {
    expect(PRODUCTION_STATUS_LABELS.dry).toBe("Dry");
    expect(PRODUCTION_STATUS_LABELS.lactating).toBe("Lactating");
  });
});
