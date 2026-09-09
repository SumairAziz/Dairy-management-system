"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  InventoryItem,
  InventoryItemDetail,
  InventoryStats,
  InventorySupplierSummary,
  InventoryTransaction,
  PaginatedResponse,
} from "@/types";
import type {
  CreateInventoryItemInput,
  StockAdjustmentInput,
  StockInInput,
  StockMovementInput,
  UpdateInventoryItemInput,
} from "@/validators/inventory.validator";

export function useInventory(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["inventory", params],
    queryFn: () => api.get<PaginatedResponse<InventoryItem>>(`/inventory?${qs}`),
  });
}

export function useInventoryItem(id: number) {
  return useQuery({
    queryKey: ["inventory-item", id],
    queryFn: () => api.get<InventoryItemDetail>(`/inventory/${id}`),
    enabled: id > 0,
  });
}

export function useInventoryStats() {
  return useQuery({
    queryKey: ["inventory-stats"],
    queryFn: () => api.get<InventoryStats>("/inventory/stats"),
  });
}

export function useInventoryMeta() {
  return useQuery({
    queryKey: ["inventory-meta"],
    queryFn: () =>
      api.get<{ categories: string[]; suppliers: string[] }>("/inventory/meta"),
  });
}

export function useInventoryTransactions(limit = 10) {
  return useQuery({
    queryKey: ["inventory-transactions", limit],
    queryFn: () =>
      api.get<InventoryTransaction[]>(`/inventory/transactions?limit=${limit}`),
  });
}

export function useInventoryTransactionHistory(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["inventory-transaction-history", params],
    queryFn: () =>
      api.get<PaginatedResponse<InventoryTransaction>>(`/inventory/transactions?${qs}`),
  });
}

export function useInventorySuppliers() {
  return useQuery({
    queryKey: ["inventory-suppliers"],
    queryFn: () => api.get<InventorySupplierSummary[]>("/inventory/suppliers"),
  });
}

function invalidateInventoryQueries(qc: ReturnType<typeof useQueryClient>, itemId?: number) {
  qc.invalidateQueries({ queryKey: ["inventory"] });
  qc.invalidateQueries({ queryKey: ["inventory-stats"] });
  qc.invalidateQueries({ queryKey: ["inventory-meta"] });
  qc.invalidateQueries({ queryKey: ["inventory-suppliers"] });
  qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
  qc.invalidateQueries({ queryKey: ["inventory-transaction-history"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  if (itemId) qc.invalidateQueries({ queryKey: ["inventory-item", itemId] });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInventoryItemInput) =>
      api.post<InventoryItem>("/inventory", data),
    onSuccess: () => invalidateInventoryQueries(qc),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateInventoryItemInput }) =>
      api.put<InventoryItem>(`/inventory/${id}`, data),
    onSuccess: (_data, vars) => invalidateInventoryQueries(qc, vars.id),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/inventory/${id}`),
    onSuccess: () => invalidateInventoryQueries(qc),
  });
}

export function useStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      data,
    }: {
      id: number;
      action: "stock_in" | "stock_out" | "usage";
      data: StockMovementInput | StockInInput;
    }) => api.patch<InventoryItem>(`/inventory/${id}`, { action, ...data }),
    onSuccess: (_data, vars) => invalidateInventoryQueries(qc, vars.id),
  });
}

export function useStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: StockAdjustmentInput;
    }) => api.patch<InventoryItem>(`/inventory/${id}`, data),
    onSuccess: (_data, vars) => invalidateInventoryQueries(qc, vars.id),
  });
}
