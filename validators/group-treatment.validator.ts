import { z } from "zod";

export const groupTreatmentSchema = z.object({
  farm_id: z.number().int().positive(),
  unit_id: z.number().int().positive(),
  treatment_type: z.enum(["vaccination", "medicine"]),
  inventory_item_id: z.number().int().positive(),
  treatment_date: z.string().min(1, "Treatment date is required"),
  dosage_per_animal: z.number().positive("Dosage per animal must be positive"),
  animal_ids: z.array(z.number().int().positive()).min(1, "Select at least one animal"),
  administered_by: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  next_due_date: z.string().nullable().optional(),
  allow_duplicates: z.boolean().optional().default(false),
});

export const groupTreatmentProductsQuerySchema = z.object({
  farm_id: z.coerce.number().int().positive(),
  treatment_type: z.enum(["vaccination", "medicine"]),
  search: z.string().optional(),
});

export type GroupTreatmentInput = z.infer<typeof groupTreatmentSchema>;
export type GroupTreatmentProductsQuery = z.infer<
  typeof groupTreatmentProductsQuerySchema
>;
