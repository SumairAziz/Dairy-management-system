import { z } from "zod";
import { DEFAULT_MILK_TREND_PERIOD, MILK_TREND_PERIOD_IDS } from "@/lib/dashboard-milk-trend";

export const milkTrendQuerySchema = z.object({
  period: z.enum(MILK_TREND_PERIOD_IDS).default(DEFAULT_MILK_TREND_PERIOD),
});

export type MilkTrendQueryParams = z.infer<typeof milkTrendQuerySchema>;
