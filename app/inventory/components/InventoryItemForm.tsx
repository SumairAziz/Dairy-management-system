"use client";

import { Field, inputCls } from "@/app/components/modal";
import { INVENTORY_CATEGORIES } from "@/lib/inventory-status";
import type { Farm } from "@/types";

export type InventoryFormState = {
  item_name: string;
  category: string;
  quantity: string;
  unit: string;
  reorder_level: string;
  unit_cost: string;
  supplier: string;
  expiry_date: string;
  farm_id: string;
  notes: string;
};

export const defaultInventoryForm: InventoryFormState = {
  item_name: "",
  category: "Feed",
  quantity: "0",
  unit: "kg",
  reorder_level: "",
  unit_cost: "",
  supplier: "",
  expiry_date: "",
  farm_id: "",
  notes: "",
};

export function InventoryItemForm({
  form,
  setForm,
  categories,
  farms,
}: {
  form: InventoryFormState;
  setForm: (next: InventoryFormState) => void;
  categories: string[];
  farms?: Farm[];
}) {
  const options =
    categories.length > 0
      ? categories
      : [...INVENTORY_CATEGORIES];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Item Name">
        <input
          className={inputCls}
          value={form.item_name}
          onChange={(e) => setForm({ ...form, item_name: e.target.value })}
        />
      </Field>
      <Field label="Category">
        <select
          className={inputCls}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantity">
        <input
          type="number"
          min="0"
          step="0.01"
          className={inputCls}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
      </Field>
      <Field label="Unit">
        <input
          className={inputCls}
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
      </Field>
      <Field label="Reorder Level">
        <input
          type="number"
          min="0"
          step="0.01"
          className={inputCls}
          value={form.reorder_level}
          onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
        />
      </Field>
      <Field label="Unit Cost">
        <input
          type="number"
          min="0"
          step="0.01"
          className={inputCls}
          value={form.unit_cost}
          onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
        />
      </Field>
      <Field label="Supplier">
        <input
          className={inputCls}
          value={form.supplier}
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
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
      {farms && (
        <Field label="Farm">
          <select
            className={inputCls}
            value={form.farm_id}
            onChange={(e) => setForm({ ...form, farm_id: e.target.value })}
          >
            <option value="">All / Central</option>
            {farms.map((f) => (
              <option key={f.farm_id} value={f.farm_id}>
                {f.farm_name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Notes">
        <input
          className={inputCls}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function buildInventoryPayload(form: InventoryFormState) {
  return {
    item_name: form.item_name,
    category: form.category as (typeof INVENTORY_CATEGORIES)[number],
    quantity: Number(form.quantity || 0),
    unit: form.unit,
    reorder_level: form.reorder_level ? Number(form.reorder_level) : null,
    unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
    supplier: form.supplier || null,
    expiry_date: form.expiry_date || null,
    farm_id: form.farm_id ? Number(form.farm_id) : null,
    notes: form.notes || null,
    is_active: true,
  };
}

export function formFromItem(item: {
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number | null;
  unit_cost: number | null;
  supplier: string | null;
  expiry_date: string | null;
  farm_id: number | null;
  notes: string | null;
}): InventoryFormState {
  return {
    item_name: item.item_name,
    category: item.category,
    quantity: String(item.quantity),
    unit: item.unit,
    reorder_level: item.reorder_level != null ? String(item.reorder_level) : "",
    unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
    supplier: item.supplier ?? "",
    expiry_date: item.expiry_date ?? "",
    farm_id: item.farm_id != null ? String(item.farm_id) : "",
    notes: item.notes ?? "",
  };
}
