"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { Field, inputCls } from "@/app/components/modal";
import { useInventory, useStockMovement } from "@/hooks";
import { routes } from "@/lib/routes";
import {
  WorkflowCard,
  itemSelectLabel,
} from "@/app/inventory/components/inventory-ui";

const defaultForm = {
  item_id: "",
  quantity: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  unit_cost: "",
  supplier: "",
  lot_number: "",
  manufacturing_date: "",
  expiry_date: "",
  reference: "",
  notes: "",
};

export default function StockInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ ...defaultForm });
  const { data } = useInventory({ pageSize: "500", is_active: "true" });
  const stockMutation = useStockMovement();

  const items = data?.data ?? [];
  const selected = useMemo(
    () => items.find((i) => i.item_id === Number(form.item_id)),
    [items, form.item_id],
  );

  useEffect(() => {
    const preselect = searchParams.get("item_id");
    if (preselect) {
      setForm((f) => ({ ...f, item_id: preselect }));
    }
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_id) return alert("Select an item.");
    if (!form.quantity) return alert("Enter quantity received.");

    stockMutation.mutate(
      {
        id: Number(form.item_id),
        action: "stock_in",
        data: {
          quantity: Number(form.quantity),
          transaction_date: form.transaction_date,
          notes: form.notes || null,
          unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
          supplier: form.supplier || null,
          lot_number: form.lot_number || null,
          manufacturing_date: form.manufacturing_date || null,
          expiry_date: form.expiry_date || null,
          reference: form.reference || null,
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
      <Navbar title="Stock In" subtitle="Receive inventory into stock with batch tracking" />
      <div className="p-6">
        <WorkflowCard
          title="Record incoming stock"
          description="Creates a batch/lot record and updates item quantity. Expiry uses FEFO on future usage."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Inventory Item">
              <select
                className={inputCls}
                value={form.item_id}
                onChange={(e) => {
                  const item = items.find((i) => i.item_id === Number(e.target.value));
                  setForm({
                    ...form,
                    item_id: e.target.value,
                    unit_cost: item?.unit_cost != null ? String(item.unit_cost) : "",
                    supplier: item?.supplier ?? "",
                  });
                }}
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
              <div className="text-sm muted px-3 py-2 rounded-lg border surface">
                Current stock: {selected.quantity} {selected.unit}
                {selected.reorder_level != null && ` · reorder at ${selected.reorder_level}`}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Quantity Received">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </Field>
              <Field label="Receipt Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </Field>
              <Field label="Batch / Lot Number">
                <input
                  className={inputCls}
                  value={form.lot_number}
                  onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                  placeholder="e.g. LOT-2026-001"
                />
              </Field>
              <Field label="Manufacturing Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.manufacturing_date}
                  onChange={(e) => setForm({ ...form, manufacturing_date: e.target.value })}
                />
              </Field>
              <Field label="Expiry Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </Field>
              <Field label="Reference">
                <input
                  className={inputCls}
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="PO / delivery note"
                />
              </Field>
              <Field label="Unit Cost (optional update)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.unit_cost}
                  onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                />
              </Field>
              <Field label="Supplier (optional update)">
                <input
                  className={inputCls}
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Delivery reference, storage location, etc."
              />
            </Field>

            <button
              type="submit"
              disabled={stockMutation.isPending}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {stockMutation.isPending ? "Recording…" : "Record Stock In"}
            </button>
          </form>
        </WorkflowCard>
      </div>
    </>
  );
}
