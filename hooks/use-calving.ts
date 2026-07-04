"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CalvingRecord, PaginatedResponse } from "@/types";
import type { CreateCalvingInput, UpdateCalvingInput } from "@/validators/calving.validator";

export function useCalvingRecords(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["calving", params],
    queryFn: () => api.get<PaginatedResponse<CalvingRecord>>(`/calving?${qs || "pageSize=100"}`),
  });
}

export function useCalvingRecord(id: number) {
  return useQuery({
    queryKey: ["calving", id],
    queryFn: () => api.get<CalvingRecord>(`/calving/${id}`),
    enabled: !!id,
  });
}

export function useCreateCalving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCalvingInput) => api.post<CalvingRecord>("/calving", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calving"] });
      qc.invalidateQueries({ queryKey: ["pregnancy"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateCalving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCalvingInput }) =>
      api.put<CalvingRecord>(`/calving/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calving"] }),
  });
}

export function useDeleteCalving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/calving/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calving"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
