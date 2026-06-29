"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { MilkLog, MilkStats, PaginatedResponse } from "@/types";
import type { CreateMilkLogInput } from "@/validators/milk-log.validator";

export function useMilkLogs(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["milk-logs", params],
    queryFn: () => api.get<PaginatedResponse<MilkLog>>(`/milk-logs?${qs || "pageSize=100"}`),
  });
}

export function useMilkStats() {
  return useQuery({
    queryKey: ["milk-stats"],
    queryFn: () => api.get<MilkStats>("/milk-logs/stats"),
  });
}

export function useCreateMilkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMilkLogInput) => api.post<MilkLog>("/milk-logs", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milk-logs"] });
      qc.invalidateQueries({ queryKey: ["milk-stats"] });
    },
  });
}

export function useDeleteMilkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/milk-logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milk-logs"] });
      qc.invalidateQueries({ queryKey: ["milk-stats"] });
    },
  });
}