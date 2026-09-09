import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    farms: { findMany: vi.fn(), findUnique: vi.fn() },
    animals: { count: vi.fn(), groupBy: vi.fn() },
    units: { aggregate: vi.fn() },
    health_incidents: { groupBy: vi.fn() },
    breeds: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { farmTools } from "@/lib/ai/tools/farms.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getFarms = farmTools.find((t) => t.name === "getFarms")!;
const getFarmStatistics = farmTools.find((t) => t.name === "getFarmStatistics")!;
const compareFarms = farmTools.find((t) => t.name === "compareFarms")!;

function mockFarmStatQueries() {
  vi.mocked(prisma.animals.count).mockResolvedValueOnce(10 as any); // active animal count
  vi.mocked(prisma.units.aggregate).mockResolvedValueOnce({ _sum: { capacity: 50 }, _count: 2 } as any);
  vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ liters: 120.5 }] as any); // milk last 30 days
  vi.mocked(prisma.health_incidents.groupBy).mockResolvedValueOnce([{ status: "Recovered", _count: 3 }] as any);
  vi.mocked(prisma.animals.groupBy).mockResolvedValueOnce([{ lifecycle_stage: "Lactating", _count: 5 }] as any);
  vi.mocked(prisma.animals.groupBy).mockResolvedValueOnce([{ breed_id: 1, _count: 4 }] as any);
  vi.mocked(prisma.animals.count).mockResolvedValueOnce(2 as any); // pregnant count
}

describe("ai tools: farms", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getFarms", () => {
    it("merges per-farm milk totals into the farm list", async () => {
      vi.mocked(prisma.farms.findMany).mockResolvedValue([
        { farm_id: 1, farm_name: "Green Valley", owner_name: null, city: null, province: null, is_active: true, total_area_acres: 10, _count: { animals: 3, units: 1 } },
      ] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ farm_id: 1, liters: 42.35 }] as any);

      const result: any = await getFarms.handler({}, ctx);
      expect(result[0].total_milk_liters_all_time).toBe(42.4);
    });
  });

  describe("getFarmStatistics", () => {
    it("returns found:false for a missing farm", async () => {
      vi.mocked(prisma.farms.findUnique).mockResolvedValue(null);
      const result = await getFarmStatistics.handler({ farm_id: 999 }, ctx);
      expect(result).toMatchObject({ found: false });
    });

    it("returns aggregated stats for an existing farm", async () => {
      vi.mocked(prisma.farms.findUnique).mockResolvedValue({
        farm_id: 1,
        farm_name: "Green Valley",
        owner_name: "Ali",
        city: "Lahore",
        province: "Punjab",
        total_area_acres: 20,
      } as any);
      mockFarmStatQueries();
      vi.mocked(prisma.breeds.findMany).mockResolvedValue([{ breed_id: 1, breed_name: "Holstein" }] as any);

      const result: any = await getFarmStatistics.handler({ farm_id: 1 }, ctx);
      expect(result.found).toBe(true);
      expect(result.active_animal_count).toBe(10);
      expect(result.milk_last_30_days_liters).toBe(120.5);
      expect(result.topBreeds).toEqual([{ breed: "Holstein", count: 4 }]);
    });
  });

  describe("compareFarms", () => {
    it("separates found farms from not-found ids", async () => {
      vi.mocked(prisma.farms.findUnique).mockResolvedValueOnce(null); // farm 999 missing
      vi.mocked(prisma.farms.findUnique).mockResolvedValueOnce({
        farm_id: 1,
        farm_name: "Green Valley",
        owner_name: null,
        city: null,
        province: null,
        total_area_acres: null,
      } as any);
      mockFarmStatQueries();
      vi.mocked(prisma.breeds.findMany).mockResolvedValue([]);

      const result: any = await compareFarms.handler({ farm_ids: [999, 1] }, ctx);
      expect(result.notFound).toEqual([999]);
      expect(result.farms).toHaveLength(1);
      expect(result.farms[0].farm_name).toBe("Green Valley");
    });

    it("rejects fewer than 2 farm_ids", () => {
      expect(compareFarms.schema.safeParse({ farm_ids: [1] }).success).toBe(false);
    });
  });
});
