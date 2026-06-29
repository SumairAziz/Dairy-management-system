"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { HealthIncident } from "@/types";
import type { CreateHealthIncidentInput, UpdateHealthIncidentInput } from "@/validators/health-incidents.validator";

export function useHealthIncidents(animalId: number) {
  return useQuery({
    queryKey: ["health-incidents", animalId],
    queryFn: () => api.get<HealthIncident[]>(`/animals/${animalId}/health-incidents`),
    enabled: !!animalId,
  });
}

export function useCreateHealthIncident(animalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHealthIncidentInput) =>
      api.post<HealthIncident>(`/animals/${animalId}/health-incidents`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-incidents", animalId] }),
  });
}

export function useUpdateHealthIncident(animalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, data }: { incidentId: number; data: UpdateHealthIncidentInput }) =>
      api.put<HealthIncident>(`/animals/${animalId}/health-incidents/${incidentId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-incidents", animalId] }),
  });
}

export function useDeleteHealthIncident(animalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: number) =>
      api.del(`/animals/${animalId}/health-incidents/${incidentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-incidents", animalId] }),
  });
}