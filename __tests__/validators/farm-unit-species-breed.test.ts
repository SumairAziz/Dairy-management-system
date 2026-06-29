import { describe, it, expect } from "vitest";
import {
  createFarmSchema,
  updateFarmSchema,
  farmIdParamSchema,
} from "@/validators/farm.validator";
import {
  createUnitSchema,
  updateUnitSchema,
  unitIdParamSchema,
} from "@/validators/units.validator";
import {
  createSpeciesSchema,
  updateSpeciesSchema,
  speciesIdParamSchema,
} from "@/validators/species.validator";
import {
  createBreedSchema,
  updateBreedSchema,
  breedIdParamSchema,
} from "@/validators/breeds.validator";

// ─── Farm Validators ──────────────────────────────────────────────────────────

describe("createFarmSchema", () => {
  it("should accept valid farm with only required fields", () => {
    const result = createFarmSchema.safeParse({ farm_name: "Green Pastures" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_active).toBe(true);
  });

  it("should accept all optional fields", () => {
    const result = createFarmSchema.safeParse({
      farm_name: "Green Pastures",
      owner_name: "John",
      contact_number: "555-1234",
      address: "123 Farm Rd",
      city: "Lahore",
      province: "Punjab",
      country: "Pakistan",
      total_area_acres: 50.5,
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty farm_name", () => {
    expect(createFarmSchema.safeParse({ farm_name: "" }).success).toBe(false);
  });

  it("should reject farm_name over 100 chars", () => {
    expect(createFarmSchema.safeParse({ farm_name: "x".repeat(101) }).success).toBe(false);
  });

  it("should reject negative total_area_acres", () => {
    expect(createFarmSchema.safeParse({ farm_name: "A", total_area_acres: -1 }).success).toBe(false);
  });
});

describe("updateFarmSchema", () => {
  it("should accept empty object", () => {
    expect(updateFarmSchema.safeParse({}).success).toBe(true);
  });

  it("should accept partial update", () => {
    expect(updateFarmSchema.safeParse({ city: "Karachi" }).success).toBe(true);
  });
});

// ─── Unit Validators ──────────────────────────────────────────────────────────

describe("createUnitSchema", () => {
  const valid = { farm_id: 1, unit_name: "Barn A", unit_type: "Shed" };

  it("should accept valid unit", () => {
    const result = createUnitSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_active).toBe(true);
  });

  it("should reject missing farm_id", () => {
    expect(createUnitSchema.safeParse({ unit_name: "Barn", unit_type: "Shed" }).success).toBe(false);
  });

  it("should reject empty unit_name", () => {
    expect(createUnitSchema.safeParse({ ...valid, unit_name: "" }).success).toBe(false);
  });

  it("should reject empty unit_type", () => {
    expect(createUnitSchema.safeParse({ ...valid, unit_type: "" }).success).toBe(false);
  });

  it("should accept optional capacity and description", () => {
    const result = createUnitSchema.safeParse({ ...valid, capacity: 50, description: "Main barn" });
    expect(result.success).toBe(true);
  });
});

describe("updateUnitSchema", () => {
  it("should accept empty object", () => {
    expect(updateUnitSchema.safeParse({}).success).toBe(true);
  });
});

// ─── Species Validators ───────────────────────────────────────────────────────

describe("createSpeciesSchema", () => {
  it("should accept valid species", () => {
    const result = createSpeciesSchema.safeParse({ species_name: "Holstein" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_active).toBe(true);
  });

  it("should accept with optional fields", () => {
    const result = createSpeciesSchema.safeParse({
      species_name: "Bos taurus",
      scientific_name: "Bos taurus",
      description: "Domestic cattle",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty species_name", () => {
    expect(createSpeciesSchema.safeParse({ species_name: "" }).success).toBe(false);
  });

  it("should reject name over 100 chars", () => {
    expect(createSpeciesSchema.safeParse({ species_name: "x".repeat(101) }).success).toBe(false);
  });
});

// ─── Breed Validators ─────────────────────────────────────────────────────────

describe("createBreedSchema", () => {
  it("should accept valid breed", () => {
    const result = createBreedSchema.safeParse({ species_id: 1, breed_name: "Holstein" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_active).toBe(true);
  });

  it("should reject missing species_id", () => {
    expect(createBreedSchema.safeParse({ breed_name: "Holstein" }).success).toBe(false);
  });

  it("should reject empty breed_name", () => {
    expect(createBreedSchema.safeParse({ species_id: 1, breed_name: "" }).success).toBe(false);
  });

  it("should accept all optional fields", () => {
    const result = createBreedSchema.safeParse({
      species_id: 1,
      breed_name: "Jersey",
      origin_country: "UK",
      average_milk_production: 6000,
      description: "High butterfat",
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative average_milk_production", () => {
    expect(createBreedSchema.safeParse({
      species_id: 1, breed_name: "X", average_milk_production: -1,
    }).success).toBe(false);
  });
});

// ─── ID param schemas (shared pattern) ────────────────────────────────────────

describe("ID param schemas", () => {
  it("farmIdParamSchema should transform string to number", () => {
    const r = farmIdParamSchema.safeParse({ id: "10" });
    if (r.success) expect(r.data.id).toBe(10);
  });

  it("unitIdParamSchema should transform string to number", () => {
    const r = unitIdParamSchema.safeParse({ id: "10" });
    if (r.success) expect(r.data.id).toBe(10);
  });

  it("speciesIdParamSchema should transform string to number", () => {
    const r = speciesIdParamSchema.safeParse({ id: "10" });
    if (r.success) expect(r.data.id).toBe(10);
  });

  it("breedIdParamSchema should transform string to number", () => {
    const r = breedIdParamSchema.safeParse({ id: "10" });
    if (r.success) expect(r.data.id).toBe(10);
  });

  it("should reject non-numeric ids", () => {
    expect(farmIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
    expect(unitIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
    expect(speciesIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
    expect(breedIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});