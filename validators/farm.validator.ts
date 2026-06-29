import { z } from "zod";

export const createFarmSchema = z.object({
  farm_name: z.string().min(1, "Farm name is required").max(100),
  owner_name: z.string().max(100).nullable().optional(),
  contact_number: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  total_area_acres: z.number().positive().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateFarmSchema = z.object({
  farm_name: z.string().min(1).max(100).optional(),
  owner_name: z.string().max(100).nullable().optional(),
  contact_number: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  total_area_acres: z.number().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const farmIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export type CreateFarmInput = z.infer<typeof createFarmSchema>;
export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
