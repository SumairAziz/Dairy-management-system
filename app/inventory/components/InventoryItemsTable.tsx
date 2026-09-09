"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/app/components/custom-charts";
import { TABLE_ROW } from "@/lib/theme";
import { routes } from "@/lib/routes";
import type { InventoryItem } from "@/types";
import {
  ExpiryStatusBadge,
  StockStatusBadge,
  formatMoney,
} from "./inventory-ui";

export function InventoryItemsTable({
  items,
  isLoading,
  emptyMessage = "No inventory items found.",
  onEdit,
  onDelete,
  showView = true,
}: {
  items: InventoryItem[];
  isLoading?: boolean;
  emptyMessage?: string;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (id: number) => void;
  showView?: boolean;
}) {
  const colSpan = 12;

  return (
    <div className="surface border rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left muted surface-2 border-b border-black/5 dark:border-white/10">
          <tr>
            <th className="px-3 py-2.5">Item</th>
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Qty</th>
            <th className="px-3 py-2.5">Unit</th>
            <th className="px-3 py-2.5">Reorder</th>
            <th className="px-3 py-2.5">Unit Cost</th>
            <th className="px-3 py-2.5">Total Value</th>
            <th className="px-3 py-2.5">Batch</th>
            <th className="px-3 py-2.5">Expiry</th>
            <th className="px-3 py-2.5">Supplier</th>
            <th className="px-3 py-2.5">Status</th>
            {(showView || onEdit || onDelete) && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={colSpan} className="py-8 text-center muted">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && items.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="py-10">
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.item_id} className={TABLE_ROW}>
              <td className="px-3 py-2">
                <Link
                  href={routes.inventoryItemDetail(item.item_id)}
                  className="font-medium hover:text-indigo-400"
                >
                  {item.item_name}
                </Link>
              </td>
              <td className="px-3 py-2">{item.category}</td>
              <td className="px-3 py-2 font-medium">{item.quantity}</td>
              <td className="px-3 py-2">{item.unit}</td>
              <td className="px-3 py-2">{item.reorder_level ?? "—"}</td>
              <td className="px-3 py-2">{formatMoney(item.unit_cost)}</td>
              <td className="px-3 py-2">{formatMoney(item.total_value)}</td>
              <td className="px-3 py-2">{item.batch ?? item.primary_lot?.lot_number ?? "—"}</td>
              <td className="px-3 py-2">
                <div>{item.expiry_date ?? item.primary_lot?.expiry_date ?? "—"}</div>
                <ExpiryStatusBadge status={item.expiry_status} />
              </td>
              <td className="px-3 py-2">{item.supplier ?? item.primary_lot?.supplier ?? "—"}</td>
              <td className="px-3 py-2">
                <StockStatusBadge status={item.stock_status} />
              </td>
              {(showView || onEdit || onDelete) && (
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1 justify-end">
                    {showView && (
                      <Link
                        href={routes.inventoryItemDetail(item.item_id)}
                        title="View"
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Eye size={14} />
                      </Link>
                    )}
                    {onEdit && (
                      <button
                        title="Edit"
                        onClick={() => onEdit(item)}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        title="Delete"
                        onClick={() => onDelete(item.item_id)}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
