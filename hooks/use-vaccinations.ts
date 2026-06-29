"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { VaccinationRecord, PaginatedResponse } from "@/types";
import type { CreateVaccinationInput, UpdateVaccinationInput } from "@/validators/vaccination.validator";

export function useVaccinations(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["vaccinations", params],
    queryFn: () => api.get<PaginatedResponse<VaccinationRecord>>(`/vaccinations?${qs || "pageSize=100"}`),
  });
}

export function useVaccination(id: number) {
  return useQuery({
    queryKey: ["vaccination", id],
    queryFn: () => api.get<VaccinationRecord>(`/vaccinations/${id}`),
    enabled: !!id,
  });
}

export function useCreateVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVaccinationInput) => api.post<VaccinationRecord>("/vaccinations", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vaccinations"] }),
  });
}

export function useUpdateVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVaccinationInput }) =>
      api.put<VaccinationRecord>(`/vaccinations/${id}`, data),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["vaccinations"] }),
  });
}

export function useDeleteVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/vaccinations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vaccinations"] }),
  });
}