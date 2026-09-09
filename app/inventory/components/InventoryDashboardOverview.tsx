"use client";

import Link from "next/link";
import {
  MetricCard,
  PieChart,
  BarChart,
  EmptyState,
  chartColor,
} from "@/app/components/custom-charts";
import { StatCard } from "@/app/components/stat-card";
import { useInventoryStats } from "@/hooks";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import { routes } from "@/lib/routes";
import { CHART_PALETTES, TONE, colorFor } from "@/lib/theme";
import {
  Package,
  DollarSign,
  AlertTriangle,
  XCircle,
  CalendarClock,
  ArrowDownUp,
  Layers,
  BarChart3,
  Bell,
  TrendingDown,
} from "lucide-react";
import { RecentMovementsPanel } from "./RecentMovementsPanel";
import { StockStatusBadge } from "./inventory-ui";

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="surface border rounded-2xl p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-4 text-sm">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

export function InventoryDashboardOverview() {
  const { data: stats, isLoading, isError } = useInventoryStats();

  if (isError) {
    return (
      <div className="surface border rounded-2xl p-5">
        <EmptyState
          message="Couldn't load inventory overview"
          hint="Try refreshing the page."
        />
      </div>
    );
  }

  const categoryData = stats?.categoryDistribution ?? [];
  const valueData = stats?.categoryValueDistribution ?? [];
  const stockData =
    stats?.stockStatusBreakdown.map((s) => ({
      label: s.label,
      value: s.value,
      filterKey: s.key,
    })) ?? [];
  const consumption = stats?.consumptionAnalytics;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard
          label="Total Items"
          value={isLoading ? "…" : (stats?.totalItems ?? 0)}
          icon={<Package size={16} className="text-indigo-400" />}
          iconBg="bg-indigo-500/10"
          href={routes.inventoryItems}
          tone="inventory"
        />
        <StatCard
          label="Total Value"
          value={
            isLoading
              ? "…"
              : `Rs ${(stats?.totalValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          icon={<DollarSign size={16} className="text-sky-400" />}
          iconBg="bg-sky-500/10"
          tone="info"
        />
        <StatCard
          label="Cost This Month"
          value={
            isLoading
              ? "…"
              : `Rs ${(stats?.inventoryCostThisMonth ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          icon={<DollarSign size={16} className="text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          href={buildFilterUrl(routes.inventoryTransactions, { transaction_type: "Stock In" })}
          tone="success"
        />
        <StatCard
          label="Low Stock"
          value={isLoading ? "…" : (stats?.lowStock ?? 0)}
          icon={<AlertTriangle size={16} className="text-amber-400" />}
          iconBg="bg-amber-500/10"
          href={routes.inventoryLowStock}
          tone="warning"
        />
        <StatCard
          label="Out of Stock"
          value={isLoading ? "…" : (stats?.outOfStock ?? 0)}
          icon={<XCircle size={16} className="text-red-400" />}
          iconBg="bg-red-500/10"
          href={buildFilterUrl(routes.inventoryItems, { stock_status: "out_of_stock" })}
          tone="danger"
        />
        <StatCard
          label="Expiring Soon"
          value={isLoading ? "…" : (stats?.expiringSoon ?? 0)}
          icon={<CalendarClock size={16} className="text-orange-400" />}
          iconBg="bg-orange-500/10"
          href={buildFilterUrl(routes.inventoryExpiring, { tab: "soon" })}
          tone="warning"
        />
        <StatCard
          label="Expired"
          value={isLoading ? "…" : (stats?.expired ?? 0)}
          icon={<CalendarClock size={16} className="text-red-400" />}
          iconBg="bg-red-500/10"
          href={buildFilterUrl(routes.inventoryExpiring, { tab: "expired" })}
          tone="danger"
        />
        <StatCard
          label="Recent Movements"
          value={isLoading ? "…" : (stats?.recentMovements?.length ?? 0)}
          icon={<ArrowDownUp size={16} className="text-teal-400" />}
          iconBg="bg-teal-500/10"
          href={routes.inventoryTransactions}
          tone="info"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Stock by Category" icon={<Layers size={15} className="text-indigo-400" />}>
          {isLoading ? (
            <div className="h-[170px] flex items-center justify-center text-sm muted">Loading…</div>
          ) : categoryData.length === 0 ? (
            <EmptyState message="No items yet" hint="Add inventory items to see distribution." />
          ) : (
            <PieChart
              data={categoryData.map((d) => ({
                label: d.label,
                value: d.value,
                color: colorFor(CHART_PALETTES.inventoryCategory, d.label),
                href: buildFilterUrl(routes.inventoryItems, { category: d.label }),
              }))}
            />
          )}
        </ChartCard>

        <ChartCard title="Value by Category" icon={<DollarSign size={15} className="text-sky-400" />}>
          {isLoading ? (
            <div className="h-[170px] flex items-center justify-center text-sm muted">Loading…</div>
          ) : valueData.length === 0 ? (
            <EmptyState message="No value data" hint="Set unit costs on items to track value." />
          ) : (
            <BarChart
              data={valueData.map((d, i) => ({
                label: d.label,
                value: d.value,
                color: chartColor(i),
                href: buildFilterUrl(routes.inventoryItems, { category: d.label }),
              }))}
            />
          )}
        </ChartCard>

        <ChartCard title="Stock Status" icon={<BarChart3 size={15} className="text-emerald-400" />}>
          {isLoading ? (
            <div className="h-[170px] flex items-center justify-center text-sm muted">Loading…</div>
          ) : (
            <BarChart
              data={stockData.map((d) => ({
                label: d.label,
                value: d.value,
                color:
                  d.filterKey === "in_stock"
                    ? TONE.success.hex
                    : d.filterKey === "low_stock"
                      ? TONE.warning.hex
                      : TONE.danger.hex,
                href:
                  d.filterKey === "low_stock"
                    ? routes.inventoryLowStock
                    : buildFilterUrl(routes.inventoryItems, { stock_status: d.filterKey }),
              }))}
            />
          )}
        </ChartCard>
      </div>

      {(consumption?.mostUsedMedicines?.length ?? 0) > 0 && (
        <div className="surface border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={15} className="text-rose-400" />
            <h3 className="font-semibold text-sm">Most-Used Medicines (30 days)</h3>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {consumption!.mostUsedMedicines.map((m) => (
              <li key={m.item_name} className="px-3 py-2 rounded-xl border surface text-sm">
                <div className="font-medium truncate">{m.item_name}</div>
                <div className="text-xs muted mt-0.5">
                  {m.quantity} {m.unit}
                  {m.estimated_cost > 0 ? ` · Rs ${m.estimated_cost.toLocaleString()}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <RecentMovementsPanel movements={stats?.recentMovements ?? []} isLoading={isLoading} />

        {(stats?.attentionItems?.length ?? 0) > 0 && (
          <div className="surface border border-amber-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-amber-400 shrink-0" />
              <h3 className="font-semibold text-sm">Items Requiring Attention</h3>
              <span className="text-xs muted ml-auto">{stats?.attentionCount} total</span>
            </div>
            <ul className="space-y-2">
              {stats!.attentionItems.map((item) => (
                <li
                  key={item.item_id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border surface"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{item.item_name}</div>
                    <div className="text-xs muted">
                      {item.quantity} {item.unit} remaining
                      {item.reorder_level != null && ` · Minimum: ${item.reorder_level} ${item.unit}`}
                    </div>
                    <div className="mt-1">
                      <StockStatusBadge status={item.stock_status} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Link
                      href={routes.inventoryItemDetail(item.item_id)}
                      className="px-2.5 py-1 rounded-lg border text-xs text-center hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      View
                    </Link>
                    {(item.stock_status === "low_stock" || item.stock_status === "out_of_stock") && (
                      <Link
                        href={buildFilterUrl(routes.inventoryStockIn, { item_id: String(item.item_id) })}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white text-xs text-center"
                      >
                        Reorder
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <MetricCard
                label="View low stock"
                value={stats?.lowStock ?? 0}
                href={routes.inventoryLowStock}
              />
              <MetricCard
                label="View expiring"
                value={stats?.expiringSoon ?? 0}
                href={routes.inventoryExpiring}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
