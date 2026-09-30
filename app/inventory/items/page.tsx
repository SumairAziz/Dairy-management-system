"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { PaginationControls } from "@/app/components/pagination";
import { Plus, Filter } from "lucide-react";
import {
  useInventory,
  useInventoryMeta,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useFarms,
  useUrlFilters,
} from "@/hooks";
import { INVENTORY_CATEGORIES } from "@/lib/inventory-status";
import { InventoryItemsTable } from "@/app/inventory/components/InventoryItemsTable";
import {
  InventoryItemForm,
  buildInventoryPayload,
  defaultInventoryForm,
  formFromItem,
} from "@/app/inventory/components/InventoryItemForm";
import type { InventoryItem } from "@/types";

const FILTER_KEYS = [
  "search",
  "category",
  "stock_status",
  "supplier",
  "expiry_status",
  "sort_by",
  "sort_order",
] as const;

export default function InventoryItemsPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useUrlFilters(FILTER_KEYS, {
    sort_by: "item_name",
    sort_order: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultInventoryForm });

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: String(pageSize),
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page, pageSize],
  );

  const { data, isLoading } = useInventory(queryParams);
  const { data: meta } = useInventoryMeta();
  const { data: farms } = useFarms();
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const deleteMutation = useDeleteInventoryItem();

  const categories = useMemo(() => {
    const fromDb = meta?.categories ?? [];
    return [...new Set([...INVENTORY_CATEGORIES, ...fromDb])].sort();
  }, [meta]);

  const suppliers = meta?.suppliers ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && k !== "sort_by" && k !== "sort_order",
  ).length;

  useEffect(() => {
    if (searchParams.get("action") === "add") setOpenCreate(true);
  }, [searchParams]);

  function handleCreate() {
    if (!form.item_name.trim()) return alert("Item name is required.");
    createMutation.mutate(buildInventoryPayload(form), {
      onSuccess: () => {
        setOpenCreate(false);
        setForm({ ...defaultInventoryForm });
      },
      onError: (e) => alert(e.message),
    });
  }

  function handleUpdate() {
    if (!editTarget) return;
    updateMutation.mutate(
      { id: editTarget.item_id, data: buildInventoryPayload(form) },
      {
        onSuccess: () => {
          setEditTarget(null);
          setForm({ ...defaultInventoryForm });
        },
        onError: (e) => alert(e.message),
      },
    );
  }

  return (
    <>
      <Navbar title="Items & Stock" subtitle={`${data?.total ?? 0} items in catalog`} />
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
            >
              <Filter size={14} /> Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <input
              placeholder="Search items…"
              className={`${inputCls} max-w-[240px]`}
              value={filters.search ?? ""}
              onChange={(e) => {
                setPage(1);
                setFilters({ ...filters, search: e.target.value });
              }}
            />
          </div>
          <button
            onClick={() => {
              setForm({ ...defaultInventoryForm });
              setOpenCreate(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        {showFilters && (
          <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stock Status">
              <select
                className={inputCls}
                value={filters.stock_status ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, stock_status: e.target.value });
                }}
              >
                <option value="">All</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </Field>
            <Field label="Supplier">
              <select
                className={inputCls}
                value={filters.supplier ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, supplier: e.target.value });
                }}
              >
                <option value="">All</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expiry">
              <select
                className={inputCls}
                value={filters.expiry_status ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, expiry_status: e.target.value });
                }}
              >
                <option value="">All</option>
                <option value="expired">Expired</option>
                <option value="expiring">Expiring Soon</option>
                <option value="ok">OK</option>
                <option value="none">No Expiry</option>
              </select>
            </Field>
            <Field label="Sort By">
              <select
                className={inputCls}
                value={filters.sort_by ?? "item_name"}
                onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
              >
                <option value="item_name">Name</option>
                <option value="category">Category</option>
                <option value="quantity">Quantity</option>
                <option value="expiry_date">Expiry</option>
                <option value="unit_cost">Unit Cost</option>
              </select>
            </Field>
            <Field label="Order">
              <select
                className={inputCls}
                value={filters.sort_order ?? "asc"}
                onChange={(e) => setFilters({ ...filters, sort_order: e.target.value })}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </Field>
          </div>
        )}

        <InventoryItemsTable
          items={data?.data ?? []}
          isLoading={isLoading}
          onEdit={(item) => {
            setEditTarget(item);
            setForm(formFromItem(item));
          }}
          onDelete={setDeleteId}
        />

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalRecords={data?.total ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Add Inventory Item"
        footer={
          <>
            <button onClick={() => setOpenCreate(false)} className="px-4 py-2 text-sm rounded-lg border">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white"
            >
              {createMutation.isPending ? "Saving…" : "Create Item"}
            </button>
          </>
        }
      >
        <InventoryItemForm form={form} setForm={setForm} categories={categories} farms={farms} />
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Inventory Item"
        footer={
          <>
            <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm rounded-lg border">
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white"
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <InventoryItemForm form={form} setForm={setForm} categories={categories} farms={farms} />
      </Modal>

      <ConfirmModal
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId == null) return;
          deleteMutation.mutate(deleteId, { onError: (e) => alert(e.message) });
        }}
        title="Delete inventory item?"
        message="This will permanently remove the item and its transaction history."
      />
    </>
  );
}
