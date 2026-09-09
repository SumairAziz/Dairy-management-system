import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import {
  MOVEMENT_GROUP_TREATMENT,
  MOVEMENT_STOCK_IN,
  MOVEMENT_STOCK_OUT,
  MOVEMENT_USAGE,
  type InboundMovementType,
  type InventoryMovementType,
} from "@/lib/inventory-movements";

type Tx = Prisma.TransactionClient;

const FEFO_LOT_ORDER: Prisma.inventory_lotsOrderByWithRelationInput[] = [
  { expiry_date: { sort: "asc", nulls: "last" } },
  { received_date: "asc" },
  { lot_id: "asc" },
];

export async function getActiveLots(tx: Tx, itemId: number) {
  return tx.inventory_lots.findMany({
    where: {
      item_id: itemId,
      is_active: true,
      remaining_quantity: { gt: 0 },
    },
    orderBy: FEFO_LOT_ORDER,
  });
}

/** Sync item aggregate quantity and nearest expiry from active lots. */
export async function syncItemFromLots(tx: Tx, itemId: number) {
  const lots = await getActiveLots(tx, itemId);
  const totalQty = lots.reduce((sum, lot) => sum + Number(lot.remaining_quantity), 0);
  const roundedQty = Number(totalQty.toFixed(2));

  let earliestExpiry: Date | null = null;
  for (const lot of lots) {
    if (!lot.expiry_date) continue;
    if (!earliestExpiry || lot.expiry_date < earliestExpiry) {
      earliestExpiry = lot.expiry_date;
    }
  }

  await tx.inventory_items.update({
    where: { item_id: itemId },
    data: {
      quantity: roundedQty,
      expiry_date: earliestExpiry,
      updated_at: new Date(),
    },
  });

  return roundedQty;
}

export interface DeductFefoInput {
  itemId: number;
  quantity: number;
  transactionType: InventoryMovementType;
  transactionDate: Date;
  reference?: string | null;
  notes?: string | null;
  userId?: number | null;
}

/** Deduct quantity using FEFO across lots; creates one transaction per lot touched. */
export async function deductQuantityFefo(
  tx: Tx,
  input: DeductFefoInput,
): Promise<number> {
  const item = await tx.inventory_items.findUnique({ where: { item_id: input.itemId } });
  if (!item) throw new ValidationError("Inventory item not found.");

  let remaining = Number(input.quantity.toFixed(2));
  if (remaining <= 0) {
    throw new ValidationError("Quantity must be positive.");
  }

  const lots = await getActiveLots(tx, input.itemId);
  const totalAvailable = lots.reduce((sum, lot) => sum + Number(lot.remaining_quantity), 0);

  if (totalAvailable < remaining) {
    throw new ValidationError("Insufficient stock for this quantity.");
  }

  for (const lot of lots) {
    if (remaining <= 0) break;

    const lotRemaining = Number(lot.remaining_quantity);
    if (lotRemaining <= 0) continue;

    const take = Math.min(lotRemaining, remaining);
    const nextLotQty = Number((lotRemaining - take).toFixed(2));

    await tx.inventory_lots.update({
      where: { lot_id: lot.lot_id },
      data: { remaining_quantity: nextLotQty },
    });

    await tx.inventory_transactions.create({
      data: {
        item_id: input.itemId,
        lot_id: lot.lot_id,
        user_id: input.userId ?? null,
        transaction_type: input.transactionType,
        quantity: take,
        transaction_date: input.transactionDate,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      },
    });

    remaining = Number((remaining - take).toFixed(2));
  }

  return syncItemFromLots(tx, input.itemId);
}

export interface CreateLotInput {
  itemId: number;
  quantity: number;
  transactionDate: Date;
  lotNumber?: string | null;
  unitCost?: number | null;
  supplier?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  reference?: string | null;
  userId?: number | null;
  transactionType?: InboundMovementType;
}

/** Create a lot and matching inbound transaction. */
export async function createLotWithTransaction(
  tx: Tx,
  input: CreateLotInput,
): Promise<{ lotId: number; newQuantity: number }> {
  const qty = Number(input.quantity.toFixed(2));
  if (qty <= 0) throw new ValidationError("Quantity must be positive.");

  const lot = await tx.inventory_lots.create({
    data: {
      item_id: input.itemId,
      lot_number: input.lotNumber ?? null,
      quantity: qty,
      remaining_quantity: qty,
      unit_cost: input.unitCost ?? null,
      supplier: input.supplier ?? null,
      manufacturing_date: input.manufacturingDate ? new Date(input.manufacturingDate) : null,
      expiry_date: input.expiryDate ? new Date(input.expiryDate) : null,
      received_date: input.transactionDate,
      notes: input.notes ?? null,
    },
  });

  const itemUpdate: Prisma.inventory_itemsUpdateInput = { updated_at: new Date() };
  if (input.unitCost != null) itemUpdate.unit_cost = input.unitCost;
  if (input.supplier) itemUpdate.supplier = input.supplier;

  await tx.inventory_items.update({
    where: { item_id: input.itemId },
    data: itemUpdate,
  });

  await tx.inventory_transactions.create({
    data: {
      item_id: input.itemId,
      lot_id: lot.lot_id,
      user_id: input.userId ?? null,
      transaction_type: input.transactionType ?? MOVEMENT_STOCK_IN,
      quantity: qty,
      transaction_date: input.transactionDate,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    },
  });

  const newQuantity = await syncItemFromLots(tx, input.itemId);
  return { lotId: lot.lot_id, newQuantity };
}

/** Ensure legacy items without lots get a synthetic lot before outbound operations. */
export async function ensureLotsForItem(tx: Tx, itemId: number) {
  const lotCount = await tx.inventory_lots.count({ where: { item_id: itemId } });
  if (lotCount > 0) return;

  const item = await tx.inventory_items.findUnique({ where: { item_id: itemId } });
  if (!item || Number(item.quantity) <= 0) return;

  await createLotWithTransaction(tx, {
    itemId,
    quantity: Number(item.quantity),
    transactionDate: item.updated_at ?? new Date(),
    lotNumber: "LEGACY",
    unitCost: item.unit_cost != null ? Number(item.unit_cost) : null,
    supplier: item.supplier,
    expiryDate: item.expiry_date?.toISOString().slice(0, 10) ?? null,
    notes: "Migrated from item-level stock",
    reference: "Legacy stock migration",
  });
}

export async function deductForGroupTreatment(
  tx: Tx,
  itemId: number,
  quantity: number,
  treatmentDate: Date,
  reference: string,
  notes: string,
) {
  await ensureLotsForItem(tx, itemId);
  return deductQuantityFefo(tx, {
    itemId,
    quantity,
    transactionType: MOVEMENT_GROUP_TREATMENT,
    transactionDate: treatmentDate,
    reference,
    notes,
  });
}

export async function deductForUsage(
  tx: Tx,
  itemId: number,
  quantity: number,
  transactionDate: Date,
  notes?: string | null,
  userId?: number | null,
) {
  await ensureLotsForItem(tx, itemId);
  return deductQuantityFefo(tx, {
    itemId,
    quantity,
    transactionType: MOVEMENT_USAGE,
    transactionDate,
    notes: notes ?? null,
    userId,
  });
}

/** Backward-compatible alias used by stock-out page. */
export async function deductForStockOut(
  tx: Tx,
  itemId: number,
  quantity: number,
  transactionDate: Date,
  notes?: string | null,
  userId?: number | null,
) {
  await ensureLotsForItem(tx, itemId);
  return deductQuantityFefo(tx, {
    itemId,
    quantity,
    transactionType: MOVEMENT_STOCK_OUT,
    transactionDate,
    notes: notes ?? null,
    userId,
  });
}

export async function getLotsByItemId(itemId: number) {
  return prisma.inventory_lots.findMany({
    where: { item_id: itemId, is_active: true },
    orderBy: FEFO_LOT_ORDER,
  });
}

export async function getPrimaryLotSummary(itemId: number) {
  const lots = await getActiveLots(prisma, itemId);
  const primary = lots[0];
  if (!primary) return null;
  return {
    lot_id: primary.lot_id,
    lot_number: primary.lot_number,
    remaining_quantity: Number(primary.remaining_quantity),
    expiry_date: primary.expiry_date?.toISOString().slice(0, 10) ?? null,
    supplier: primary.supplier,
  };
}
