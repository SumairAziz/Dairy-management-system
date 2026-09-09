"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { Field, inputCls } from "@/app/components/modal";
import { useInventory, useStockAdjustment } from "@/hooks";
import { routes } from "@/lib/routes";
import {
  WorkflowCard,
  itemSelectLabel,
  StockStatusBadge,
} from "@/app/inventory/components/inventory-ui";
import type { AdjustmentAction } from "@/lib/inventory-movements";

const ACTIONS: { value: AdjustmentAction; label: string; description: string }[] = [
  { value: "adjustment", label: "Stock adjustment", description: "Increase or decrease stock with a reason" },
  { value: "damaged", label: "Damaged stock", description: "Remove damaged units (FEFO)" },
  { value: "expired", label: "Expired stock", description: "Write off expired units" },
  { value: "lost", label: "Lost stock", description: "Record missing or lost units" },
  { value: "return", label: "Returned stock", description: "Add returned units back to inventory" },
  { value: "physical_count", label: "Physical count", description: "Correct stock to counted quantity" },
];

const defaultForm = {
  item_id: "",
  action: "adjustment" as AdjustmentAction,
  direction: "out" as "in" | "out",
  quantity: "",
  counted_quantity: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  reason: "",
  reference: "",
  lot_number: "",
  expiry_date: "",
};

export default function InventoryAdjustmentsPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...defaultForm });
  const { data } = useInventory({ pageSize: "500", is_active: "true" });
  const adjustMutation = useStockAdjustment();

  const items = data?.data ?? [];
  const selected = useMemo(
    () => items.find((i) => i.item_id === Number(form.item_id)),
    [items, form.item_id],
  );

  const isPhysicalCount = form.action === "physical_count";
  const isReturn = form.action === "return";
  const isInboundAdjustment = form.action === "adjustment" && form.direction === "in";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_id) return alert("Select an item.");
    if (!form.reason.trim()) return alert("Reason is required.");

    const payload = {
      action: form.action,
      transaction_date: form.transaction_date,
      reason: form.reason.trim(),
      reference: form.reference || null,
      ...(isPhysicalCount
        ? { counted_quantity: Number(form.counted_quantity) }
        : { quantity: Number(form.quantity) }),
      ...(form.action === "adjustment" ? { direction: form.direction } : {}),
      ...((isReturn || isInboundAdjustment) && form.lot_number
        ? { lot_number: form.lot_number }
        : {}),
      ...((isReturn || isInboundAdjustment) && form.expiry_date
        ? { expiry_date: form.expiry_date }
        : {}),
    };

    adjustMutation.mutate(
      { id: Number(form.item_id), data: payload as never },
      {
        onSuccess: () => {
          setForm({ ...defaultForm });
          router.push(routes.inventoryTransactions);
        },
        onError: (err) => alert(err.message),
      },
    );
  }

  return (
    <>
      <Navbar title="Stock Adjustments" subtitle="Corrections, damage, expiry, and physical counts" />
      <div className="p-6">
        <WorkflowCard
          title="Record stock adjustment"
          description="Every adjustment requires a reason and creates a transaction in the movement history."
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
                  Current: {selected.quantity} {selected.unit}
                </span>
                <StockStatusBadge status={selected.stock_status} />
              </div>
            )}

            <Field label="Adjustment Type">
              <select
                className={inputCls}
                value={form.action}
                onChange={(e) =>
                  setForm({ ...form, action: e.target.value as AdjustmentAction })
                }
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="text-xs muted mt-1">
                {ACTIONS.find((a) => a.value === form.action)?.description}
              </p>
            </Field>

            {form.action === "adjustment" && (
              <Field label="Direction">
                <select
                  className={inputCls}
                  value={form.direction}
                  onChange={(e) =>
                    setForm({ ...form, direction: e.target.value as "in" | "out" })
                  }
                >
                  <option value="out">Decrease stock</option>
                  <option value="in">Increase stock</option>
                </select>
              </Field>
            )}

            {isPhysicalCount ? (
              <Field label="Counted Quantity">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.counted_quantity}
                  onChange={(e) => setForm({ ...form, counted_quantity: e.target.value })}
                  required
                />
              </Field>
            ) : (
              <Field label="Quantity">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={!isReturn && !isInboundAdjustment ? selected?.quantity : undefined}
                  className={inputCls}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </Field>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </Field>
              <Field label="Reference (optional)">
                <input
                  className={inputCls}
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Invoice, audit ref, etc."
                />
              </Field>
            </div>

            {(isReturn || isInboundAdjustment) && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Batch / Lot (optional)">
                  <input
                    className={inputCls}
                    value={form.lot_number}
                    onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                  />
                </Field>
                <Field label="Expiry (optional)">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  />
                </Field>
              </div>
            )}

            <Field label="Reason (required)">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Explain why this adjustment is being made"
                required
              />
            </Field>

            <button
              type="submit"
              disabled={adjustMutation.isPending}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {adjustMutation.isPending ? "Saving…" : "Record Adjustment"}
            </button>
          </form>
        </WorkflowCard>
      </div>
    </>
  );
}
