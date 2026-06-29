import { z } from "zod";

export const createHealthIncidentSchema = z.object({
  incident_date: z.string().nullable().optional(),
  disease_name: z.string().max(200).nullable().optional(),
  severity: z.string().max(50).nullable().optional(),
  symptoms: z.string().nullable().optional(),
  treatment: z.string().nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  veterinarian_id: z.number().int().nullable().optional(),
});

export const updateHealthIncidentSchema = z.object({
  incident_date: z.string().nullable().optional(),
  disease_name: z.string().max(200).nullable().optional(),
  severity: z.string().max(50).nullable().optional(),
  symptoms: z.string().nullable().optional(),
  treatment: z.string().nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  veterinarian_id: z.number().int().nullable().optional(),
});

export type CreateHealthIncidentInput = z.infer<typeof createHealthIncidentSchema>;
export type UpdateHealthIncidentInput = z.infer<typeof updateHealthIncidentSchema>;
export const healthIncidentIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
  incidentId: z.string().regex(/^\d+$/).transform(Number),
});
