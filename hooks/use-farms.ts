"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Farm, FarmDetail } from "@/types";
import type { CreateFarmInput, UpdateFarmInput } from "@/validators/farm.validator";

export function useFarms() {
  return useQuery({ queryKey: ["farms"], queryFn: () => api.get<Farm[]>("/farms") });
}

export function useFarm(id: number) {
  return useQuery({
    queryKey: ["farm", id],
    queryFn: () => api.get<FarmDetail>(`/farms/${id}`),
    enabled: !!id,
  });
}

export function useCreateFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFarmInput) => api.post<Farm>("/farms", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farms"] }),
  });
}

export function useUpdateFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateFarmInput }) =>
      api.put<Farm>(`/farms/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      qc.invalidateQueries({ queryKey: ["farm", v.id] });
    },
  });
}

export function useDeleteFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/farms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farms"] }),
  });
}