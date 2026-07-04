import { z } from "zod";

export const createUnitSchema = z.object({
  farm_id: z.number().int().positive("Farm ID is required"),
  unit_name: z.string().min(1, "Unit name is required").max(100),
  unit_type: z.string().min(1, "Unit type is required").max(50),
  capacity: z.number().int().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateUnitSchema = z.object({
  farm_id: z.number().int().positive().optional(),
  unit_name: z.string().min(1).max(100).optional(),
  unit_type: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export const unitIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});
