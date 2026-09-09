import { z } from "zod";

export const createHeatCycleSchema = z.object({
  animal_id: z.number().int().positive().nullable().optional(),
  heat_start_date: z.string().nullable().optional(),
  heat_end_date: z.string().nullable().optional(),
  detection_method: z.string().max(20).nullable().optional(),
  confidence_score: z.number().min(0).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateHeatCycleSchema = z.object({
  animal_id: z.number().int().positive().nullable().optional(),
  heat_start_date: z.string().nullable().optional(),
  heat_end_date: z.string().nullable().optional(),
  detection_method: z.string().max(20).nullable().optional(),
  confidence_score: z.number().min(0).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const heatCycleIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const heatCycleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  animal_id: z.coerce.number().int().positive().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.enum(["in_heat", "due_today", "due_this_week", "upcoming", "overdue"]).optional(),
  detection_method: z.string().optional(),
});

export type CreateHeatCycleInput = z.infer<typeof createHeatCycleSchema>;
export type UpdateHeatCycleInput = z.infer<typeof updateHeatCycleSchema>;
export type HeatCycleQueryParams = z.infer<typeof heatCycleQuerySchema>;
