import { z } from "zod";

export const createMilkLogSchema = z.object({
  animal_id: z.number().int().positive("Animal is required"),
  production_date: z.string().min(1, "Production date is required"),
  session: z.enum(["Morning", "Afternoon", "Evening"]),
  milk_liters: z.number().positive("Milk liters must be positive"),
  quality_grade: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const milkLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  animal_id: z.coerce.number().int().positive().optional(),
  session: z.enum(["Morning", "Afternoon", "Evening"]).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  milk_min: z.coerce.number().positive().optional(),
  milk_max: z.coerce.number().positive().optional(),
});

export const milkLogIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export type CreateMilkLogInput = z.infer<typeof createMilkLogSchema>;
export type MilkLogQueryParams = z.infer<typeof milkLogQuerySchema>;
