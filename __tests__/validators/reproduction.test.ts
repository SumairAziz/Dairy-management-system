import { describe, it, expect } from "vitest";
import {
  createVaccinationSchema,
  updateVaccinationSchema,
  vaccinationQuerySchema,
} from "@/validators/vaccination.validator";
import {
  createBreedingRecordSchema,
  updateBreedingRecordSchema,
  breedingQuerySchema,
} from "@/validators/breeding.validator";
import {
  createHeatCycleSchema,
  updateHeatCycleSchema,
  heatCycleQuerySchema,
} from "@/validators/heat-cycle.validator";
import {
  createPregnancyRecordSchema,
  updatePregnancyRecordSchema,
  pregnancyQuerySchema,
} from "@/validators/pregnancy.validator";

// ─── Vaccination Validators ───────────────────────────────────────────────────

describe("createVaccinationSchema", () => {
  it("should accept empty object (all optional)", () => {
    expect(createVaccinationSchema.safeParse({}).success).toBe(true);
  });

  it("should accept all fields", () => {
    expect(createVaccinationSchema.safeParse({
      animal_id: 1,
      vaccine_name: "Anthrax Vaccine",
      vaccination_date: "2025-01-15",
      next_due_date: "2025-07-15",
      administered_by: "Dr. Ali",
      notes: "Annual booster",
    }).success).toBe(true);
  });

  it("should accept null fields", () => {
    expect(createVaccinationSchema.safeParse({
      animal_id: null,
      vaccine_name: null,
    }).success).toBe(true);
  });
});

describe("vaccinationQuerySchema", () => {
  it("should apply defaults", () => {
    const result = vaccinationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("should accept upcoming filter", () => {
    expect(vaccinationQuerySchema.safeParse({ upcoming: "true" }).success).toBe(true);
    expect(vaccinationQuerySchema.safeParse({ upcoming: "false" }).success).toBe(true);
    expect(vaccinationQuerySchema.safeParse({ upcoming: "maybe" }).success).toBe(false);
  });

  it("should accept vaccine_name search", () => {
    expect(vaccinationQuerySchema.safeParse({ vaccine_name: "Anthrax" }).success).toBe(true);
  });
});

// ─── Breeding Record Validators ───────────────────────────────────────────────

describe("createBreedingRecordSchema", () => {
  it("should accept empty object (all optional)", () => {
    expect(createBreedingRecordSchema.safeParse({}).success).toBe(true);
  });

  it("should accept full data", () => {
    expect(createBreedingRecordSchema.safeParse({
      female_animal_id: 1,
      male_animal_id: 2,
      breeding_date: "2025-01-15",
      method: "Artificial Insemination",
      result: "Success",
      notes: "First attempt",
    }).success).toBe(true);
  });
});

describe("breedingQuerySchema", () => {
  it("should apply defaults", () => {
    const result = breedingQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("should accept all filters", () => {
    expect(breedingQuerySchema.safeParse({
      female_animal_id: "1",
      male_animal_id: "2",
      method: "Natural",
    }).success).toBe(true);
  });
});

// ─── Heat Cycle Validators ────────────────────────────────────────────────────

describe("createHeatCycleSchema", () => {
  it("should accept empty object (all optional)", () => {
    expect(createHeatCycleSchema.safeParse({}).success).toBe(true);
  });

  it("should accept full data", () => {
    expect(createHeatCycleSchema.safeParse({
      animal_id: 1,
      heat_start_date: "2025-01-15",
      heat_end_date: "2025-01-17",
      detection_method: "Visual",
      confidence_score: 4.5,
      notes: "Clear signs",
    }).success).toBe(true);
  });

  it("should reject confidence_score outside 0-5", () => {
    expect(createHeatCycleSchema.safeParse({ confidence_score: -1 }).success).toBe(false);
    expect(createHeatCycleSchema.safeParse({ confidence_score: 5.1 }).success).toBe(false);
  });

  it("should accept boundary confidence scores", () => {
    expect(createHeatCycleSchema.safeParse({ confidence_score: 0 }).success).toBe(true);
    expect(createHeatCycleSchema.safeParse({ confidence_score: 5 }).success).toBe(true);
  });
});

describe("heatCycleQuerySchema", () => {
  it("should apply defaults", () => {
    const result = heatCycleQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("should accept date range filters", () => {
    expect(heatCycleQuerySchema.safeParse({
      date_from: "2025-01-01",
      date_to: "2025-01-31",
    }).success).toBe(true);
  });
});

// ─── Pregnancy Record Validators ──────────────────────────────────────────────

describe("createPregnancyRecordSchema", () => {
  const valid = {
    animal_id: 1,
    insemination_date: "2025-01-15",
  };

  it("should accept valid minimal data", () => {
    const result = createPregnancyRecordSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("Pending");
    }
  });

  it("should default status to Pending", () => {
    const result = createPregnancyRecordSchema.safeParse(valid);
    if (result.success) expect(result.data.status).toBe("Pending");
  });

  it("should reject missing animal_id", () => {
    const { animal_id, ...rest } = valid;
    expect(createPregnancyRecordSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing insemination_date", () => {
    const { insemination_date, ...rest } = valid;
    expect(createPregnancyRecordSchema.safeParse(rest).success).toBe(false);
  });

  it("should accept full data with all optional fields", () => {
    expect(createPregnancyRecordSchema.safeParse({
      ...valid,
      pregnancy_confirmed: true,
      confirmation_date: "2025-02-15",
      expected_delivery_date: "2025-10-15",
      actual_delivery_date: "2025-10-10",
      status: "Delivered",
    }).success).toBe(true);
  });

  it("should accept boolean null for pregnancy_confirmed", () => {
    expect(createPregnancyRecordSchema.safeParse({
      ...valid,
      pregnancy_confirmed: null,
    }).success).toBe(true);
  });
});

describe("pregnancyQuerySchema", () => {
  it("should apply defaults", () => {
    const result = pregnancyQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("should accept status filter", () => {
    expect(pregnancyQuerySchema.safeParse({ status: "Confirmed" }).success).toBe(true);
  });
});