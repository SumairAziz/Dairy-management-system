"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { Field, inputCls } from "@/app/components/modal";
import { EmptyState } from "@/app/components/custom-charts";
import {
  useInventory,
  useInventoryMeta,
  useInventoryTransactionHistory,
  useUrlFilters,
} from "@/hooks";
import { routes } from "@/lib/routes";
import { TABLE_ROW } from "@/lib/theme";
import { ItemLink } from "@/app/inventory/components/inventory-ui";
import { PaginationControls } from "@/app/components/pagination";
import { Filter } from "lucide-react";
import type { InventoryTransaction } from "@/types";

const FILTER_KEYS = [
  "item_id",
  "category",
  "transaction_type",
  "date_from",
  "date_to",
] as const;

const MOVEMENT_TYPES = [
  "Stock In",
  "Stock Out",
  "Usage",
  "Group Treatment",
  "Adjustment",
  "Damaged",
  "Expired",
  "Lost",
  "Return",
  "Physical Count",
];

function movementTone(type: string) {
  if (type === "Stock In" || type === "Return") return "text-emerald-400";
  return "text-rose-400";
}

export default function InventoryTransactionsPage() {
  const [filters, setFilters] = useUrlFilters(FILTER_KEYS, {});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const pageSize = 25;

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: String(pageSize),
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page],
  );

  const { data, isLoading, isError } = useInventoryTransactionHistory(queryParams);
  const { data: meta } = useInventoryMeta();
  const { data: itemsData } = useInventory({ pageSize: "500", is_active: "true" });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const rows = data?.data ?? [];

  return (
    <>
      <Navbar
        title="Stock Movement History"
        subtitle={`${data?.total ?? 0} transactions recorded`}
      />
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
          >
            <Filter size={14} /> Filters
          </button>
          <div className="flex gap-2">
            <Link href={routes.inventoryStockIn} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm">
              Stock In
            </Link>
            <Link href={routes.inventoryAdjustments} className="px-3 py-2 rounded-lg surface border text-sm">
              Adjustments
            </Link>
          </div>
        </div>

        {showFilters && (
          <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Field label="Item">
              <select
                className={inputCls}
                value={filters.item_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, item_id: e.target.value });
                }}
              >
                <option value="">All items</option>
                {(itemsData?.data ?? []).map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                className={inputCls}
                value={filters.category ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, category: e.target.value });
                }}
              >
                <option value="">All</option>
                {(meta?.categories ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className={inputCls}
                value={filters.transaction_type ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, transaction_type: e.target.value });
                }}
              >
                <option value="">All types</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input
                type="date"
                className={inputCls}
                value={filters.date_from ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, date_from: e.target.value });
                }}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                className={inputCls}
                value={filters.date_to ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, date_to: e.target.value });
                }}
              />
            </Field>
          </div>
        )}

        <div className="surface border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted surface-2 border-b">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5">Batch</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Qty</th>
                <th className="px-3 py-2.5">Reason / Reference</th>
                <th className="px-3 py-2.5">User</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center muted">
                    Loading…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={7} className="py-8">
                    <EmptyState message="Couldn't load transactions" />
                  </td>
                </tr>
              )}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10">
                    <EmptyState message="No transactions match your filters." />
                  </td>
                </tr>
              )}
              {rows.map((row: InventoryTransaction) => (
                <tr key={row.transaction_id} className={TABLE_ROW}>
                  <td className="px-3 py-2 whitespace-nowrap">{row.transaction_date}</td>
                  <td className="px-3 py-2">
                    {row.item ? (
                      <ItemLink id={row.item.item_id} name={row.item.item_name} />
                    ) : (
                      `#${row.item_id}`
                    )}
                  </td>
                  <td className="px-3 py-2">{row.lot?.lot_number ?? "—"}</td>
                  <td className={`px-3 py-2 font-medium ${movementTone(row.transaction_type)}`}>
                    {row.transaction_type}
                  </td>
                  <td className="px-3 py-2">
                    {row.quantity} {row.item?.unit ?? ""}
                  </td>
                  <td className="px-3 py-2 max-w-[240px] truncate">
                    {row.reference ?? row.notes ?? "—"}
                  </td>
                  <td className="px-3 py-2">{row.user?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalRecords={data?.total ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
