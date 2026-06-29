"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Animal, PaginatedResponse } from "@/types";
import type { CreateAnimalInput, UpdateAnimalInput } from "@/validators/animal.validator";

export function useAnimals(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["animals", params],
    queryFn: () => api.get<PaginatedResponse<Animal>>(`/animals?${qs}`),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animals"] }),
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
    },
  });
}

export function useDeleteAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/animals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animals"] }),
  });
}