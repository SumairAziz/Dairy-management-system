import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  enrichInventoryItem,
  filterEnrichedItems,
  summarizeInventoryItems,
  type EnrichedInventoryItem,
} from "@/lib/inventory-enrich";
import {
  MOVEMENT_ADJUSTMENT,
  MOVEMENT_DAMAGED,
  MOVEMENT_EXPIRED,
  MOVEMENT_GROUP_TREATMENT,
  MOVEMENT_LOST,
  MOVEMENT_PHYSICAL_COUNT,
  MOVEMENT_RETURN,
  MOVEMENT_STOCK_IN,
  MOVEMENT_STOCK_OUT,
  MOVEMENT_USAGE,
} from "@/lib/inventory-movements";
import {
  createLotWithTransaction,
  deductForStockOut,
  deductForUsage,
  deductQuantityFefo,
  ensureLotsForItem,
  getLotsByItemId,
  getPrimaryLotSummary,
  getPrimaryLotSummaries,
} from "@/lib/inventory-lots";
import { matchesExpiryDaysFilter } from "@/lib/inventory-status";
import type {
  CreateInventoryItemInput,
  InventoryQueryParams,
  StockAdjustmentInput,
  StockInInput,
  StockMovementInput,
  TransactionQueryParams,
  UpdateInventoryItemInput,
} from "@/validators/inventory.validator";

const itemInclude = {
  farms: { select: { farm_id: true, farm_name: true } },
} as const;

function buildBaseWhere(
  filters: Omit<
    InventoryQueryParams,
    "page" | "pageSize" | "stock_status" | "expiry_status" | "expiry_days" | "sort_by" | "sort_order"
  >,
): Prisma.inventory_itemsWhereInput {
  const where: Prisma.inventory_itemsWhereInput = {};
  const andClauses: Prisma.inventory_itemsWhereInput[] = [];

  if (filters.farm_id) {
    andClauses.push({
      OR: [{ farm_id: filters.farm_id }, { farm_id: null }],
    });
  }
  if (filters.category) {
    where.category = { equals: filters.category, mode: "insensitive" };
  }
  if (filters.supplier) {
    where.supplier = { contains: filters.supplier, mode: "insensitive" };
  }
  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active === "true";
  }
  if (filters.search) {
    andClauses.push({
      OR: [
        { item_name: { contains: filters.search, mode: "insensitive" } },
        { supplier: { contains: filters.search, mode: "insensitive" } },
        { notes: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }
  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  return where;
}

async function enrichWithLots(items: EnrichedInventoryItem[]) {
  const itemIds = items.map((i) => i.item_id);
  const lotMap = await getPrimaryLotSummaries(itemIds);
  return items.map((item) => {
    const primaryLot = lotMap.get(item.item_id) ?? null;
    return {
      ...item,
      batch: primaryLot?.lot_number ?? null,
      primary_lot: primaryLot,
    };
  });
}

/** Shared source of truth for active inventory rows with status fields. */
export async function listActiveItemsEnriched(
  filters: Omit<
    InventoryQueryParams,
    "page" | "pageSize" | "sort_by" | "sort_order"
  > = {},
) {
  const where = buildBaseWhere(filters);
  if (filters.is_active === undefined) {
    where.is_active = true;
  }

  const rows = await prisma.inventory_items.findMany({
    where,
    include: itemInclude,
  });

  const now = new Date();
  let enriched = rows.map((row) => enrichInventoryItem(row, now));

  if (filters.stock_status || filters.expiry_status) {
    enriched = filterEnrichedItems(enriched, {
      stock_status: filters.stock_status,
      expiry_status: filters.expiry_status,
    });
  }

  if (filters.expiry_days) {
    enriched = enriched.filter((item) =>
      matchesExpiryDaysFilter(item, filters.expiry_days!, now),
    );
  }

  return enriched;
}

export async function findAll(params: InventoryQueryParams) {
  const { page, pageSize, sort_by, sort_order, ...filters } = params;
  const now = new Date();

  let enriched = await listActiveItemsEnriched(filters);

  enriched.sort((a, b) => {
    const key = sort_by as keyof EnrichedInventoryItem;
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return sort_order === "asc" ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return sort_order === "asc" ? cmp : -cmp;
  });

  const total = enriched.length;
  const pageItems = enriched.slice((page - 1) * pageSize, page * pageSize);
  const data = await enrichWithLots(pageItems);

  return serialize({ data, total, page, pageSize });
}

export async function findById(id: number) {
  const item = await prisma.inventory_items.findUnique({
    where: { item_id: id },
    include: {
      ...itemInclude,
      inventory_transactions: {
        orderBy: { transaction_date: "desc" },
        take: 100,
        include: {
          inventory_lots: { select: { lot_id: true, lot_number: true } },
          users: { select: { user_id: true, name: true } },
        },
      },
    },
  });
  if (!item) throw new NotFoundError("Inventory item");

  const lots = await getLotsByItemId(id);
  const base = enrichInventoryItem(item);
  const primaryLot = await getPrimaryLotSummary(id);

  return serialize({
    ...base,
    batch: primaryLot?.lot_number ?? null,
    primary_lot: primaryLot,
    inventory_lots: lots.map((lot) => ({
      lot_id: lot.lot_id,
      lot_number: lot.lot_number,
      quantity: Number(lot.quantity),
      remaining_quantity: Number(lot.remaining_quantity),
      unit_cost: lot.unit_cost != null ? Number(lot.unit_cost) : null,
      supplier: lot.supplier,
      manufacturing_date: lot.manufacturing_date?.toISOString().slice(0, 10) ?? null,
      expiry_date: lot.expiry_date?.toISOString().slice(0, 10) ?? null,
      received_date: lot.received_date.toISOString().slice(0, 10),
      notes: lot.notes,
    })),
    inventory_transactions: item.inventory_transactions.map((t) => ({
      ...serialize(t),
      quantity: Number(t.quantity),
      lot: t.inventory_lots
        ? { lot_id: t.inventory_lots.lot_id, lot_number: t.inventory_lots.lot_number }
        : null,
      user: t.users ? { user_id: t.users.user_id, name: t.users.name } : null,
    })),
  });
}

export async function create(data: CreateInventoryItemInput) {
  const created = await prisma.inventory_items.create({
    data: {
      ...data,
      expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
    },
    include: itemInclude,
  });

  if (Number(data.quantity) > 0) {
    await prisma.$transaction(async (tx) => {
      await createLotWithTransaction(tx, {
        itemId: created.item_id,
        quantity: Number(data.quantity),
        transactionDate: new Date(),
        lotNumber: data.notes?.includes("batch") ? null : "OPENING",
        unitCost: data.unit_cost ?? null,
        supplier: data.supplier ?? null,
        expiryDate: data.expiry_date ?? null,
        notes: "Opening stock on item creation",
        reference: "Item created",
      });
    });
  }

  const refreshed = await prisma.inventory_items.findUnique({
    where: { item_id: created.item_id },
    include: itemInclude,
  });

  return serialize(enrichInventoryItem(refreshed!));
}

export async function update(id: number, data: UpdateInventoryItemInput) {
  await findById(id);
  const updated = await prisma.inventory_items.update({
    where: { item_id: id },
    data: {
      ...data,
      expiry_date:
        data.expiry_date === undefined
          ? undefined
          : data.expiry_date
            ? new Date(data.expiry_date)
            : null,
      updated_at: new Date(),
    },
    include: itemInclude,
  });
  return serialize(enrichInventoryItem(updated));
}

export async function archive(id: number) {
  await findById(id);
  const updated = await prisma.inventory_items.update({
    where: { item_id: id },
    data: { is_active: false, updated_at: new Date() },
    include: itemInclude,
  });
  return serialize(enrichInventoryItem(updated));
}

export async function remove(id: number) {
  await findById(id);
  await prisma.inventory_items.delete({ where: { item_id: id } });
}

export async function recordStockIn(id: number, data: StockInInput, userId?: number) {
  const item = await prisma.inventory_items.findUnique({ where: { item_id: id } });
  if (!item) throw new NotFoundError("Inventory item");

  const txDate = new Date(data.transaction_date);

  const updated = await prisma.$transaction(async (tx) => {
    await createLotWithTransaction(tx, {
      itemId: id,
      quantity: Number(data.quantity),
      transactionDate: txDate,
      lotNumber: data.lot_number ?? null,
      unitCost: data.unit_cost ?? (item.unit_cost != null ? Number(item.unit_cost) : null),
      supplier: data.supplier ?? item.supplier,
      manufacturingDate: data.manufacturing_date ?? null,
      expiryDate: data.expiry_date ?? null,
      notes: data.notes ?? null,
      reference: data.reference ?? null,
      userId,
    });

    return tx.inventory_items.findUnique({
      where: { item_id: id },
      include: itemInclude,
    });
  });

  return serialize(enrichInventoryItem(updated!));
}

export async function recordStockOut(
  id: number,
  data: StockMovementInput,
  userId?: number,
  useUsageType = false,
) {
  const item = await prisma.inventory_items.findUnique({ where: { item_id: id } });
  if (!item) throw new NotFoundError("Inventory item");

  const txDate = new Date(data.transaction_date);
  const qty = Number(data.quantity);

  const updated = await prisma.$transaction(async (tx) => {
    if (useUsageType) {
      await deductForUsage(tx, id, qty, txDate, data.notes, userId);
    } else {
      await deductForStockOut(tx, id, qty, txDate, data.notes, userId);
    }
    return tx.inventory_items.findUnique({
      where: { item_id: id },
      include: itemInclude,
    });
  });

  return serialize(enrichInventoryItem(updated!));
}

export async function recordAdjustment(
  id: number,
  data: StockAdjustmentInput,
  userId?: number,
) {
  const item = await prisma.inventory_items.findUnique({ where: { item_id: id } });
  if (!item) throw new NotFoundError("Inventory item");

  const txDate = new Date(data.transaction_date);

  const updated = await prisma.$transaction(async (tx) => {
    await ensureLotsForItem(tx, id);

    if (data.action === "physical_count") {
      const counted = Number(data.counted_quantity);
      const current = Number(item.quantity);
      const delta = Number((counted - current).toFixed(2));

      if (delta === 0) {
        throw new ValidationError("Counted quantity matches current stock — no adjustment needed.");
      }

      if (delta > 0) {
        await createLotWithTransaction(tx, {
          itemId: id,
          quantity: delta,
          transactionDate: txDate,
          lotNumber: data.lot_number ?? "COUNT-ADJ",
          unitCost: item.unit_cost != null ? Number(item.unit_cost) : null,
          supplier: item.supplier,
          expiryDate: data.expiry_date ?? item.expiry_date?.toISOString().slice(0, 10) ?? null,
          notes: data.reason,
          reference: data.reference ?? "Physical count correction",
          userId,
          transactionType: MOVEMENT_PHYSICAL_COUNT,
        });
      } else {
        await deductQuantityFefo(tx, {
          itemId: id,
          quantity: Math.abs(delta),
          transactionType: MOVEMENT_PHYSICAL_COUNT,
          transactionDate: txDate,
          reference: data.reference ?? "Physical count correction",
          notes: data.reason,
          userId,
        });
      }
    } else if (data.action === "return") {
      await createLotWithTransaction(tx, {
        itemId: id,
        quantity: Number(data.quantity),
        transactionDate: txDate,
        lotNumber: data.lot_number ?? null,
        unitCost: data.unit_cost ?? (item.unit_cost != null ? Number(item.unit_cost) : null),
        supplier: data.supplier ?? item.supplier,
        expiryDate: data.expiry_date ?? null,
        notes: data.reason,
        reference: data.reference ?? null,
        userId,
        transactionType: MOVEMENT_RETURN,
      });
    } else if (data.action === "adjustment") {
      const qty = Number(data.quantity);
      if (data.direction === "in") {
        await createLotWithTransaction(tx, {
          itemId: id,
          quantity: qty,
          transactionDate: txDate,
          lotNumber: data.lot_number ?? null,
          unitCost: data.unit_cost ?? (item.unit_cost != null ? Number(item.unit_cost) : null),
          supplier: data.supplier ?? item.supplier,
          expiryDate: data.expiry_date ?? null,
          notes: data.reason,
          reference: data.reference ?? null,
          userId,
          transactionType: MOVEMENT_ADJUSTMENT,
        });
      } else {
        await deductQuantityFefo(tx, {
          itemId: id,
          quantity: qty,
          transactionType: MOVEMENT_ADJUSTMENT,
          transactionDate: txDate,
          reference: data.reference ?? null,
          notes: data.reason,
          userId,
        });
      }
    } else {
      const typeMap = {
        damaged: MOVEMENT_DAMAGED,
        expired: MOVEMENT_EXPIRED,
        lost: MOVEMENT_LOST,
      } as const;
      await deductQuantityFefo(tx, {
        itemId: id,
        quantity: Number(data.quantity),
        transactionType: typeMap[data.action],
        transactionDate: txDate,
        reference: data.reference ?? null,
        notes: data.reason,
        userId,
      });
    }

    return tx.inventory_items.findUnique({
      where: { item_id: id },
      include: itemInclude,
    });
  });

  return serialize(enrichInventoryItem(updated!));
}

export async function listSuppliers(): Promise<string[]> {
  const rows = await prisma.inventory_items.findMany({
    where: { supplier: { not: null } },
    distinct: ["supplier"],
    select: { supplier: true },
    orderBy: { supplier: "asc" },
  });
  return rows.map((r) => r.supplier!).filter(Boolean);
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.inventory_items.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

function mapTransactionRow(
  row: Prisma.inventory_transactionsGetPayload<{
    include: {
      inventory_items: {
        select: {
          item_id: true;
          item_name: true;
          unit: true;
          category: true;
        };
      };
      inventory_lots: { select: { lot_id: true; lot_number: true } };
      users: { select: { user_id: true; name: true } };
    };
  }>,
) {
  return {
    ...serialize(row),
    quantity: Number(row.quantity),
    item: row.inventory_items
      ? {
          item_id: row.inventory_items.item_id,
          item_name: row.inventory_items.item_name,
          unit: row.inventory_items.unit,
          category: row.inventory_items.category,
        }
      : null,
    lot: row.inventory_lots
      ? { lot_id: row.inventory_lots.lot_id, lot_number: row.inventory_lots.lot_number }
      : null,
    user: row.users ? { user_id: row.users.user_id, name: row.users.name } : null,
  };
}

export async function findRecentTransactions(limit = 10) {
  const rows = await prisma.inventory_transactions.findMany({
    take: limit,
    orderBy: [{ transaction_date: "desc" }, { transaction_id: "desc" }],
    include: {
      inventory_items: {
        select: { item_id: true, item_name: true, unit: true, category: true },
      },
      inventory_lots: { select: { lot_id: true, lot_number: true } },
      users: { select: { user_id: true, name: true } },
    },
  });
  return serialize(rows.map(mapTransactionRow));
}

export async function findTransactions(params: TransactionQueryParams) {
  const { page, pageSize, item_id, category, transaction_type, date_from, date_to } = params;

  const where: Prisma.inventory_transactionsWhereInput = {};

  if (item_id) where.item_id = item_id;
  if (transaction_type) where.transaction_type = transaction_type;
  if (date_from || date_to) {
    where.transaction_date = {};
    if (date_from) where.transaction_date.gte = new Date(date_from);
    if (date_to) where.transaction_date.lte = new Date(date_to);
  }
  if (category) {
    where.inventory_items = { category: { equals: category, mode: "insensitive" } };
  }

  const [total, rows] = await prisma.$transaction([
    prisma.inventory_transactions.count({ where }),
    prisma.inventory_transactions.findMany({
      where,
      orderBy: [{ transaction_date: "desc" }, { transaction_id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        inventory_items: {
          select: { item_id: true, item_name: true, unit: true, category: true },
        },
        inventory_lots: { select: { lot_id: true, lot_number: true } },
        users: { select: { user_id: true, name: true } },
      },
    }),
  ]);

  return serialize({
    data: rows.map(mapTransactionRow),
    total,
    page,
    pageSize,
  });
}

export async function getInventoryCostThisMonth(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const res = await prisma.$queryRaw<Array<{ total: number | null }>>`
    SELECT SUM(t.quantity * COALESCE(l.unit_cost, i.unit_cost, 0))::float AS total
    FROM inventory_transactions t
    LEFT JOIN inventory_lots l ON l.lot_id = t.lot_id
    LEFT JOIN inventory_items i ON i.item_id = t.item_id
    WHERE t.transaction_type = ${MOVEMENT_STOCK_IN}
      AND t.transaction_date >= ${start}
      AND t.transaction_date <= ${end}
  `;

  return Number((res[0]?.total ?? 0).toFixed(2));
}

export async function getConsumptionAnalytics(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const outboundTypes = [
    MOVEMENT_STOCK_OUT,
    MOVEMENT_USAGE,
    MOVEMENT_DAMAGED,
    MOVEMENT_EXPIRED,
    MOVEMENT_LOST,
    MOVEMENT_GROUP_TREATMENT,
    "Group Treatment",
  ];

  const rows = await prisma.inventory_transactions.findMany({
    where: {
      transaction_type: { in: outboundTypes },
      transaction_date: { gte: since },
    },
    include: {
      inventory_items: { select: { item_name: true, category: true, unit: true, unit_cost: true } },
    },
  });

  const byItem = new Map<string, { item_name: string; category: string; unit: string; quantity: number; cost: number }>();
  const byCategory = new Map<string, number>();
  const byDate = new Map<string, number>();

  for (const row of rows) {
    const qty = Number(row.quantity);
    const name = row.inventory_items?.item_name ?? "Unknown";
    const category = row.inventory_items?.category ?? "Other";
    const unit = row.inventory_items?.unit ?? "";
    const unitCost = row.inventory_items?.unit_cost != null ? Number(row.inventory_items.unit_cost) : 0;
    const dateKey = row.transaction_date.toISOString().slice(0, 10);

    const itemKey = String(row.item_id);
    const existing = byItem.get(itemKey) ?? { item_name: name, category, unit, quantity: 0, cost: 0 };
    existing.quantity += qty;
    existing.cost += qty * unitCost;
    byItem.set(itemKey, existing);

    byCategory.set(category, (byCategory.get(category) ?? 0) + qty);
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + qty);
  }

  const mostUsedMedicines = [...byItem.values()]
    .filter((i) => i.category === "Medicines" || i.category === "Vaccines")
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((i) => ({
      item_name: i.item_name,
      quantity: Number(i.quantity.toFixed(2)),
      unit: i.unit,
      estimated_cost: Number(i.cost.toFixed(2)),
    }));

  return {
    consumptionOverTime: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, quantity]) => ({ date, quantity: Number(quantity.toFixed(2)) })),
    quantityByCategory: [...byCategory.entries()]
      .map(([label, quantity]) => ({ label, quantity: Number(quantity.toFixed(2)) }))
      .sort((a, b) => b.quantity - a.quantity),
    mostUsedMedicines,
  };
}

export async function getSupplierSummary() {
  const items = await prisma.inventory_items.findMany({
    where: { is_active: true, supplier: { not: null } },
    select: {
      item_id: true,
      item_name: true,
      category: true,
      supplier: true,
      quantity: true,
      unit: true,
      unit_cost: true,
      reorder_level: true,
    },
  });

  const purchaseRows = await prisma.inventory_transactions.findMany({
    where: { transaction_type: MOVEMENT_STOCK_IN },
    orderBy: { transaction_date: "desc" },
    include: {
      inventory_items: { select: { supplier: true, item_name: true } },
      inventory_lots: { select: { supplier: true } },
    },
  });

  type SupplierEntry = {
    supplier: string;
    itemCount: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    items: Array<{ item_id: number; item_name: string; quantity: number; unit: string }>;
    lastPurchase: string | null;
    purchaseHistory: Array<{
      transaction_date: string;
      item_name: string;
      quantity: number;
    }>;
  };

  const map = new Map<string, SupplierEntry>();

  for (const item of items) {
    const supplier = item.supplier!;
    const enriched = enrichInventoryItem({
      ...item,
      farm_id: null,
      supplier: item.supplier,
      expiry_date: null,
      notes: null,
      is_active: true,
      created_at: null,
      updated_at: null,
    });

    const entry =
      map.get(supplier) ??
      ({
        supplier,
        itemCount: 0,
        totalValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        items: [],
        lastPurchase: null,
        purchaseHistory: [],
      } satisfies SupplierEntry);

    entry.itemCount++;
    entry.totalValue += enriched.total_value;
    if (enriched.stock_status === "low_stock") entry.lowStockCount++;
    if (enriched.stock_status === "out_of_stock") entry.outOfStockCount++;
    entry.items.push({
      item_id: item.item_id,
      item_name: item.item_name,
      quantity: Number(item.quantity),
      unit: item.unit,
    });
    map.set(supplier, entry);
  }

  for (const row of purchaseRows) {
    const supplier =
      row.inventory_lots?.supplier ??
      row.inventory_items?.supplier ??
      null;
    if (!supplier) continue;

    const entry =
      map.get(supplier) ??
      ({
        supplier,
        itemCount: 0,
        totalValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        items: [],
        lastPurchase: null,
        purchaseHistory: [],
      } satisfies SupplierEntry);

    const dateStr = row.transaction_date.toISOString().slice(0, 10);
    if (!entry.lastPurchase || dateStr > entry.lastPurchase) {
      entry.lastPurchase = dateStr;
    }
    if (entry.purchaseHistory.length < 20) {
      entry.purchaseHistory.push({
        transaction_date: dateStr,
        item_name: row.inventory_items?.item_name ?? "Unknown",
        quantity: Number(row.quantity),
      });
    }
    map.set(supplier, entry);
  }

  return serialize(
    [...map.values()]
      .map((s) => ({
        ...s,
        totalValue: Number(s.totalValue.toFixed(2)),
        items: s.items.sort((a, b) => a.item_name.localeCompare(b.item_name)),
      }))
      .sort((a, b) => a.supplier.localeCompare(b.supplier)),
  );
}

export { summarizeInventoryItems };
