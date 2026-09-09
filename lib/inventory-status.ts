/** Default categories — items may use any stored category value for charts. */
export const INVENTORY_CATEGORIES = [
  "Feed",
  "Medicines",
  "Vaccines",
  "Supplies",
  "Equipment",
  "Other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ExpiryStatus = "expired" | "expiring_soon" | "ok" | "none";

export interface InventoryQuantityFields {
  quantity: number | string;
  reorder_level?: number | string | null;
}

export interface InventoryExpiryFields {
  expiry_date?: string | null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getStockStatus(item: InventoryQuantityFields): StockStatus {
  const qty = Number(item.quantity);
  const reorder =
    item.reorder_level != null && item.reorder_level !== ""
      ? Number(item.reorder_level)
      : null;

  if (qty <= 0) return "out_of_stock";
  if (reorder != null && qty <= reorder) return "low_stock";
  return "in_stock";
}

export function getExpiryStatus(
  item: InventoryExpiryFields,
  now: Date = new Date(),
): ExpiryStatus {
  if (!item.expiry_date) return "none";

  const today = startOfDay(now);
  const expiry = startOfDay(new Date(item.expiry_date));

  if (expiry < today) return "expired";

  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (expiry <= soon) return "expiring_soon";

  return "ok";
}

export function getLineTotalValue(item: {
  quantity: number | string;
  unit_cost?: number | string | null;
}): number {
  const qty = Number(item.quantity);
  const cost =
    item.unit_cost != null && item.unit_cost !== ""
      ? Number(item.unit_cost)
      : 0;
  return Number((qty * cost).toFixed(2));
}

export function itemNeedsAttention(
  item: InventoryQuantityFields & InventoryExpiryFields,
  now: Date = new Date(),
): boolean {
  const stock = getStockStatus(item);
  const expiry = getExpiryStatus(item, now);
  return (
    stock === "out_of_stock" ||
    stock === "low_stock" ||
    expiry === "expired" ||
    expiry === "expiring_soon"
  );
}

export function stockStatusLabel(status: StockStatus): string {
  switch (status) {
    case "in_stock":
      return "In Stock";
    case "low_stock":
      return "Low Stock";
    case "out_of_stock":
      return "Out of Stock";
  }
}

export function stockStatusTone(status: StockStatus): "success" | "warning" | "danger" {
  switch (status) {
    case "in_stock":
      return "success";
    case "low_stock":
      return "warning";
    case "out_of_stock":
      return "danger";
  }
}

export function expiryStatusLabel(status: ExpiryStatus): string | null {
  switch (status) {
    case "expired":
      return "Expired";
    case "expiring_soon":
      return "Expiring Soon";
    case "ok":
      return null;
    case "none":
      return null;
  }
}

export function matchesStockStatusFilter(
  item: InventoryQuantityFields,
  filter: StockStatus | "",
): boolean {
  if (!filter) return true;
  return getStockStatus(item) === filter;
}

export function matchesExpiryStatusFilter(
  item: InventoryExpiryFields,
  filter: ExpiryStatus | "expiring" | "",
  now: Date = new Date(),
): boolean {
  if (!filter) return true;
  const status = getExpiryStatus(item, now);
  if (filter === "expiring") return status === "expiring_soon";
  return status === filter;
}

/** Match items expiring within N days (not yet expired). */
export function matchesExpiryDaysFilter(
  item: InventoryExpiryFields,
  days: number,
  now: Date = new Date(),
): boolean {
  if (!item.expiry_date) return false;

  const today = startOfDay(now);
  const expiry = startOfDay(new Date(item.expiry_date));
  if (expiry < today) return false;

  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return expiry <= limit;
}
