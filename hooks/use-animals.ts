"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Animal, AnimalStats, PaginatedResponse } from "@/types";
import type { CreateAnimalInput, UpdateAnimalInput } from "@/validators/animal.validator";

export function useAnimals(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["animals", params],
    queryFn: () => api.get<PaginatedResponse<Animal>>(`/animals?${qs}`),
  });
}

export function useAnimalStats() {
  return useQuery({
    queryKey: ["animal-stats"],
    queryFn: () => api.get<AnimalStats>("/animals/stats"),
  });
}

export function useAnimal(id: number) {
  return useQuery({
    queryKey: ["animal", id],
    queryFn: () => api.get<Animal>(`/animals/${id}`),
    enabled: !!id,
  });
}

export function useCreateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnimalInput) => api.post<Animal>("/animals", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["animal-stats"] });
    },
  });
}

export function useUpdateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAnimalInput }) =>
      api.put<Animal>(`/animals/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["animal", v.id] });
      qc.invalidateQueries({ queryKey: ["animal-stats"] });
    },
  });
}

export function useDeleteAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/animals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["animal-stats"] });
    },
  });
}

export interface ProductionSummary {
  production_status: "lactating" | "dry" | "never_lactated" | "not_applicable";
  has_calving_history: boolean;
  has_milk_history: boolean;
  dry_since: string | null;
  dry_period_days: number | null;
  previous_lactation_start: string | null;
  previous_lactation_end: string | null;
  expected_calving: string | null;
  days_until_calving: number | null;
  planned_dry_off_date: string | null;
  dry_off_due: boolean;
  is_pregnant: boolean;
  can_mark_dry: boolean;
  can_mark_lactating: boolean;
}

export interface LactationPeriod {
  period_id: number;
  animal_id: number;
  period_type: "LACTATING" | "DRY";
  start_date: string;
  end_date: string | null;
  pregnancy_id: number | null;
  calving_id: number | null;
  notes: string | null;
  created_at: string;
}

export function useProductionSummary(animalId: number) {
  return useQuery({
    queryKey: ["production-summary", animalId],
    queryFn: () => api.get<ProductionSummary>(`/animals/${animalId}/production-status`),
    enabled: !!animalId,
  });
}

export function useLactationPeriods(animalId: number) {
  return useQuery({
    queryKey: ["lactation-periods", animalId],
    queryFn: () => api.get<LactationPeriod[]>(`/animals/${animalId}/lactation-periods`),
    enabled: !!animalId,
  });
}

export function useMarkProductionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      start_date,
      notes,
    }: {
      id: number;
      action: "mark_dry" | "mark_lactating";
      start_date?: string;
      notes?: string;
    }) =>
      api.post<ProductionSummary>(`/animals/${id}/production-status`, {
        action,
        start_date,
        notes,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["animal", vars.id] });
      qc.invalidateQueries({ queryKey: ["production-summary", vars.id] });
      qc.invalidateQueries({ queryKey: ["lactation-periods", vars.id] });
      qc.invalidateQueries({ queryKey: ["animal-stats"] });
      qc.invalidateQueries({ queryKey: ["milk-stats"] });
    },
  });
}