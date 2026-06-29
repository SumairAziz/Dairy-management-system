"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BreedingRecord, PaginatedResponse } from "@/types";
import type {
  CreateBreedingRecordInput,
  UpdateBreedingRecordInput,
} from "@/validators/breeding.validator";

export function useBreedingRecords(
  params: Record<string, string> = {},
  enabled = true,
) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["breeding-records", params],
    queryFn: () =>
      api.get<PaginatedResponse<BreedingRecord>>(
        `/breeding-records?${qs || "pageSize=100"}`,
      ),
    enabled,
  });
}

export function useBreedingRecord(id: number) {
  return useQuery({
    queryKey: ["breeding-record", id],
    queryFn: () => api.get<BreedingRecord>(`/breeding-records/${id}`),
    enabled: !!id,
  });
}

export function useCreateBreedingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBreedingRecordInput) =>
      api.post<BreedingRecord>("/breeding-records", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["breeding-records"] }),
  });
}

export function useUpdateBreedingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateBreedingRecordInput;
    }) => api.put<BreedingRecord>(`/breeding-records/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["breeding-records"] }),
  });
}

export function useDeleteBreedingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/breeding-records/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["breeding-records"] }),
  });
}
