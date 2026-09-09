import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    animals: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { animalTools } from "@/lib/ai/tools/animals.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getAnimals = animalTools.find((t) => t.name === "getAnimals")!;
const getAnimalHistory = animalTools.find((t) => t.name === "getAnimalHistory")!;

describe("ai tools: animals", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getAnimals", () => {
    it("returns a transformed list and totals", async () => {
      vi.mocked(prisma.animals.findMany).mockResolvedValue([
        {
          animal_id: 1,
          tag_number: "T-001",
          animal_name: "Bessie",
          gender: "F",
          date_of_birth: "2022-01-01",
          lifecycle_stage: "Lactating",
          is_active: true,
          pregnancy_status: null,
          lactation_status: "LACTATING",
          farms: { farm_id: 1, farm_name: "Green Valley" },
          breeds: { breed_name: "Holstein", species: { species_name: "Cattle" } },
        },
      ] as any);
      vi.mocked(prisma.animals.count).mockResolvedValue(1);

      const result = await getAnimals.handler({ limit: 50 } as any, ctx);
      expect(result).toMatchObject({
        totalMatching: 1,
        returned: 1,
        truncated: false,
        animals: [{ animal_id: 1, tag_number: "T-001", farm: "Green Valley", breed: "Holstein", species: "Cattle" }],
      });
    });

    it("builds a pregnant_only filter using active pregnancy statuses", async () => {
      vi.mocked(prisma.animals.findMany).mockResolvedValue([]);
      vi.mocked(prisma.animals.count).mockResolvedValue(0);

      await getAnimals.handler({ pregnant_only: true } as any, ctx);

      const call = vi.mocked(prisma.animals.findMany).mock.calls[0][0] as any;
      expect(call.where.pregnancy_records.some.status.in).toEqual(["Pending", "Confirmed", "In Progress"]);
    });

    it("rejects invalid arguments via its zod schema", () => {
      const result = getAnimals.schema.safeParse({ gender: "X" });
      expect(result.success).toBe(false);
    });
  });

  describe("getAnimalHistory", () => {
    it("returns found:false when the animal does not exist", async () => {
      vi.mocked(prisma.animals.findUnique).mockResolvedValue(null);
      const result = await getAnimalHistory.handler({ animal_id: 999 }, ctx);
      expect(result).toEqual({ found: false, message: expect.stringContaining("999") });
    });

    it("returns a full profile bundle when the animal exists", async () => {
      vi.mocked(prisma.animals.findUnique).mockResolvedValue({
        animal_id: 5,
        tag_number: "T-005",
        animal_name: null,
        gender: "F",
        date_of_birth: "2021-05-01",
        lifecycle_stage: "Dry",
        is_active: true,
        pregnancy_status: null,
        lactation_status: "DRY",
        farms: { farm_name: "Sunrise" },
        units: { unit_name: "Barn 1" },
        breeds: { breed_name: "Jersey", species: { species_name: "Cattle" } },
        milk_logs: [],
        health_incidents: [],
        vaccination_records: [],
        growth_logs: [],
        heat_cycle_records: [],
        pregnancy_records: [],
        breeding_records_breeding_records_female_animal_idToanimals: [],
      } as any);

      const result: any = await getAnimalHistory.handler({ animal_id: 5 }, ctx);
      expect(result.found).toBe(true);
      expect(result.profile.tag_number).toBe("T-005");
      expect(result.profile.farm).toBe("Sunrise");
    });
  });
});
