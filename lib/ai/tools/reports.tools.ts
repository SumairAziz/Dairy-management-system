import { z } from "zod";
import type { AiTool } from "../types";
import { objectSchema, str, arr } from "./json-schema";
import { dateStringSchema } from "./common";
import {
  buildPeriodReport,
  buildFarmComparisonReport,
  buildMilkAnalysisReport,
  buildPregnancyAnalysisReport,
  buildVaccinationReport,
  buildBreedingReport,
  buildHealthReport,
} from "../reports";

/**
 * Report tools return a fully pre-computed `ReportBlock` (summary, tables,
 * charts, insights, recommendations) — see `lib/ai/reports/*`. The model's
 * job for these is to present the block faithfully (wrap it in a `ui-report`
 * fenced block per the system prompt) rather than recompute any numbers
 * itself, which keeps report figures 100% traceable to the database.
 */

const generateDailyReportSchema = z.object({ date: dateStringSchema.optional() });
const generateDailyReport: AiTool<{ date?: string }> = {
  name: "generateDailyReport",
  category: "Reports",
  description: "Generate a daily farm report (milk total + trend context, top producers, calvings, overdue vaccinations, open health incidents, insights, recommendations) for one day, defaulting to today.",
  parameters: objectSchema({ date: str("Date YYYY-MM-DD, defaults to today.") }),
  schema: generateDailyReportSchema,
  async handler(args) {
    return buildPeriodReport("daily", args.date);
  },
};

const generateWeeklyReportSchema = z.object({ week_ending: dateStringSchema.optional() });
const generateWeeklyReport: AiTool<{ week_ending?: string }> = {
  name: "generateWeeklyReport",
  category: "Reports",
  description: "Generate a weekly farm report covering the 7 days ending on `week_ending` (defaults to today).",
  parameters: objectSchema({ week_ending: str("Last day of the week, YYYY-MM-DD. Defaults to today.") }),
  schema: generateWeeklyReportSchema,
  async handler(args) {
    return buildPeriodReport("weekly", args.week_ending);
  },
};

const generateMonthlyReportSchema = z.object({ month: dateStringSchema.optional() });
const generateMonthlyReport: AiTool<{ month?: string }> = {
  name: "generateMonthlyReport",
  category: "Reports",
  description: "Generate a monthly farm report for the calendar month containing `month` (any date within the target month; defaults to the current month).",
  parameters: objectSchema({ month: str("Any date YYYY-MM-DD within the target month. Defaults to today's month.") }),
  schema: generateMonthlyReportSchema,
  async handler(args) {
    return buildPeriodReport("monthly", args.month);
  },
};

const generateFarmComparisonReportSchema = z.object({ farm_ids: z.array(z.number().int()).min(2).max(6) });
const generateFarmComparisonReport: AiTool<{ farm_ids: number[] }> = {
  name: "generateFarmComparisonReport",
  category: "Reports",
  description: "Generate a full comparison report (table + chart + insights) for 2-6 farms. Use `getFarms` first to resolve farm names to ids.",
  parameters: objectSchema({ farm_ids: arr({ type: "integer" }, "2 to 6 farm_id values.") }, ["farm_ids"]),
  schema: generateFarmComparisonReportSchema,
  async handler(args) {
    return buildFarmComparisonReport(args.farm_ids);
  },
};

const generateMilkAnalysisReportSchema = z.object({ date_from: dateStringSchema.optional(), date_to: dateStringSchema.optional() });
const generateMilkAnalysisReport: AiTool<{ date_from?: string; date_to?: string }> = {
  name: "generateMilkAnalysisReport",
  category: "Reports",
  description: "Generate a detailed milk production analysis report (trend chart, per-farm table, top producers, session split, insights) over a date range. Defaults to the last 30 days.",
  parameters: objectSchema({ date_from: str("Start date YYYY-MM-DD."), date_to: str("End date YYYY-MM-DD.") }),
  schema: generateMilkAnalysisReportSchema,
  async handler(args) {
    return buildMilkAnalysisReport(args.date_from, args.date_to);
  },
};

const generatePregnancyAnalysisReport: AiTool<Record<string, never>> = {
  name: "generatePregnancyAnalysisReport",
  category: "Reports",
  description: "Generate a farm-wide pregnancy analysis report: status distribution, upcoming deliveries, overdue pregnancies, insights and recommendations.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    return buildPregnancyAnalysisReport();
  },
};

const generateVaccinationReport: AiTool<Record<string, never>> = {
  name: "generateVaccinationReport",
  category: "Reports",
  description: "Generate a farm-wide vaccination report: overdue/due-today/due-soon/upcoming counts, overdue list, breakdown by vaccine, and recommendations.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    return buildVaccinationReport();
  },
};

const generateBreedingReport: AiTool<Record<string, never>> = {
  name: "generateBreedingReport",
  category: "Reports",
  description: "Generate a farm-wide breeding performance report: success rate, outcomes/method breakdown, repeat breeders, and recommendations.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    return buildBreedingReport();
  },
};

const generateHealthReport: AiTool<Record<string, never>> = {
  name: "generateHealthReport",
  category: "Reports",
  description: "Generate a farm-wide herd health report: open incidents, severity/disease breakdown, and recommendations.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    return buildHealthReport();
  },
};

export const reportTools: AiTool<any, any>[] = [
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  generateFarmComparisonReport,
  generateMilkAnalysisReport,
  generatePregnancyAnalysisReport,
  generateVaccinationReport,
  generateBreedingReport,
  generateHealthReport,
];
