import { z } from "zod";

export const createGrowthLogSchema = z.object({
  weight_kg: z.number().positive("Weight must be a positive number"),
  recorded_date: z.string().min(1, "Recorded date is required"),
  notes: z.string().nullable().optional(),
});

export const updateGrowthLogSchema = z.object({
  weight_kg: z.number().positive().optional(),
  recorded_date: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateGrowthLogInput = z.infer<typeof createGrowthLogSchema>;
export type UpdateGrowthLogInput = z.infer<typeof updateGrowthLogSchema>;