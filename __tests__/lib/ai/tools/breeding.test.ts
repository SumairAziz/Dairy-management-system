import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    breeding_records: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    animals: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { breedingTools } from "@/lib/ai/tools/breeding.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getBreedingRecords = breedingTools.find((t) => t.name === "getBreedingRecords")!;
const getRepeatBreeders = breedingTools.find((t) => t.name === "getRepeatBreeders")!;

describe("ai tools: breeding", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getBreedingRecords", () => {
    it("treats result:'Pending' as (Pending OR null)", async () => {
      vi.mocked(prisma.breeding_records.findMany).mockResolvedValue([]);
      vi.mocked(prisma.breeding_records.count).mockResolvedValue(0);

      await getBreedingRecords.handler({ result: "Pending", limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.breeding_records.findMany).mock.calls[0][0] as any;
      expect(call.where.OR).toEqual([{ result: "Pending" }, { result: null }]);
    });

    it("maps records with defaulted result label", async () => {
      vi.mocked(prisma.breeding_records.findMany).mockResolvedValue([
        {
          breeding_id: 1,
          breeding_date: "2026-01-01",
          method: "AI",
          result: null,
          animals_breeding_records_female_animal_idToanimals: { tag_number: "F-01" },
          animals_breeding_records_male_animal_idToanimals: { tag_number: "M-01" },
        },
      ] as any);
      vi.mocked(prisma.breeding_records.count).mockResolvedValue(1);

      const result: any = await getBreedingRecords.handler({ limit: 100 } as any, ctx);
      expect(result.records[0]).toMatchObject({ female: "F-01", male: "M-01", result: "Pending" });
    });
  });

  describe("getRepeatBreeders", () => {
    it("flags animals meeting the min_attempts threshold", async () => {
      vi.mocked(prisma.breeding_records.groupBy).mockResolvedValue([
        { female_animal_id: 7, _count: { female_animal_id: 3 } },
      ] as any);
      vi.mocked(prisma.animals.findMany).mockResolvedValue([
        { animal_id: 7, tag_number: "T-007", animal_name: null, farms: { farm_name: "Green Valley" } },
      ] as any);

      const result: any = await getRepeatBreeders.handler({ min_attempts: 3 } as any, ctx);
      expect(result.animals[0]).toMatchObject({ animal_id: 7, tag_number: "T-007", failedOrPendingAttempts: 3 });
    });

    it("returns an empty list when no groups meet the threshold", async () => {
      vi.mocked(prisma.breeding_records.groupBy).mockResolvedValue([] as any);
      const result: any = await getRepeatBreeders.handler({ min_attempts: 5 } as any, ctx);
      expect(result.animals).toEqual([]);
      expect(prisma.animals.findMany).not.toHaveBeenCalled();
    });
  });
});
