import { Prisma } from "@prisma/client";
import {
  getExpiryStatus,
  getLineTotalValue,
  getStockStatus,
  itemNeedsAttention,
  matchesExpiryStatusFilter,
  matchesStockStatusFilter,
  type ExpiryStatus,
  type StockStatus,
} from "@/lib/inventory-status";

export interface EnrichedInventoryItem {
  item_id: number;
  farm_id: number | null;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number | null;
  unit_cost: number | null;
  supplier: string | null;
  expiry_date: string | null;
  notes: string | null;
  is_active: boolean | null;
  stock_status: StockStatus;
  expiry_status: ExpiryStatus;
  total_value: number;
  created_at?: string | null;
  updated_at?: string | null;
  farms?: { farm_id: number; farm_name: string } | null;
}

type RawItem = {
  item_id: number;
  farm_id: number | null;
  item_name: string;
  category: string;
  quantity: Prisma.Decimal;
  unit: string;
  reorder_level: Prisma.Decimal | null;
  unit_cost: Prisma.Decimal | null;
  supplier: string | null;
  expiry_date: Date | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
  farms?: { farm_id: number; farm_name: string } | null;
};

export function enrichInventoryItem(item: RawItem, now = new Date()): EnrichedInventoryItem {
  const quantity = Number(item.quantity);
  const reorder_level = item.reorder_level != null ? Number(item.reorder_level) : null;
  const unit_cost = item.unit_cost != null ? Number(item.unit_cost) : null;
  const expiry_date = item.expiry_date ? item.expiry_date.toISOString().slice(0, 10) : null;

  const fields = { quantity, reorder_level, expiry_date };

  return {
    item_id: item.item_id,
    farm_id: item.farm_id,
    item_name: item.item_name,
    category: item.category,
    quantity,
    unit: item.unit,
    reorder_level,
    unit_cost,
    supplier: item.supplier,
    expiry_date,
    notes: item.notes,
    is_active: item.is_active,
    created_at: item.created_at?.toISOString() ?? null,
    updated_at: item.updated_at?.toISOString() ?? null,
    farms: item.farms ?? null,
    stock_status: getStockStatus(fields),
    expiry_status: getExpiryStatus({ expiry_date }, now),
    total_value: getLineTotalValue({ quantity, unit_cost }),
  };
}

export function filterEnrichedItems(
  items: EnrichedInventoryItem[],
  filters: {
    stock_status?: StockStatus | "";
    expiry_status?: string;
  },
  now = new Date(),
): EnrichedInventoryItem[] {
  let result = items;
  if (filters.stock_status) {
    result = result.filter((item) => matchesStockStatusFilter(item, filters.stock_status!));
  }
  if (filters.expiry_status) {
    result = result.filter((item) =>
      matchesExpiryStatusFilter(item, filters.expiry_status as Parameters<typeof matchesExpiryStatusFilter>[1], now),
    );
  }
  return result;
}

export function summarizeInventoryItems(items: EnrichedInventoryItem[], now = new Date()) {
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let expired = 0;
  let expiringSoon = 0;
  let totalValue = 0;
  let attentionCount = 0;

  const categoryCounts = new Map<string, number>();
  const categoryValues = new Map<string, number>();

  for (const item of items) {
    if (item.stock_status === "in_stock") inStock++;
    else if (item.stock_status === "low_stock") lowStock++;
    else outOfStock++;

    if (item.expiry_status === "expired") expired++;
    if (item.expiry_status === "expiring_soon") expiringSoon++;

    totalValue += item.total_value;
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
    categoryValues.set(item.category, (categoryValues.get(item.category) ?? 0) + item.total_value);

    if (itemNeedsAttention(item, now)) attentionCount++;
  }

  return {
    inStock,
    lowStock,
    outOfStock,
    expired,
    expiringSoon,
    totalValue: Number(totalValue.toFixed(2)),
    attentionCount,
    categoryCounts,
    categoryValues,
  };
}
