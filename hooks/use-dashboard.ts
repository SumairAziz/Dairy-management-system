"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DashboardStats } from "@/types";
import type { MilkTrendPeriodId, MilkTrendResponse } from "@/lib/dashboard-milk-trend";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/dashboard"),
  });
}

export function useDashboardMilkTrend(period: MilkTrendPeriodId) {
  return useQuery({
    queryKey: ["dashboard", "milk-trend", period],
    queryFn: () => api.get<MilkTrendResponse>(`/dashboard/milk-trend?period=${period}`),
    staleTime: 60_000,
  });
}
