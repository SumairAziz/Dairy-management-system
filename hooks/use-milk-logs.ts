"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { MilkLog, MilkStats, DailyMilkRecord, PaginatedResponse } from "@/types";
import type { CreateMilkLogInput, UpsertDailyMilkInput } from "@/validators/milk-log.validator";

export function useMilkLogs(params: Record<string, string> = {}, options: { enabled?: boolean } = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["milk-logs", params],
    queryFn: () => api.get<PaginatedResponse<MilkLog>>(`/milk-logs?${qs || "pageSize=100"}`),
    enabled: options.enabled,
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
      qc.invalidateQueries({ queryKey: ["milk-logs-daily"] });
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
      qc.invalidateQueries({ queryKey: ["milk-logs-daily"] });
      qc.invalidateQueries({ queryKey: ["milk-stats"] });
    },
  });
}

export function useDailyMilkLogs(params: Record<string, string> = {}, options: { enabled?: boolean } = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["milk-logs-daily", params],
    queryFn: () => api.get<PaginatedResponse<DailyMilkRecord>>(`/milk-logs/daily?${qs || "pageSize=20"}`),
    enabled: options.enabled,
  });
}

export function useUpsertDailyMilkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertDailyMilkInput) => api.put<MilkLog[]>("/milk-logs/daily", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milk-logs"] });
      qc.invalidateQueries({ queryKey: ["milk-logs-daily"] });
      qc.invalidateQueries({ queryKey: ["milk-stats"] });
    },
  });
}

export function useDeleteDailyMilkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ animal_id, production_date }: { animal_id: number; production_date: string }) =>
      api.del(`/milk-logs/daily?animal_id=${animal_id}&production_date=${production_date}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milk-logs"] });
      qc.invalidateQueries({ queryKey: ["milk-logs-daily"] });
      qc.invalidateQueries({ queryKey: ["milk-stats"] });
    },
  });
}