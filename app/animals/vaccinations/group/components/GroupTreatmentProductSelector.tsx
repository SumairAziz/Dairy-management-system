"use client";

import { Search } from "lucide-react";
import { Field, inputCls } from "@/app/components/modal";
import type { GroupTreatmentProduct } from "@/services/group-treatment.service";

interface GroupTreatmentProductSelectorProps {
  label: string;
  products: GroupTreatmentProduct[];
  selectedId: string;
  search: string;
  loading?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (itemId: number) => void;
}

export function GroupTreatmentProductSelector({
  label,
  products,
  selectedId,
  search,
  loading = false,
  onSearchChange,
  onSelect,
}: GroupTreatmentProductSelectorProps) {
  return (
    <div className="sm:col-span-2">
      <Field label={label}>
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          className={`${inputCls} pl-9`}
          placeholder="Search products…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search products"
        />
      </div>

      <div className="mt-2 rounded-xl border overflow-hidden">
        {loading ? (
          <p className="px-3 py-4 text-sm muted">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="px-3 py-4 text-sm muted">
            {search.trim()
              ? "No products found matching your search."
              : "No products found in inventory for this treatment type."}
          </p>
        ) : (
          <ul
            className="max-h-56 overflow-y-auto divide-y divide-black/5 dark:divide-white/10"
            role="listbox"
            aria-label="Treatment products"
          >
            {products.map((item) => {
              const outOfStock = item.quantity <= 0;
              const selected = String(item.item_id) === selectedId;

              return (
                <li key={item.item_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={outOfStock}
                    onClick={() => onSelect(item.item_id)}
                    className={`w-full text-left px-3 py-3 transition-colors ${
                      outOfStock
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    } ${
                      selected
                        ? "bg-brand-500/10 border-l-2 border-brand-500"
                        : "border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item.item_name}
                        </div>
                        <div className="text-xs muted mt-0.5">{item.category}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-medium ${
                            outOfStock ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {item.quantity} {item.unit}
                        </div>
                        <div className="text-xs muted">
                          {outOfStock ? "Out of stock" : "Available"}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </Field>
    </div>
  );
}
