import { describe, it, expect } from "vitest";
import { groupTreatmentSchema } from "@/validators/group-treatment.validator";

describe("groupTreatmentSchema", () => {
  const valid = {
    farm_id: 1,
    unit_id: 2,
    treatment_type: "vaccination" as const,
    inventory_item_id: 5,
    treatment_date: "2026-09-02",
    dosage_per_animal: 5,
    animal_ids: [10, 11],
  };

  it("accepts valid batch treatment payload", () => {
    expect(groupTreatmentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty animal list", () => {
    expect(groupTreatmentSchema.safeParse({ ...valid, animal_ids: [] }).success).toBe(false);
  });

  it("rejects non-positive dosage", () => {
    expect(groupTreatmentSchema.safeParse({ ...valid, dosage_per_animal: 0 }).success).toBe(false);
  });
});
