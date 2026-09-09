"use client";

import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { useInventory, useUrlFilters } from "@/hooks";
import { InventoryItemsTable } from "@/app/inventory/components/InventoryItemsTable";
import { routes } from "@/lib/routes";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import { AlertTriangle, ArrowDownToLine } from "lucide-react";
import { StockStatusBadge } from "@/app/inventory/components/inventory-ui";

export default function LowStockPage() {
  const { data, isLoading } = useInventory({
    pageSize: "500",
    stock_status: "low_stock",
    sort_by: "quantity",
    sort_order: "asc",
  });

  const items = data?.data ?? [];

  return (
    <>
      <Navbar
        title="Low Stock"
        subtitle="Items at or below reorder level — reorder these first"
      />
      <div className="p-6 space-y-4">
        <div className="surface border border-amber-500/25 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-amber-400" />
            <span>
              <strong>{data?.total ?? items.length}</strong> item
              {(data?.total ?? items.length) !== 1 ? "s" : ""} need reordering
            </span>
          </div>
          <Link
            href={routes.inventoryStockIn}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm"
          >
            <ArrowDownToLine size={14} /> Record Stock In
          </Link>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.item_id}
              className="surface border rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-medium">{item.item_name}</div>
                <div className="text-sm muted">
                  {item.quantity} {item.unit} remaining · Minimum: {item.reorder_level ?? "—"}{" "}
                  {item.unit}
                </div>
                <div className="mt-1">
                  <StockStatusBadge status={item.stock_status} />
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={routes.inventoryItemDetail(item.item_id)}
                  className="px-3 py-1.5 rounded-lg border text-sm"
                >
                  View
                </Link>
                <Link
                  href={buildFilterUrl(routes.inventoryStockIn, { item_id: String(item.item_id) })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm"
                >
                  Reorder
                </Link>
              </div>
            </div>
          ))}
        </div>

        <InventoryItemsTable
          items={items}
          isLoading={isLoading}
          emptyMessage="No low-stock items — all reorder levels are healthy."
          showView
        />
      </div>
    </>
  );
}
