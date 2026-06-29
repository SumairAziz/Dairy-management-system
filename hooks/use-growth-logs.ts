"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GrowthLog } from "@/types";
import type { CreateGrowthLogInput } from "@/validators/growth-logs.validator";

export function useGrowthLogs(animalId: number) {
  return useQuery({
    queryKey: ["growth-logs", animalId],
    queryFn: () => api.get<GrowthLog[]>(`/animals/${animalId}/growth-logs`),
    enabled: !!animalId,
  });
}

export function useCreateGrowthLog(animalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGrowthLogInput) =>
      api.post<GrowthLog>(`/animals/${animalId}/growth-logs`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-logs", animalId] }),
  });
}