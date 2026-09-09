"use client";

import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { EmptyState } from "@/app/components/custom-charts";
import { useInventorySuppliers } from "@/hooks";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import { routes } from "@/lib/routes";
import { TABLE_ROW } from "@/lib/theme";
import { formatMoney } from "@/app/inventory/components/inventory-ui";
import { Truck } from "lucide-react";

export default function InventorySuppliersPage() {
  const { data: suppliers, isLoading, isError } = useInventorySuppliers();

  return (
    <>
      <Navbar title="Suppliers" subtitle="Vendor summary from stock-in and item records" />
      <div className="p-6 space-y-4">
        <div className="surface border rounded-2xl p-4 text-sm muted flex items-start gap-2">
          <Truck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <span>
            Suppliers are tracked on inventory items and stock-in batches. View items supplied,
            last purchase date, and recent stock-in history per vendor.
          </span>
        </div>

        <div className="surface border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted surface-2 border-b">
              <tr>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5">Items Supplied</th>
                <th className="px-3 py-2.5">Total Value</th>
                <th className="px-3 py-2.5">Last Purchase</th>
                <th className="px-3 py-2.5">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center muted">
                    Loading…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={5} className="py-8">
                    <EmptyState message="Couldn't load suppliers" />
                  </td>
                </tr>
              )}
              {!isLoading && !isError && (suppliers?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="py-10">
                    <EmptyState
                      message="No suppliers recorded yet"
                      hint="Add supplier names when creating or receiving inventory items."
                    />
                  </td>
                </tr>
              )}
              {suppliers?.map((s) => (
                <tr key={s.supplier} className={TABLE_ROW}>
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={buildFilterUrl(routes.inventoryItems, { supplier: s.supplier })}
                      className="font-medium hover:text-indigo-400"
                    >
                      {s.supplier}
                    </Link>
                    {s.purchaseHistory.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs muted">
                        {s.purchaseHistory.slice(0, 3).map((p, i) => (
                          <li key={`${p.transaction_date}-${i}`}>
                            {p.transaction_date}: {p.item_name} (+{p.quantity})
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div>{s.itemCount} item(s)</div>
                    <ul className="mt-1 space-y-0.5 text-xs muted max-w-[220px]">
                      {s.items.slice(0, 4).map((item) => (
                        <li key={item.item_id}>
                          <Link
                            href={routes.inventoryItemDetail(item.item_id)}
                            className="hover:text-indigo-400"
                          >
                            {item.item_name}
                          </Link>{" "}
                          ({item.quantity} {item.unit})
                        </li>
                      ))}
                      {s.items.length > 4 && (
                        <li>+{s.items.length - 4} more</li>
                      )}
                    </ul>
                  </td>
                  <td className="px-3 py-2 align-top">Rs {formatMoney(s.totalValue)}</td>
                  <td className="px-3 py-2 align-top">{s.lastPurchase ?? "—"}</td>
                  <td className="px-3 py-2 align-top">
                    {s.lowStockCount > 0 && (
                      <Link
                        href={routes.inventoryLowStock}
                        className="block text-amber-400 hover:underline"
                      >
                        {s.lowStockCount} low stock
                      </Link>
                    )}
                    {s.outOfStockCount > 0 && (
                      <span className="block text-red-400">{s.outOfStockCount} out of stock</span>
                    )}
                    {s.lowStockCount === 0 && s.outOfStockCount === 0 && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
