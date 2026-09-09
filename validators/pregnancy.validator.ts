import { z } from "zod";

export const createPregnancyRecordSchema = z.object({
  animal_id: z.number().int().positive("Animal is required"),
  insemination_date: z.string().min(1, "Insemination date is required"),
  pregnancy_confirmed: z.boolean().nullable().optional(),
  confirmation_date: z.string().nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  actual_delivery_date: z.string().nullable().optional(),
  status: z.string().max(20).default("Pending"),
});

export const updatePregnancyRecordSchema = z.object({
  insemination_date: z.string().optional(),
  pregnancy_confirmed: z.boolean().nullable().optional(),
  confirmation_date: z.string().nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  actual_delivery_date: z.string().nullable().optional(),
  status: z.string().max(20).nullable().optional(),
});

export const pregnancyIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const pregnancyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  animal_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  confirmed: z.enum(["yes", "no"]).optional(),
});

export type CreatePregnancyRecordInput = z.infer<
  typeof createPregnancyRecordSchema
>;
export type UpdatePregnancyRecordInput = z.infer<
  typeof updatePregnancyRecordSchema
>;
export type PregnancyQueryParams = z.infer<typeof pregnancyQuerySchema>;
