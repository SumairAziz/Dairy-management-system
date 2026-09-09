import { describe, it, expect, vi, beforeEach } from "vitest";

const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    animals: { findMany: vi.fn() },
    inventory_items: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    vaccination_records: { findMany: vi.fn(), create: vi.fn() },
    treatment_records: { findMany: vi.fn(), create: vi.fn() },
    health_incidents: { create: vi.fn() },
    inventory_transactions: { create: vi.fn() },
    group_treatment_batches: { create: vi.fn() },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/serialize", () => ({
  serialize: (v: unknown) => v,
}));

import * as groupTreatmentService from "@/services/group-treatment.service";
import { prisma } from "@/lib/db";

const baseInput = {
  farm_id: 1,
  unit_id: 2,
  treatment_type: "vaccination" as const,
  inventory_item_id: 10,
  treatment_date: "2026-09-02",
  dosage_per_animal: 5,
  animal_ids: [101, 102],
  administered_by: "Dr. Ali",
  notes: "Batch test",
  next_due_date: null,
  allow_duplicates: false,
};

describe("group-treatment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.animals.findMany).mockResolvedValue([
      { animal_id: 101, tag_number: "A-101", animal_name: "Bella" },
      { animal_id: 102, tag_number: "A-102", animal_name: "Daisy" },
    ] as never);
    vi.mocked(prisma.inventory_items.findFirst).mockResolvedValue({
      item_id: 10,
      item_name: "FMD Vaccine",
      category: "Vaccines",
      unit: "ml",
      quantity: 500,
      farm_id: 1,
    } as never);
    vi.mocked(prisma.vaccination_records.findMany).mockResolvedValue([]);
    vi.mocked(prisma.treatment_records.findMany).mockResolvedValue([]);
  });

  describe("previewGroupTreatment", () => {
    it("returns correct inventory calculation for selected animals", async () => {
      const preview = await groupTreatmentService.previewGroupTreatment(baseInput);
      expect(preview.summary.selected_count).toBe(2);
      expect(preview.summary.required_quantity).toBe(10);
      expect(preview.summary.available_stock).toBe(500);
      expect(preview.summary.remaining_after).toBe(490);
      expect(preview.summary.sufficient).toBe(true);
    });

    it("flags insufficient inventory", async () => {
      vi.mocked(prisma.inventory_items.findFirst).mockResolvedValue({
        item_id: 10,
        item_name: "FMD Vaccine",
        category: "Vaccines",
        unit: "ml",
        quantity: 5,
        farm_id: 1,
      } as never);

      const preview = await groupTreatmentService.previewGroupTreatment(baseInput);
      expect(preview.summary.sufficient).toBe(false);
      expect(preview.summary.shortfall).toBe(5);
    });

    it("returns duplicate animals for same vaccine and date", async () => {
      vi.mocked(prisma.vaccination_records.findMany).mockResolvedValue([
        {
          animal_id: 101,
          animals: { animal_id: 101, tag_number: "A-101", animal_name: "Bella" },
        },
      ] as never);

      const preview = await groupTreatmentService.previewGroupTreatment(baseInput);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.duplicates[0].animal_id).toBe(101);
    });
  });

  describe("executeGroupTreatment", () => {
    it("rejects when inventory is insufficient", async () => {
      vi.mocked(prisma.inventory_items.findFirst).mockResolvedValue({
        item_id: 10,
        item_name: "FMD Vaccine",
        category: "Vaccines",
        unit: "ml",
        quantity: 5,
        farm_id: 1,
      } as never);

      await expect(groupTreatmentService.executeGroupTreatment(baseInput)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it("rejects when duplicates exist and allow_duplicates is false", async () => {
      vi.mocked(prisma.vaccination_records.findMany).mockResolvedValue([
        {
          animal_id: 101,
          animals: { animal_id: 101, tag_number: "A-101", animal_name: "Bella" },
        },
      ] as never);

      await expect(groupTreatmentService.executeGroupTreatment(baseInput)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it("runs atomic transaction creating records and deducting inventory", async () => {
      transactionMock.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const tx = {
          group_treatment_batches: {
            create: vi.fn().mockResolvedValue({ batch_id: 99 }),
          },
          vaccination_records: { create: vi.fn().mockResolvedValue({}) },
          health_incidents: { create: vi.fn() },
          treatment_records: { create: vi.fn() },
          inventory_items: {
            findUnique: vi.fn().mockResolvedValue({ item_id: 10, quantity: 500, unit_cost: 1, supplier: "VetCo", expiry_date: null, updated_at: new Date() }),
            update: vi.fn().mockResolvedValue({}),
          },
          inventory_lots: {
            count: vi.fn().mockResolvedValue(1),
            findMany: vi.fn().mockResolvedValue([
              { lot_id: 1, remaining_quantity: 500, expiry_date: null, received_date: new Date() },
            ]),
            update: vi.fn().mockResolvedValue({}),
            create: vi.fn(),
          },
          inventory_transactions: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx as never);
      });

      const result = await groupTreatmentService.executeGroupTreatment(baseInput);
      expect(result.batch_id).toBe(99);
      expect(result.records_created).toBe(2);
      expect(result.total_quantity_used).toBe(10);
      expect(result.product_name).toBe("FMD Vaccine");
      expect(transactionMock).toHaveBeenCalledOnce();
    });
  });
});
