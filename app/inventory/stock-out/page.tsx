"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { Field, inputCls } from "@/app/components/modal";
import { useInventory, useStockMovement } from "@/hooks";
import { routes } from "@/lib/routes";
import {
  WorkflowCard,
  itemSelectLabel,
  StockStatusBadge,
} from "@/app/inventory/components/inventory-ui";

const defaultForm = {
  item_id: "",
  quantity: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function StockOutPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...defaultForm });
  const { data } = useInventory({ pageSize: "500", is_active: "true" });
  const stockMutation = useStockMovement();

  const items = useMemo(
    () => (data?.data ?? []).filter((i) => i.quantity > 0),
    [data],
  );
  const selected = useMemo(
    () => items.find((i) => i.item_id === Number(form.item_id)),
    [items, form.item_id],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_id) return alert("Select an item.");
    if (!form.quantity) return alert("Enter quantity used.");

    stockMutation.mutate(
      {
        id: Number(form.item_id),
        action: "stock_out",
        data: {
          quantity: Number(form.quantity),
          transaction_date: form.transaction_date,
          notes: form.notes || null,
        },
      },
      {
        onSuccess: () => {
          setForm({ ...defaultForm });
          router.push(routes.inventoryDashboard);
        },
        onError: (err) => alert(err.message),
      },
    );
  }

  return (
    <>
      <Navbar title="Stock Out / Usage" subtitle="Record feed, medicine, or supply consumption" />
      <div className="p-6">
        <WorkflowCard
          title="Record usage"
          description="Select the item consumed and enter the quantity used. Stock levels and alerts update automatically."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Inventory Item">
              <select
                className={inputCls}
                value={form.item_id}
                onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                required
              >
                <option value="">Select item…</option>
                {items.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {itemSelectLabel(item)}
                  </option>
                ))}
              </select>
            </Field>

            {selected && (
              <div className="flex flex-wrap items-center gap-3 text-sm px-3 py-2 rounded-lg border surface">
                <span>
                  Available: {selected.quantity} {selected.unit}
                </span>
                <StockStatusBadge status={selected.stock_status} />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Quantity Used">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selected?.quantity}
                  className={inputCls}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </Field>
              <Field label="Usage Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Purpose: feeding round, treatment, vaccination, etc."
              />
            </Field>

            <p className="text-xs muted">
              Animal linkage is not supported by the current schema; use notes to describe usage context.
            </p>

            <button
              type="submit"
              disabled={stockMutation.isPending}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {stockMutation.isPending ? "Recording…" : "Record Usage"}
            </button>
          </form>
        </WorkflowCard>
      </div>
    </>
  );
}
