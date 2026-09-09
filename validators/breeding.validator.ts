import { z } from "zod";

export const createBreedingRecordSchema = z.object({
  female_animal_id: z.number().int().positive().nullable().optional(),
  male_animal_id: z.number().int().positive().nullable().optional(),
  breeding_date: z.string().nullable().optional(),
  method: z.string().max(30).nullable().optional(),
  result: z.string().max(20).nullable().optional(),
  semen_batch_id: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateBreedingRecordSchema = z.object({
  female_animal_id: z.number().int().positive().nullable().optional(),
  male_animal_id: z.number().int().positive().nullable().optional(),
  breeding_date: z.string().nullable().optional(),
  method: z.string().max(30).nullable().optional(),
  result: z.string().max(20).nullable().optional(),
  semen_batch_id: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const breedingIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const breedingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  female_animal_id: z.coerce.number().int().positive().optional(),
  male_animal_id: z.coerce.number().int().positive().optional(),
  method: z.string().optional(),
  result: z.enum(["Success", "Failed", "Pending"]).optional(),
});

export type CreateBreedingRecordInput = z.infer<
  typeof createBreedingRecordSchema
>;
export type UpdateBreedingRecordInput = z.infer<
  typeof updateBreedingRecordSchema
>;
export type BreedingQueryParams = z.infer<typeof breedingQuerySchema>;
