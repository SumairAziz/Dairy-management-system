import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/reports", () => ({
  buildPeriodReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
  buildFarmComparisonReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
  buildMilkAnalysisReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
  buildPregnancyAnalysisReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
  buildVaccinationReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
  buildBreedingReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
  buildHealthReport: vi.fn().mockResolvedValue({ type: "report", title: "stub" }),
}));

import * as reports from "@/lib/ai/reports";
import { reportTools } from "@/lib/ai/tools/reports.tools";

const ctx = { userId: 1, role: "ADMIN" };
const find = (name: string) => reportTools.find((t) => t.name === name)!;

describe("ai tools: reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateDailyReport calls buildPeriodReport('daily', date)", async () => {
    await find("generateDailyReport").handler({ date: "2026-08-01" }, ctx);
    expect(reports.buildPeriodReport).toHaveBeenCalledWith("daily", "2026-08-01");
  });

  it("generateWeeklyReport calls buildPeriodReport('weekly', week_ending)", async () => {
    await find("generateWeeklyReport").handler({ week_ending: "2026-08-07" }, ctx);
    expect(reports.buildPeriodReport).toHaveBeenCalledWith("weekly", "2026-08-07");
  });

  it("generateMonthlyReport calls buildPeriodReport('monthly', month)", async () => {
    await find("generateMonthlyReport").handler({ month: "2026-08-01" }, ctx);
    expect(reports.buildPeriodReport).toHaveBeenCalledWith("monthly", "2026-08-01");
  });

  it("generateFarmComparisonReport forwards farm_ids", async () => {
    await find("generateFarmComparisonReport").handler({ farm_ids: [1, 2] }, ctx);
    expect(reports.buildFarmComparisonReport).toHaveBeenCalledWith([1, 2]);
  });

  it("generateMilkAnalysisReport forwards the date range", async () => {
    await find("generateMilkAnalysisReport").handler({ date_from: "2026-07-01", date_to: "2026-08-01" }, ctx);
    expect(reports.buildMilkAnalysisReport).toHaveBeenCalledWith("2026-07-01", "2026-08-01");
  });

  it("generatePregnancyAnalysisReport / VaccinationReport / BreedingReport / HealthReport take no args", async () => {
    await find("generatePregnancyAnalysisReport").handler({}, ctx);
    await find("generateVaccinationReport").handler({}, ctx);
    await find("generateBreedingReport").handler({}, ctx);
    await find("generateHealthReport").handler({}, ctx);
    expect(reports.buildPregnancyAnalysisReport).toHaveBeenCalledOnce();
    expect(reports.buildVaccinationReport).toHaveBeenCalledOnce();
    expect(reports.buildBreedingReport).toHaveBeenCalledOnce();
    expect(reports.buildHealthReport).toHaveBeenCalledOnce();
  });

  it("every report tool schema accepts an empty/minimal object where applicable", () => {
    expect(find("generateDailyReport").schema.safeParse({}).success).toBe(true);
    expect(find("generatePregnancyAnalysisReport").schema.safeParse({}).success).toBe(true);
  });
});
