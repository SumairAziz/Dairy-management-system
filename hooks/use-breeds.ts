"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Breed } from "@/types";
import type { CreateBreedInput } from "@/validators/breeds.validator";

export function useBreeds(speciesId?: number) {
  const qs = speciesId ? `?species_id=${speciesId}` : "";
  return useQuery({
    queryKey: ["breeds", speciesId],
    queryFn: () => api.get<Breed[]>(`/breeds${qs}`),
  });
}

export function useCreateBreed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBreedInput) => api.post<Breed>("/breeds", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["breeds"] }),
  });
}

export function useDeleteBreed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/breeds/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["breeds"] }),
  });
}