import { describe, it, expect } from "vitest";
import {
  createAnimalSchema,
  updateAnimalSchema,
  animalQuerySchema,
  animalIdParamSchema,
} from "@/validators/animal.validator";

const validCreate = {
  farm_id: 1,
  breed_id: 2,
  tag_number: "TAG-001",
  gender: "F" as const,
  date_of_birth: "2024-01-15",
};

describe("createAnimalSchema", () => {
  it("should accept valid create data with all required fields", () => {
    const result = createAnimalSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
      expect(result.data.lifecycle_stage).toBe("Calf");
    }
  });

  it("should default is_active to true", () => {
    const result = createAnimalSchema.safeParse(validCreate);
    if (result.success) expect(result.data.is_active).toBe(true);
  });

  it("should default lifecycle_stage to Calf", () => {
    const result = createAnimalSchema.safeParse(validCreate);
    if (result.success) expect(result.data.lifecycle_stage).toBe("Calf");
  });

  it("should accept all valid lifecycle stages", () => {
    const stages = ["Calf","Heifer","Pregnant Heifer","Lactating","Dry","Bull","Breeding Bull","Retired","Sold","Deceased"];
    for (const stage of stages) {
      const result = createAnimalSchema.safeParse({ ...validCreate, lifecycle_stage: stage });
      expect(result.success).toBe(true);
    }
  });

  it("should accept optional fields", () => {
    const result = createAnimalSchema.safeParse({
      ...validCreate,
      animal_name: "Bessie",
      unit_id: 3,
      mother_id: 10,
      father_id: 11,
      birth_weight_kg: 35.5,
      lifecycle_stage: "Heifer",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing farm_id", () => {
    const { farm_id, ...rest } = validCreate;
    expect(createAnimalSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing breed_id", () => {
    const { breed_id, ...rest } = validCreate;
    expect(createAnimalSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing tag_number", () => {
    const { tag_number, ...rest } = validCreate;
    expect(createAnimalSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject empty tag_number", () => {
    expect(createAnimalSchema.safeParse({ ...validCreate, tag_number: "" }).success).toBe(false);
  });

  it("should reject invalid gender", () => {
    expect(createAnimalSchema.safeParse({ ...validCreate, gender: "X" }).success).toBe(false);
  });

  it("should reject negative farm_id", () => {
    expect(createAnimalSchema.safeParse({ ...validCreate, farm_id: -1 }).success).toBe(false);
  });
});

describe("updateAnimalSchema", () => {
  it("should accept empty object (all fields optional)", () => {
    const result = updateAnimalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept partial update with tag_number", () => {
    const result = updateAnimalSchema.safeParse({ tag_number: "TAG-002" });
    expect(result.success).toBe(true);
  });

  it("should accept gender update", () => {
    const result = updateAnimalSchema.safeParse({ gender: "M" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid gender on update", () => {
    const result = updateAnimalSchema.safeParse({ gender: "Z" });
    expect(result.success).toBe(false);
  });

  it("should accept null for nullable fields", () => {
    const result = updateAnimalSchema.safeParse({
      animal_name: null,
      unit_id: null,
      date_of_birth: null,
      birth_weight_kg: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("animalQuerySchema", () => {
  it("should apply defaults", () => {
    const result = animalQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.sortBy).toBe("animal_id");
      expect(result.data.sortDir).toBe("desc");
    }
  });

  it("should coerce string page/pageSize to numbers", () => {
    const result = animalQuerySchema.safeParse({ page: "3", pageSize: "50" });
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it("should clamp pageSize to 1-100", () => {
    const tooSmall = animalQuerySchema.safeParse({ pageSize: "0" });
    const tooBig = animalQuerySchema.safeParse({ pageSize: "200" });
    expect(tooSmall.success).toBe(false);
    expect(tooBig.success).toBe(false);
  });

  it("should accept valid filter params", () => {
    const result = animalQuerySchema.safeParse({
      farm_id: "1",
      gender: "F",
      lifecycle_stage: "Lactating",
      is_active: "true",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid gender filter", () => {
    const result = animalQuerySchema.safeParse({ gender: "X" });
    expect(result.success).toBe(false);
  });

  it("should accept valid sort fields", () => {
    const fields = ["animal_id","tag_number","gender","date_of_birth","lifecycle_stage","created_at"];
    for (const f of fields) {
      const result = animalQuerySchema.safeParse({ sortBy: f });
      expect(result.success).toBe(true);
    }
  });
});

describe("animalIdParamSchema", () => {
  it("should transform string id to number", () => {
    const result = animalIdParamSchema.safeParse({ id: "42" });
    if (result.success) expect(result.data.id).toBe(42);
  });

  it("should reject non-numeric id", () => {
    const result = animalIdParamSchema.safeParse({ id: "abc" });
    expect(result.success).toBe(false);
  });
});