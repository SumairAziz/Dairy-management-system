"use client";

import { use } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { MetricCard } from "@/app/components/custom-charts";
import { useInventoryItem } from "@/hooks";
import { routes } from "@/lib/routes";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import {
  ExpiryStatusBadge,
  StockStatusBadge,
  formatMoney,
} from "@/app/inventory/components/inventory-ui";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, History } from "lucide-react";
import { TABLE_ROW } from "@/lib/theme";
import { MOVEMENT_STOCK_IN } from "@/lib/inventory-movements";

export default function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const itemId = Number(id);
  const { data: item, isLoading, isError } = useInventoryItem(itemId);

  if (isLoading) return <div className="p-6 muted">Loading item…</div>;
  if (isError || !item) return <div className="p-6 text-rose-500">Item not found.</div>;

  const inboundTypes = [MOVEMENT_STOCK_IN, "Return"];
  const stockIn = item.inventory_transactions.filter((t) =>
    inboundTypes.includes(t.transaction_type),
  );
  const stockOut = item.inventory_transactions.filter(
    (t) => !inboundTypes.includes(t.transaction_type),
  );

  return (
    <>
      <Navbar title={item.item_name} subtitle={`${item.category} · ${item.quantity} ${item.unit}`} />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildFilterUrl(routes.inventoryStockIn, { item_id: String(item.item_id) })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600/90 text-white text-sm"
          >
            <ArrowDownToLine size={14} /> Stock In
          </Link>
          <Link
            href={routes.inventoryStockOut}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600/90 text-white text-sm"
          >
            <ArrowUpFromLine size={14} /> Usage
          </Link>
          <Link
            href={routes.inventoryAdjustments}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
          >
            <SlidersHorizontal size={14} /> Adjust
          </Link>
          <Link
            href={buildFilterUrl(routes.inventoryTransactions, { item_id: String(item.item_id) })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
          >
            <History size={14} /> All Transactions
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Current Stock" value={`${item.quantity} ${item.unit}`} />
          <MetricCard label="Stock Value" value={`Rs ${formatMoney(item.total_value)}`} />
          <MetricCard label="Reorder Level" value={item.reorder_level ?? "—"} />
          <MetricCard label="Unit Cost" value={formatMoney(item.unit_cost)} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="surface border rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Item Information</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="muted">Category</dt>
              <dd>{item.category}</dd>
              <dt className="muted">Supplier</dt>
              <dd>{item.supplier ?? "—"}</dd>
              <dt className="muted">Farm</dt>
              <dd>{item.farms?.farm_name ?? "Central"}</dd>
              <dt className="muted">Next Batch (FEFO)</dt>
              <dd>{item.batch ?? item.primary_lot?.lot_number ?? "—"}</dd>
              <dt className="muted">Expiry</dt>
              <dd className="flex items-center gap-2 flex-wrap">
                {item.expiry_date ?? item.primary_lot?.expiry_date ?? "—"}
                <ExpiryStatusBadge status={item.expiry_status} />
              </dd>
              <dt className="muted">Status</dt>
              <dd>
                <StockStatusBadge status={item.stock_status} />
              </dd>
              <dt className="muted">Notes</dt>
              <dd className="col-span-1">{item.notes ?? "—"}</dd>
            </dl>
          </div>

          <div className="surface border rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Movement Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted">Inbound events</div>
                <div className="text-xl font-semibold text-emerald-400">{stockIn.length}</div>
              </div>
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted">Outbound events</div>
                <div className="text-xl font-semibold text-rose-400">{stockOut.length}</div>
              </div>
            </div>
          </div>
        </div>

        {(item.inventory_lots?.length ?? 0) > 0 && (
          <div className="surface border rounded-2xl overflow-x-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Batches / Lots (FEFO order)</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left muted surface-2 border-b">
                <tr>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Received</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {item.inventory_lots!.map((lot) => (
                  <tr key={lot.lot_id} className={TABLE_ROW}>
                    <td className="px-3 py-2">{lot.lot_number ?? `#${lot.lot_id}`}</td>
                    <td className="px-3 py-2">
                      {lot.remaining_quantity} / {lot.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2">{lot.received_date}</td>
                    <td className="px-3 py-2">{lot.expiry_date ?? "—"}</td>
                    <td className="px-3 py-2">{lot.supplier ?? "—"}</td>
                    <td className="px-3 py-2">{formatMoney(lot.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="surface border rounded-2xl overflow-x-auto">
          <div className="p-4 border-b flex justify-between items-center gap-3">
            <h3 className="font-semibold text-sm">Recent Stock Movements</h3>
            <Link
              href={buildFilterUrl(routes.inventoryTransactions, { item_id: String(item.item_id) })}
              className="text-xs text-indigo-400 hover:underline"
            >
              View full history
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left muted surface-2 border-b">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Reference / Reason</th>
                <th className="px-3 py-2">User</th>
              </tr>
            </thead>
            <tbody>
              {item.inventory_transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center muted">
                    No movements recorded for this item.
                  </td>
                </tr>
              )}
              {item.inventory_transactions.map((t) => {
                const inbound = inboundTypes.includes(t.transaction_type);
                return (
                  <tr key={t.transaction_id} className={TABLE_ROW}>
                    <td className="px-3 py-2">{t.transaction_date}</td>
                    <td className="px-3 py-2">{t.lot?.lot_number ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={inbound ? "text-emerald-400" : "text-rose-400"}>
                        {t.transaction_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {inbound ? "+" : "−"}
                      {t.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2">{t.reference ?? t.notes ?? "—"}</td>
                    <td className="px-3 py-2">{t.user?.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
