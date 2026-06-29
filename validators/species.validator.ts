import { z } from "zod";

export const createSpeciesSchema = z.object({
  species_name: z.string().min(1, "Species name is required").max(100),
  scientific_name: z.string().max(150).nullable().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateSpeciesSchema = z.object({
  species_name: z.string().min(1).max(100).optional(),
  scientific_name: z.string().max(150).nullable().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const speciesIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export type CreateSpeciesInput = z.infer<typeof createSpeciesSchema>;
export type UpdateSpeciesInput = z.infer<typeof updateSpeciesSchema>;
