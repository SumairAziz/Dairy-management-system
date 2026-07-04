import { z } from "zod";

export const createVaccinationSchema = z.object({
  animal_id: z.number().int().positive().nullable().optional(),
  vaccine_name: z.string().max(100).nullable().optional(),
  vaccination_date: z.string().nullable().optional(),
  next_due_date: z.string().nullable().optional(),
  administered_by: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  // Pregnancy workflow fields (not exposed in the manual create form)
  source: z.string().max(50).nullable().optional(),
  pregnancy_id: z.number().int().positive().nullable().optional(),
});

export const updateVaccinationSchema = z.object({
  animal_id: z.number().int().positive().nullable().optional(),
  vaccine_name: z.string().max(100).nullable().optional(),
  vaccination_date: z.string().nullable().optional(),
  next_due_date: z.string().nullable().optional(),
  administered_by: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.string().max(50).nullable().optional(),
  pregnancy_id: z.number().int().positive().nullable().optional(),
});

export const vaccinationIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const vaccinationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  animal_id: z.coerce.number().int().positive().optional(),
  vaccine_name: z.string().optional(),
  upcoming: z.enum(["true", "false"]).optional(),
  source: z.string().optional(),
  pregnancy_id: z.coerce.number().int().positive().optional(),
});

export type CreateVaccinationInput = z.infer<typeof createVaccinationSchema>;
export type UpdateVaccinationInput = z.infer<typeof updateVaccinationSchema>;
export type VaccinationQueryParams = z.infer<typeof vaccinationQuerySchema>;
