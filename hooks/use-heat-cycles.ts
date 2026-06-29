"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { HeatCycleRecord, PaginatedResponse } from "@/types";
import type {
  CreateHeatCycleInput,
  UpdateHeatCycleInput,
} from "@/validators/heat-cycle.validator";

export function useHeatCycles(
  params: Record<string, string> = {},
  enabled = true,
) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["heat-cycles", params],
    queryFn: () =>
      api.get<PaginatedResponse<HeatCycleRecord>>(
        `/heat-cycles?${qs || "pageSize=100"}`,
      ),
    enabled,
  });
}

export function useHeatCycle(id: number) {
  return useQuery({
    queryKey: ["heat-cycle", id],
    queryFn: () => api.get<HeatCycleRecord>(`/heat-cycles/${id}`),
    enabled: !!id,
  });
}

export function useCreateHeatCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHeatCycleInput) =>
      api.post<HeatCycleRecord>("/heat-cycles", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["heat-cycles"] }),
  });
}

export function useUpdateHeatCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateHeatCycleInput }) =>
      api.put<HeatCycleRecord>(`/heat-cycles/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["heat-cycles"] }),
  });
}

export function useDeleteHeatCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/heat-cycles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["heat-cycles"] }),
  });
}
