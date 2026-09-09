import { describe, it, expect, vi, beforeEach } from "vitest";

// Override the global setup.ts mock of @prisma/client with one that also
// supports the `Prisma.sql` / `Prisma.empty` tagged-template helpers used by
// milk.tools.ts's raw queries (setup.ts's version only covers the
// error-class shape needed by lib/errors.ts).
vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    empty: { strings: [""], values: [] },
    join: (parts: unknown[]) => parts,
    PrismaClientKnownRequestError: class extends Error {},
  },
  PrismaClient: class {},
}));

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { milkTools } from "@/lib/ai/tools/milk.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getMilkProduction = milkTools.find((t) => t.name === "getMilkProduction")!;
const getTopMilkProducers = milkTools.find((t) => t.name === "getTopMilkProducers")!;
const getBreedMilkRanking = milkTools.find((t) => t.name === "getBreedMilkRanking")!;

describe("ai tools: milk", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getMilkProduction", () => {
    it("aggregates a daily series and total", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { bucket: "2026-08-01", liters: 100 },
        { bucket: "2026-08-02", liters: 50.25 },
      ] as any);

      const result: any = await getMilkProduction.handler({ group_by: "day" } as any, ctx);
      expect(result.totalLiters).toBe(150.3);
      expect(result.series).toEqual([
        { label: "2026-08-01", liters: 100 },
        { label: "2026-08-02", liters: 50.3 },
      ]);
    });

    it("defaults to the last 30 days when no dates are given", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
      const result: any = await getMilkProduction.handler({ group_by: "farm" } as any, ctx);
      expect(result.dateRange.from < result.dateRange.to || result.dateRange.from === result.dateRange.to).toBe(true);
    });
  });

  describe("getTopMilkProducers", () => {
    it("returns a ranked list", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { animal_id: 1, tag_number: "T-001", animal_name: "Bessie", farm_name: "Green Valley", liters: 88.4 },
      ] as any);
      const result: any = await getTopMilkProducers.handler({ limit: 10 } as any, ctx);
      expect(result.topProducers[0]).toMatchObject({ tag_number: "T-001", totalLiters: 88.4 });
    });
  });

  describe("getBreedMilkRanking", () => {
    it("maps breed rows into a ranking", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { breed_name: "Holstein", species_name: "Cattle", reference_avg: 25, actual_avg_per_session: 21.666, sample_size: 30 },
      ] as any);
      const result: any = await getBreedMilkRanking.handler({}, ctx);
      expect(result[0]).toMatchObject({ breed: "Holstein", actualAveragePerSession: 21.7, sampleSize: 30 });
    });
  });
});
