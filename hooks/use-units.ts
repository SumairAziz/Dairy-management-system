"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Unit, UnitDetail } from "@/types";
import type { CreateUnitInput, UpdateUnitInput } from "@/validators/units.validator";

export function useUnits(farmId?: number) {
  const qs = farmId ? `?farm_id=${farmId}` : "";
  return useQuery({
    queryKey: ["units", farmId],
    queryFn: () => api.get<Unit[]>(`/units${qs}`),
  });
}

export function useUnit(id: number) {
  return useQuery({
    queryKey: ["unit", id],
    queryFn: () => api.get<UnitDetail>(`/units/${id}`),
    enabled: !!id,
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUnitInput) => api.post<Unit>("/units", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUnitInput }) =>
      api.put<Unit>(`/units/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["unit", v.id] });
    },
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/units/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });
}
