import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    heat_cycle_records: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    pregnancy_records: { findMany: vi.fn(), count: vi.fn() },
    calving_records: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    animals: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { reproductionTools } from "@/lib/ai/tools/reproduction.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getHeatCycles = reproductionTools.find((t) => t.name === "getHeatCycles")!;
const getRepeatHeatAnimals = reproductionTools.find((t) => t.name === "getRepeatHeatAnimals")!;
const getPregnancyRecords = reproductionTools.find((t) => t.name === "getPregnancyRecords")!;
const getCalvingRecords = reproductionTools.find((t) => t.name === "getCalvingRecords")!;
const getCalvingSummary = reproductionTools.find((t) => t.name === "getCalvingSummary")!;

describe("ai tools: reproduction", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getHeatCycles", () => {
    it("filters currently-in-heat records (no end date)", async () => {
      vi.mocked(prisma.heat_cycle_records.findMany).mockResolvedValue([]);
      vi.mocked(prisma.heat_cycle_records.count).mockResolvedValue(0);

      await getHeatCycles.handler({ currently_in_heat: true, limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.heat_cycle_records.findMany).mock.calls[0][0] as any;
      expect(call.where.heat_end_date).toBeNull();
    });
  });

  describe("getRepeatHeatAnimals", () => {
    it("flags animals with enough cycles in the window", async () => {
      vi.mocked(prisma.heat_cycle_records.groupBy).mockResolvedValue([
        { animal_id: 9, _count: { animal_id: 4 } },
      ] as any);
      vi.mocked(prisma.animals.findMany).mockResolvedValue([
        { animal_id: 9, tag_number: "T-009", animal_name: null, pregnancy_status: null, farms: { farm_name: "Sunrise" } },
      ] as any);

      const result: any = await getRepeatHeatAnimals.handler({ min_cycles: 3, within_days: 90 } as any, ctx);
      expect(result.animals[0]).toMatchObject({ tag_number: "T-009", heatCyclesInWindow: 4 });
    });
  });

  describe("getPregnancyRecords", () => {
    it("maps status:'active' to the active-status set", async () => {
      vi.mocked(prisma.pregnancy_records.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pregnancy_records.count).mockResolvedValue(0);

      await getPregnancyRecords.handler({ status: "active", limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.pregnancy_records.findMany).mock.calls[0][0] as any;
      expect(call.where.status.in).toEqual(["Pending", "Confirmed", "In Progress"]);
    });

    it("maps status:'overdue' to Confirmed + expected_delivery_date in the past", async () => {
      vi.mocked(prisma.pregnancy_records.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pregnancy_records.count).mockResolvedValue(0);

      await getPregnancyRecords.handler({ status: "overdue", limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.pregnancy_records.findMany).mock.calls[0][0] as any;
      expect(call.where.status).toBe("Confirmed");
      expect(call.where.expected_delivery_date.lt).toBeInstanceOf(Date);
    });

    it("combines due_within_days with a non-terminal status default", async () => {
      vi.mocked(prisma.pregnancy_records.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pregnancy_records.count).mockResolvedValue(0);

      await getPregnancyRecords.handler({ due_within_days: 30, limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.pregnancy_records.findMany).mock.calls[0][0] as any;
      expect(call.where.status.notIn).toEqual(["Delivered", "Failed", "Aborted"]);
      expect(call.where.expected_delivery_date.gte).toBeInstanceOf(Date);
    });
  });

  describe("getCalvingRecords", () => {
    it("maps mother/calf fields", async () => {
      vi.mocked(prisma.calving_records.findMany).mockResolvedValue([
        {
          calving_id: 1,
          calving_date: "2026-02-01",
          outcome: "Live Birth",
          calf_gender: "F",
          calf_tag: null,
          mother: { tag_number: "M-01", farms: { farm_name: "Green Valley" } },
          calf: { tag_number: "C-01" },
        },
      ] as any);
      vi.mocked(prisma.calving_records.count).mockResolvedValue(1);

      const result: any = await getCalvingRecords.handler({ limit: 100 } as any, ctx);
      expect(result.records[0]).toMatchObject({ mother_tag: "M-01", farm: "Green Valley", calf_tag: "C-01" });
    });
  });

  describe("getCalvingSummary", () => {
    it("summarizes totals, outcome, gender, and monthly trend", async () => {
      vi.mocked(prisma.calving_records.count).mockResolvedValue(12);
      vi.mocked(prisma.calving_records.groupBy)
        .mockResolvedValueOnce([{ outcome: "Live Birth", _count: 10 }] as any)
        .mockResolvedValueOnce([{ calf_gender: "F", _count: 6 }, { calf_gender: "M", _count: 6 }] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ month: "2026-01", count: 2 }] as any);

      const result: any = await getCalvingSummary.handler({ year: 2026 }, ctx);
      expect(result.totalCalvingEvents).toBe(12);
      expect(result.byGender).toEqual([
        { gender: "Female", count: 6 },
        { gender: "Male", count: 6 },
      ]);
      expect(result.monthlyTrend).toEqual([{ month: "2026-01", count: 2 }]);
    });
  });
});
