"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { EmptyState } from "@/app/components/custom-charts";
import { routes } from "@/lib/routes";
import { MOVEMENT_STOCK_IN } from "@/lib/inventory-movements";
import type { InventoryTransaction } from "@/types";

function isInbound(type: string) {
  return type === MOVEMENT_STOCK_IN || type === "Return";
}

export function RecentMovementsPanel({
  movements,
  isLoading,
}: {
  movements: InventoryTransaction[];
  isLoading?: boolean;
}) {
  return (
    <div className="surface border rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-sm">Recent Stock Movements</h3>
        <Link href={routes.inventoryTransactions} className="text-xs text-indigo-400 hover:underline">
          View all
        </Link>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-sm muted">Loading…</div>
      ) : movements.length === 0 ? (
        <EmptyState
          message="No movements recorded yet"
          hint="Use Stock In or Stock Out to record transactions."
        />
      ) : (
        <ul className="space-y-2">
          {movements.map((m) => {
            const inbound = isInbound(m.transaction_type);
            return (
              <li
                key={m.transaction_id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-xl border surface"
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-lg ${inbound ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
                >
                  {inbound ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.item ? (
                      <Link
                        href={routes.inventoryItemDetail(m.item.item_id)}
                        className="font-medium text-sm hover:text-indigo-400 truncate"
                      >
                        {m.item.item_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-sm">Item #{m.item_id}</span>
                    )}
                    <span className="text-xs muted">
                      {inbound ? "+" : "−"}
                      {m.quantity} {m.item?.unit ?? ""}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide muted">
                      {m.transaction_type}
                    </span>
                  </div>
                  <div className="text-xs muted mt-0.5">
                    {m.transaction_date}
                    {m.lot?.lot_number ? ` · Batch ${m.lot.lot_number}` : ""}
                    {m.reference ? ` · ${m.reference}` : m.notes ? ` · ${m.notes}` : ""}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
