import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import {
  calculateInventorySummary,
  inventoryCategoriesForType,
  matchesInventoryCategory,
  parseTreatmentDate,
  treatmentDateRange,
  type GroupTreatmentType,
} from "@/lib/group-treatment";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type {
  GroupTreatmentInput,
  GroupTreatmentProductsQuery,
} from "@/validators/group-treatment.validator";

type Tx = Prisma.TransactionClient;

export interface DuplicateAnimal {
  animal_id: number;
  tag_number: string;
  animal_name: string | null;
  reason: string;
}

export interface GroupTreatmentProduct {
  item_id: number;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  farm_id: number | null;
}

export interface GroupTreatmentPreview {
  animals: Array<{
    animal_id: number;
    tag_number: string;
    animal_name: string | null;
  }>;
  inventory: {
    item_id: number;
    item_name: string;
    category: string;
    unit: string;
    available_stock: number;
  };
  summary: {
    selected_count: number;
    dosage_per_animal: number;
    required_quantity: number;
    available_stock: number;
    remaining_after: number;
    shortfall: number;
    sufficient: boolean;
  };
  duplicates: DuplicateAnimal[];
}

async function loadAnimals(input: Pick<GroupTreatmentInput, "farm_id" | "unit_id" | "animal_ids">) {
  const animals = await prisma.animals.findMany({
    where: {
      animal_id: { in: input.animal_ids },
      farm_id: input.farm_id,
      unit_id: input.unit_id,
      is_active: true,
    },
    select: { animal_id: true, tag_number: true, animal_name: true },
    orderBy: { tag_number: "asc" },
  });

  if (animals.length !== input.animal_ids.length) {
    throw new ValidationError(
      "One or more selected animals are invalid, inactive, or not in the chosen unit.",
    );
  }

  return animals;
}

export async function listTreatmentProducts(
  input: GroupTreatmentProductsQuery,
): Promise<GroupTreatmentProduct[]> {
  const categories = inventoryCategoriesForType(input.treatment_type);
  const where: Prisma.inventory_itemsWhereInput = {
    is_active: true,
    category: { in: categories },
    AND: [{ OR: [{ farm_id: input.farm_id }, { farm_id: null }] }],
  };

  if (input.search?.trim()) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        item_name: { contains: input.search.trim(), mode: "insensitive" },
      },
    ];
  }

  const rows = await prisma.inventory_items.findMany({
    where,
    orderBy: { item_name: "asc" },
    select: {
      item_id: true,
      item_name: true,
      category: true,
      quantity: true,
      unit: true,
      farm_id: true,
    },
  });

  return serialize(
    rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
    })),
  );
}

async function loadInventoryItem(
  itemId: number,
  farmId: number,
  treatmentType: GroupTreatmentType,
) {
  const item = await prisma.inventory_items.findFirst({
    where: { item_id: itemId, is_active: true },
    select: {
      item_id: true,
      item_name: true,
      category: true,
      unit: true,
      quantity: true,
      farm_id: true,
    },
  });

  if (!item) throw new NotFoundError("Inventory item");

  if (!matchesInventoryCategory(item.category, treatmentType)) {
    const allowed = inventoryCategoriesForType(treatmentType);
    throw new ValidationError(
      `Selected item must be in category: ${allowed.join(" or ")}.`,
    );
  }

  if (item.farm_id != null && item.farm_id !== farmId) {
    throw new ValidationError("Inventory item does not belong to the selected farm.");
  }

  return {
    ...item,
    quantity: Number(item.quantity),
  };
}

async function findDuplicateAnimals(
  input: GroupTreatmentInput,
  productName: string,
): Promise<DuplicateAnimal[]> {
  const { start, end } = treatmentDateRange(input.treatment_date);
  const duplicates: DuplicateAnimal[] = [];

  if (input.treatment_type === "vaccination") {
    const rows = await prisma.vaccination_records.findMany({
      where: {
        animal_id: { in: input.animal_ids },
        vaccination_date: { gte: start, lt: end },
        vaccine_name: { equals: productName, mode: "insensitive" },
      },
      include: {
        animals: { select: { animal_id: true, tag_number: true, animal_name: true } },
      },
    });

    for (const row of rows) {
      if (!row.animals) continue;
      duplicates.push({
        animal_id: row.animals.animal_id,
        tag_number: row.animals.tag_number,
        animal_name: row.animals.animal_name,
        reason: `${productName} already recorded on ${input.treatment_date}`,
      });
    }
  } else {
    const rows = await prisma.treatment_records.findMany({
      where: {
        inventory_item_id: input.inventory_item_id,
        treatment_date: { gte: start, lt: end },
        health_incidents: { animal_id: { in: input.animal_ids } },
      },
      include: {
        health_incidents: {
          include: {
            animals: { select: { animal_id: true, tag_number: true, animal_name: true } },
          },
        },
      },
    });

    for (const row of rows) {
      const animal = row.health_incidents?.animals;
      if (!animal) continue;
      duplicates.push({
        animal_id: animal.animal_id,
        tag_number: animal.tag_number,
        animal_name: animal.animal_name,
        reason: `${productName} already administered on ${input.treatment_date}`,
      });
    }
  }

  return duplicates;
}

export async function previewGroupTreatment(
  input: GroupTreatmentInput,
): Promise<GroupTreatmentPreview> {
  const animals = await loadAnimals(input);
  const item = await loadInventoryItem(
    input.inventory_item_id,
    input.farm_id,
    input.treatment_type,
  );
  const summary = calculateInventorySummary(
    animals.length,
    input.dosage_per_animal,
    item.quantity,
  );
  const duplicates = await findDuplicateAnimals(input, item.item_name);

  return serialize({
    animals,
    inventory: {
      item_id: item.item_id,
      item_name: item.item_name,
      category: item.category,
      unit: item.unit,
      available_stock: item.quantity,
    },
    summary: {
      selected_count: animals.length,
      dosage_per_animal: input.dosage_per_animal,
      required_quantity: summary.requiredQuantity,
      available_stock: item.quantity,
      remaining_after: summary.remainingAfter,
      shortfall: summary.shortfall,
      sufficient: summary.sufficient,
    },
    duplicates,
  });
}

import { deductForGroupTreatment } from "@/lib/inventory-lots";

export async function executeGroupTreatment(input: GroupTreatmentInput) {
  const preview = await previewGroupTreatment(input);

  if (!preview.summary.sufficient) {
    throw new ValidationError(
      `Insufficient stock. Required ${preview.summary.required_quantity} ${preview.inventory.unit}, available ${preview.summary.available_stock} ${preview.inventory.unit}.`,
    );
  }

  if (preview.duplicates.length > 0 && !input.allow_duplicates) {
    throw new ConflictError(
      `${preview.duplicates.length} animal(s) already have this treatment on the selected date. Review duplicates or deselect affected animals.`,
    );
  }

  const duplicateIds = new Set(preview.duplicates.map((d) => d.animal_id));
  const targetAnimals = preview.animals.filter((a) => !duplicateIds.has(a.animal_id));

  if (targetAnimals.length === 0) {
    throw new ValidationError("No animals remain after excluding duplicate treatments.");
  }

  const requiredForTargets = Number(
    (targetAnimals.length * input.dosage_per_animal).toFixed(2),
  );
  const treatmentDate = parseTreatmentDate(input.treatment_date);
  const item = await loadInventoryItem(
    input.inventory_item_id,
    input.farm_id,
    input.treatment_type,
  );

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.group_treatment_batches.create({
      data: {
        farm_id: input.farm_id,
        unit_id: input.unit_id,
        treatment_type: input.treatment_type,
        inventory_item_id: input.inventory_item_id,
        treatment_date: treatmentDate,
        dosage_per_animal: input.dosage_per_animal,
        total_quantity: requiredForTargets,
        animal_count: targetAnimals.length,
        administered_by: input.administered_by ?? null,
        notes: input.notes ?? null,
      },
    });

    if (input.treatment_type === "vaccination") {
      for (const animal of targetAnimals) {
        await tx.vaccination_records.create({
          data: {
            animal_id: animal.animal_id,
            vaccine_name: item.item_name,
            vaccination_date: treatmentDate,
            next_due_date: input.next_due_date
              ? parseTreatmentDate(input.next_due_date)
              : null,
            administered_by: input.administered_by ?? null,
            notes: input.notes ?? null,
            source: "group_batch",
            batch_id: batch.batch_id,
            inventory_item_id: item.item_id,
            dosage: input.dosage_per_animal,
          },
        });
      }
    } else {
      for (const animal of targetAnimals) {
        const incident = await tx.health_incidents.create({
          data: {
            animal_id: animal.animal_id,
            incident_date: treatmentDate,
            disease_name: "Group Medicine Treatment",
            severity: "Mild",
            symptoms: input.notes || "Batch medicine administration",
            treatment: `${item.item_name} — ${input.dosage_per_animal} ${item.unit}/animal (Batch #${batch.batch_id})`,
            status: "Resolved",
          },
        });

        await tx.treatment_records.create({
          data: {
            incident_id: incident.incident_id,
            batch_id: batch.batch_id,
            inventory_item_id: item.item_id,
            medicine_name: item.item_name,
            dosage: `${input.dosage_per_animal} ${item.unit}`,
            treatment_date: treatmentDate,
            remarks: input.notes ?? null,
          },
        });
      }
    }

    const reference = `Group treatment — ${targetAnimals.length} animals`;
    const remainingStock = await deductForGroupTreatment(
      tx,
      item.item_id,
      requiredForTargets,
      treatmentDate,
      reference,
      `Group ${input.treatment_type} batch #${batch.batch_id} — ${targetAnimals.length} animals × ${input.dosage_per_animal} ${item.unit}`,
    );

    return {
      batch,
      records_created: targetAnimals.length,
      skipped_duplicates: preview.duplicates.length,
      remaining_stock: remainingStock,
    };
  });

  return serialize({
    batch_id: result.batch.batch_id,
    treatment_type: input.treatment_type,
    records_created: result.records_created,
    skipped_duplicates: result.skipped_duplicates,
    total_quantity_used: requiredForTargets,
    remaining_stock: result.remaining_stock,
    inventory_unit: item.unit,
    product_name: item.item_name,
  });
}
