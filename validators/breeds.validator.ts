import { z } from "zod";

export const createBreedSchema = z.object({
  species_id: z.number().int().positive("Species ID is required"),
  breed_name: z.string().min(1, "Breed name is required").max(100),
  origin_country: z.string().max(100).nullable().optional(),
  average_milk_production: z.number().min(0).nullable().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateBreedSchema = z.object({
  species_id: z.number().int().positive().optional(),
  breed_name: z.string().min(1).max(100).optional(),
  origin_country: z.string().max(100).nullable().optional(),
  average_milk_production: z.number().min(0).nullable().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateBreedInput = z.infer<typeof createBreedSchema>;
export type UpdateBreedInput = z.infer<typeof updateBreedSchema>;
export const breedIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});
