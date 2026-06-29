import { describe, it, expect } from "vitest";
import { createMilkLogSchema, milkLogQuerySchema } from "@/validators/milk-log.validator";
import { createGrowthLogSchema, updateGrowthLogSchema } from "@/validators/growth-logs.validator";
import {
  createHealthIncidentSchema,
  updateHealthIncidentSchema,
  healthIncidentIdParamSchema,
} from "@/validators/health-incidents.validator";

// ─── Milk Log Validators ──────────────────────────────────────────────────────

describe("createMilkLogSchema", () => {
  const valid = {
    animal_id: 1,
    production_date: "2025-01-15",
    session: "Morning" as const,
    milk_liters: 12.5,
  };

  it("should accept valid milk log", () => {
    const result = createMilkLogSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should accept all three sessions", () => {
    for (const session of ["Morning", "Afternoon", "Evening"]) {
      expect(createMilkLogSchema.safeParse({ ...valid, session }).success).toBe(true);
    }
  });

  it("should reject invalid session", () => {
    expect(createMilkLogSchema.safeParse({ ...valid, session: "Night" }).success).toBe(false);
  });

  it("should reject missing animal_id", () => {
    const { animal_id, ...rest } = valid;
    expect(createMilkLogSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject zero or negative milk_liters", () => {
    expect(createMilkLogSchema.safeParse({ ...valid, milk_liters: 0 }).success).toBe(false);
    expect(createMilkLogSchema.safeParse({ ...valid, milk_liters: -1 }).success).toBe(false);
  });

  it("should accept optional quality_grade and notes", () => {
    const result = createMilkLogSchema.safeParse({
      ...valid,
      quality_grade: "A",
      notes: "Good yield",
    });
    expect(result.success).toBe(true);
  });

  it("should accept null optional fields", () => {
    const result = createMilkLogSchema.safeParse({
      ...valid,
      quality_grade: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("milkLogQuerySchema", () => {
  it("should apply defaults", () => {
    const result = milkLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("should accept all filter params", () => {
    const result = milkLogQuerySchema.safeParse({
      page: "2",
      pageSize: "10",
      animal_id: "5",
      session: "Evening",
      date_from: "2025-01-01",
      date_to: "2025-01-31",
      milk_min: "5",
      milk_max: "20",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid session in query", () => {
    expect(milkLogQuerySchema.safeParse({ session: "Night" }).success).toBe(false);
  });

  it("should coerce string numbers", () => {
    const result = milkLogQuerySchema.safeParse({ page: "3", pageSize: "50" });
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });
});

// ─── Growth Log Validators ────────────────────────────────────────────────────

describe("createGrowthLogSchema", () => {
  const valid = { weight_kg: 250, recorded_date: "2025-01-15" };

  it("should accept valid growth log", () => {
    expect(createGrowthLogSchema.safeParse(valid).success).toBe(true);
  });

  it("should reject missing weight", () => {
    expect(createGrowthLogSchema.safeParse({ recorded_date: "2025-01-15" }).success).toBe(false);
  });

  it("should reject zero or negative weight", () => {
    expect(createGrowthLogSchema.safeParse({ ...valid, weight_kg: 0 }).success).toBe(false);
    expect(createGrowthLogSchema.safeParse({ ...valid, weight_kg: -5 }).success).toBe(false);
  });

  it("should reject missing recorded_date", () => {
    expect(createGrowthLogSchema.safeParse({ weight_kg: 250 }).success).toBe(false);
  });

  it("should accept optional notes", () => {
    expect(createGrowthLogSchema.safeParse({ ...valid, notes: "Healthy" }).success).toBe(true);
  });
});

describe("updateGrowthLogSchema", () => {
  it("should accept empty object", () => {
    expect(updateGrowthLogSchema.safeParse({}).success).toBe(true);
  });

  it("should accept partial weight update", () => {
    expect(updateGrowthLogSchema.safeParse({ weight_kg: 300 }).success).toBe(true);
  });
});

// ─── Health Incident Validators ───────────────────────────────────────────────

describe("createHealthIncidentSchema", () => {
  it("should accept empty object (all optional)", () => {
    expect(createHealthIncidentSchema.safeParse({}).success).toBe(true);
  });

  it("should accept all fields", () => {
    expect(createHealthIncidentSchema.safeParse({
      incident_date: "2025-01-15",
      disease_name: "Mastitis",
      severity: "High",
      symptoms: "Swollen udder",
      treatment: "Antibiotics",
      status: "Active",
      veterinarian_id: 5,
    }).success).toBe(true);
  });

  it("should accept null fields", () => {
    expect(createHealthIncidentSchema.safeParse({
      incident_date: null,
      disease_name: null,
      veterinarian_id: null,
    }).success).toBe(true);
  });
});

describe("healthIncidentIdParamSchema", () => {
  it("should transform both id and incidentId", () => {
    const result = healthIncidentIdParamSchema.safeParse({ id: "1", incidentId: "2" });
    if (result.success) {
      expect(result.data.id).toBe(1);
      expect(result.data.incidentId).toBe(2);
    }
  });

  it("should reject non-numeric values", () => {
    expect(healthIncidentIdParamSchema.safeParse({ id: "a", incidentId: "b" }).success).toBe(false);
  });
});