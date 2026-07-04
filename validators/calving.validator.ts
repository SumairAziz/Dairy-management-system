import { z } from "zod";

export const createCalvingSchema = z.object({
  mother_id: z.number().int().positive(),
  pregnancy_id: z.number().int().positive().nullable().optional(),
  calving_date: z.string().min(1, "Calving date is required"),
  outcome: z.string().max(30).nullable().optional(),
  calf_gender: z.string().length(1).nullable().optional(),
  calf_tag: z.string().max(50).nullable().optional(),
  calf_id: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateCalvingSchema = z.object({
  mother_id: z.number().int().positive().optional(),
  pregnancy_id: z.number().int().positive().nullable().optional(),
  calving_date: z.string().optional(),
  outcome: z.string().max(30).nullable().optional(),
  calf_gender: z.string().length(1).nullable().optional(),
  calf_tag: z.string().max(50).nullable().optional(),
  calf_id: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const calvingIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const calvingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  mother_id: z.coerce.number().int().positive().optional(),
  pregnancy_id: z.coerce.number().int().positive().optional(),
});

export type CreateCalvingInput = z.infer<typeof createCalvingSchema>;
export type UpdateCalvingInput = z.infer<typeof updateCalvingSchema>;
export type CalvingQueryParams = z.infer<typeof calvingQuerySchema>;
