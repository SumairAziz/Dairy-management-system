import {
  getInventoryCostThisMonth,
  getConsumptionAnalytics,
  listActiveItemsEnriched,
  summarizeInventoryItems,
  findRecentTransactions,
} from "@/services/inventory.service";
import { serialize } from "@/lib/serialize";
import { itemNeedsAttention } from "@/lib/inventory-status";

export async function getInventoryStats() {
  const items = await listActiveItemsEnriched({ is_active: "true" });
  const now = new Date();
  const summary = summarizeInventoryItems(items, now);

  const attentionItems = items
    .filter((item) => itemNeedsAttention(item, now))
    .sort((a, b) => {
      const priority = (item: typeof a) => {
        if (item.stock_status === "out_of_stock") return 0;
        if (item.expiry_status === "expired") return 1;
        if (item.stock_status === "low_stock") return 2;
        if (item.expiry_status === "expiring_soon") return 3;
        return 4;
      };
      return priority(a) - priority(b);
    })
    .slice(0, 12)
    .map((item) => {
      let reason = "";
      if (item.stock_status === "out_of_stock") reason = "Out of stock";
      else if (item.stock_status === "low_stock") reason = "Low stock";
      else if (item.expiry_status === "expired") reason = "Expired";
      else if (item.expiry_status === "expiring_soon") reason = "Expiring soon";

      return {
        item_id: item.item_id,
        item_name: item.item_name,
        reason,
        stock_status: item.stock_status,
        expiry_status: item.expiry_status,
        quantity: item.quantity,
        unit: item.unit,
        reorder_level: item.reorder_level,
      };
    });

  const categoryDistribution = [...summary.categoryCounts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const categoryValueDistribution = [...summary.categoryValues.entries()]
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const stockStatusBreakdown = [
    { label: "In Stock", value: summary.inStock, key: "in_stock" as const },
    { label: "Low Stock", value: summary.lowStock, key: "low_stock" as const },
    { label: "Out of Stock", value: summary.outOfStock, key: "out_of_stock" as const },
  ];

  const [recentMovements, inventoryCostThisMonth, consumptionAnalytics] = await Promise.all([
    findRecentTransactions(10),
    getInventoryCostThisMonth(now),
    getConsumptionAnalytics(30),
  ]);

  return serialize({
    totalItems: items.length,
    inStock: summary.inStock,
    lowStock: summary.lowStock,
    outOfStock: summary.outOfStock,
    totalValue: summary.totalValue,
    attentionCount: summary.attentionCount,
    expired: summary.expired,
    expiringSoon: summary.expiringSoon,
    inventoryCostThisMonth,
    categoryDistribution,
    categoryValueDistribution,
    stockStatusBreakdown,
    attentionItems,
    recentMovements,
    consumptionAnalytics,
  });
}

/** Lightweight summary for the main farm dashboard. */
export async function getInventoryDashboardSummary() {
  const stats = await getInventoryStats();
  return {
    totalItems: stats.totalItems as number,
    totalValue: stats.totalValue as number,
    lowStock: stats.lowStock as number,
    outOfStock: stats.outOfStock as number,
    expiringSoon: stats.expiringSoon as number,
    expired: stats.expired as number,
    attentionCount: stats.attentionCount as number,
    inventoryCostThisMonth: stats.inventoryCostThisMonth as number,
  };
}
