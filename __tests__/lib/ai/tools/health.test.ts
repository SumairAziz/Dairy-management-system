import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    health_incidents: { findMany: vi.fn(), count: vi.fn() },
    treatment_records: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { healthTools } from "@/lib/ai/tools/health.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getHealthIncidents = healthTools.find((t) => t.name === "getHealthIncidents")!;
const getTreatments = healthTools.find((t) => t.name === "getTreatments")!;

describe("ai tools: health", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getHealthIncidents", () => {
    it("maps incident records with animal/farm context", async () => {
      vi.mocked(prisma.health_incidents.findMany).mockResolvedValue([
        {
          incident_id: 1,
          incident_date: "2026-03-01",
          disease_name: "Mastitis",
          severity: "Moderate",
          status: "Under Treatment",
          symptoms: "Swelling",
          animals: { tag_number: "T-001", animal_name: null, farms: { farm_name: "Green Valley" } },
        },
      ] as any);
      vi.mocked(prisma.health_incidents.count).mockResolvedValue(1);

      const result: any = await getHealthIncidents.handler({ limit: 100 } as any, ctx);
      expect(result.records[0]).toMatchObject({ animal_tag: "T-001", farm: "Green Valley", disease_name: "Mastitis" });
    });

    it("scopes by farm_id via the animals relation", async () => {
      vi.mocked(prisma.health_incidents.findMany).mockResolvedValue([]);
      vi.mocked(prisma.health_incidents.count).mockResolvedValue(0);

      await getHealthIncidents.handler({ farm_id: 2, limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.health_incidents.findMany).mock.calls[0][0] as any;
      expect(call.where.animals).toEqual({ farm_id: 2 });
    });
  });

  describe("getTreatments", () => {
    it("scopes to one incident", async () => {
      vi.mocked(prisma.treatment_records.findMany).mockResolvedValue([
        { treatment_id: 1, incident_id: 5, dosage: "10ml", treatment_date: "2026-03-02", remarks: "OK", health_incidents: { disease_name: "Mastitis" } },
      ] as any);

      const result: any = await getTreatments.handler({ incident_id: 5, limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.treatment_records.findMany).mock.calls[0][0] as any;
      expect(call.where.incident_id).toBe(5);
      expect(result[0]).toMatchObject({ disease_name: "Mastitis", dosage: "10ml" });
    });

    it("scopes to one animal via the health_incidents relation", async () => {
      vi.mocked(prisma.treatment_records.findMany).mockResolvedValue([]);
      await getTreatments.handler({ animal_id: 7, limit: 100 } as any, ctx);
      const call = vi.mocked(prisma.treatment_records.findMany).mock.calls[0][0] as any;
      expect(call.where.health_incidents).toEqual({ animal_id: 7 });
    });
  });
});
