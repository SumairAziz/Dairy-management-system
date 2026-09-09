import { z } from "zod";

export const productionStatusActionSchema = z.object({
  action: z.enum(["mark_dry", "mark_lactating"]),
  start_date: z.string().min(1).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type ProductionStatusActionInput = z.infer<typeof productionStatusActionSchema>;
