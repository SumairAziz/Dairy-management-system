"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PregnancyRecord, PaginatedResponse } from "@/types";
import type { CreatePregnancyRecordInput, UpdatePregnancyRecordInput } from "@/validators/pregnancy.validator";

export function usePregnancyRecords(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["pregnancy-records", params],
    queryFn: () => api.get<PaginatedResponse<PregnancyRecord>>(`/pregnancy-records?${qs || "pageSize=100"}`),
  });
}

export function usePregnancyRecord(id: number) {
  return useQuery({
    queryKey: ["pregnancy-record", id],
    queryFn: () => api.get<PregnancyRecord>(`/pregnancy-records/${id}`),
    enabled: !!id,
  });
}

export function useCreatePregnancyRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePregnancyRecordInput) => api.post<PregnancyRecord>("/pregnancy-records", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregnancy-records"] }),
  });
}

export function useUpdatePregnancyRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePregnancyRecordInput }) =>
      api.put<PregnancyRecord>(`/pregnancy-records/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregnancy-records"] }),
  });
}

export function useDeletePregnancyRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/pregnancy-records/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pregnancy-records"] }),
  });
}