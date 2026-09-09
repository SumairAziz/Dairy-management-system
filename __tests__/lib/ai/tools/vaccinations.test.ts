import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    vaccination_records: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));

import { prisma } from "@/lib/db";
import { vaccinationTools } from "@/lib/ai/tools/vaccinations.tools";

const ctx = { userId: 1, role: "ADMIN" };
const getVaccinationStatus = vaccinationTools.find((t) => t.name === "getVaccinationStatus")!;

describe("ai tools: vaccinations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies the overdue status filter and returns mapped records", async () => {
    vi.mocked(prisma.vaccination_records.findMany).mockResolvedValue([
      {
        vaccination_id: 1,
        vaccine_name: "FMD",
        vaccination_date: "2026-01-01",
        next_due_date: "2026-07-01",
        administered_by: "Dr. Aisha",
        animals: { tag_number: "T-001", animal_name: null, farms: { farm_name: "Green Valley" } },
      },
    ] as any);
    vi.mocked(prisma.vaccination_records.count).mockResolvedValue(1);

    const result: any = await getVaccinationStatus.handler({ status: "overdue", limit: 100 } as any, ctx);

    const call = vi.mocked(prisma.vaccination_records.findMany).mock.calls[0][0] as any;
    expect(call.where.next_due_date.lt).toBeInstanceOf(Date);
    expect(result.totalMatching).toBe(1);
    expect(result.records[0]).toMatchObject({ animal_tag: "T-001", farm: "Green Valley", vaccine_name: "FMD" });
  });

  it("scopes to a single farm when farm_id is given", async () => {
    vi.mocked(prisma.vaccination_records.findMany).mockResolvedValue([]);
    vi.mocked(prisma.vaccination_records.count).mockResolvedValue(0);

    await getVaccinationStatus.handler({ farm_id: 3, limit: 100 } as any, ctx);
    const call = vi.mocked(prisma.vaccination_records.findMany).mock.calls[0][0] as any;
    expect(call.where.animals).toEqual({ farm_id: 3 });
  });

  it("rejects an invalid status enum value", () => {
    expect(getVaccinationStatus.schema.safeParse({ status: "not-a-status" }).success).toBe(false);
  });
});
