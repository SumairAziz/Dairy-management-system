import { z } from "zod";
import { animalQuerySchema } from "@/validators/animal.validator";
import { breedingQuerySchema } from "@/validators/breeding.validator";
import { pregnancyQuerySchema } from "@/validators/pregnancy.validator";
import { vaccinationQuerySchema } from "@/validators/vaccination.validator";
import { heatCycleQuerySchema } from "@/validators/heat-cycle.validator";
import { EXPORT_PAGE_SIZE } from "./types";

const exportPageSize = z.coerce
  .number()
  .int()
  .min(1)
  .max(EXPORT_PAGE_SIZE)
  .default(EXPORT_PAGE_SIZE);

export const exportAnimalQuerySchema = animalQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: exportPageSize,
});

export const exportBreedingQuerySchema = breedingQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: exportPageSize,
});

export const exportPregnancyQuerySchema = pregnancyQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: exportPageSize,
  confirmed: z.enum(["yes", "no"]).optional(),
});

export const exportVaccinationQuerySchema = vaccinationQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: exportPageSize,
  animal_search: z.string().optional(),
  vaccine_search: z.string().optional(),
});

export const exportHeatCycleQuerySchema = heatCycleQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: exportPageSize,
  detection_method: z.string().optional(),
});

export const exportMilkQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: exportPageSize,
  animal_id: z.coerce.number().int().positive().optional(),
  farm_id: z.coerce.number().int().positive().optional(),
  session: z.enum(["Morning", "Afternoon", "Evening"]).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
});

export type ExportAnimalQuery = z.infer<typeof exportAnimalQuerySchema>;
export type ExportBreedingQuery = z.infer<typeof exportBreedingQuerySchema>;
export type ExportPregnancyQuery = z.infer<typeof exportPregnancyQuerySchema>;
export type ExportVaccinationQuery = z.infer<typeof exportVaccinationQuerySchema>;
export type ExportHeatCycleQuery = z.infer<typeof exportHeatCycleQuerySchema>;
export type ExportMilkQuery = z.infer<typeof exportMilkQuerySchema>;
