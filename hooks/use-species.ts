"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Species } from "@/types";
import type { CreateSpeciesInput } from "@/validators/species.validator";

export function useSpecies() {
  return useQuery({ queryKey: ["species"], queryFn: () => api.get<Species[]>("/species") });
}

export function useCreateSpecies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSpeciesInput) => api.post<Species>("/species", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["species"] }),
  });
}

export function useDeleteSpecies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/species/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["species"] }),
  });
}