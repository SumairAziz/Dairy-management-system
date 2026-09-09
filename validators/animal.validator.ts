import { z } from "zod";

const LIFECYCLE_STAGES = [
  "Calf",
  "Heifer",
  "Pregnant Heifer",
  "Lactating",
  "Dry",
  "Bull",
  "Breeding Bull",
  "Retired",
  "Sold",
  "Deceased",
];
const SORT_FIELDS = [
  "animal_id",
  "tag_number",
  "gender",
  "date_of_birth",
  "lifecycle_stage",
  "created_at",
] as const;

export const createAnimalSchema = z.object({
  farm_id: z.number().int().positive("Farm is required"),
  unit_id: z.number().int().positive().nullable().optional(),
  breed_id: z.number().int().positive("Breed is required"),
  tag_number: z.string().min(1, "Tag number is required").max(50),
  animal_name: z.string().max(100).nullable().optional(),
  gender: z.enum(["M", "F"]),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  mother_id: z.number().int().positive().nullable().optional(),
  father_id: z.number().int().positive().nullable().optional(),
  birth_weight_kg: z.number().positive().nullable().optional(),
  lifecycle_stage: z.enum(LIFECYCLE_STAGES).default("Calf"),
  is_active: z.boolean().optional().default(true),
});

export const updateAnimalSchema = z.object({
  tag_number: z.string().min(1).max(50).optional(),
  animal_name: z.string().max(100).nullable().optional(),
  gender: z.enum(["M", "F"]).optional(),
  lifecycle_stage: z.string().max(20).optional(),
  is_active: z.boolean().optional(),
  farm_id: z.number().int().positive().nullable().optional(),
  unit_id: z.number().int().positive().nullable().optional(),
  breed_id: z.number().int().positive().nullable().optional(),
  mother_id: z.number().int().positive().nullable().optional(),
  father_id: z.number().int().positive().nullable().optional(),
  date_of_birth: z.string().min(1).optional(),
  birth_weight_kg: z.number().positive().nullable().optional(),
});

export const animalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  sortBy: z.enum(SORT_FIELDS).default("animal_id"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  farm_id: z.coerce.number().int().positive().optional(),
  unit_id: z.coerce.number().int().positive().optional(),
  breed_id: z.coerce.number().int().positive().optional(),
  species_id: z.coerce.number().int().positive().optional(),
  gender: z.enum(["M", "F"]).optional(),
  lifecycle_stage: z.string().optional(),
  tag_number: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional(),
  // Derived/relational filters used by the Animals page dashboard's quick-filter chips.
  pregnancy_status: z.enum(["PREGNANT", "CALVED", "FAILED"]).optional(),
  in_heat: z.enum(["true"]).optional(),
  breeding_eligible: z.enum(["true"]).optional(),
  vaccination_due: z.enum(["true"]).optional(),
  has_health_issue: z.enum(["true"]).optional(),
  stage_bucket: z.enum(["Calves", "Heifers", "Adults", "Seniors"]).optional(),
  production_status: z
    .enum(["lactating", "dry", "never_lactated", "not_applicable"])
    .optional(),
});

export const animalIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;
export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
export type AnimalQueryParams = z.infer<typeof animalQuerySchema>;
