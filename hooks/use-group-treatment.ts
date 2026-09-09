"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GroupTreatmentProduct } from "@/services/group-treatment.service";
import type { GroupTreatmentInput } from "@/validators/group-treatment.validator";

export interface GroupTreatmentPreviewResult {
  animals: Array<{
    animal_id: number;
    tag_number: string;
    animal_name: string | null;
  }>;
  inventory: {
    item_id: number;
    item_name: string;
    category: string;
    unit: string;
    available_stock: number;
  };
  summary: {
    selected_count: number;
    dosage_per_animal: number;
    required_quantity: number;
    available_stock: number;
    remaining_after: number;
    shortfall: number;
    sufficient: boolean;
  };
  duplicates: Array<{
    animal_id: number;
    tag_number: string;
    animal_name: string | null;
    reason: string;
  }>;
}

export interface GroupTreatmentResult {
  batch_id: number;
  treatment_type: string;
  records_created: number;
  skipped_duplicates: number;
  total_quantity_used: number;
  remaining_stock: number;
  inventory_unit: string;
  product_name: string;
}

export function useGroupTreatmentProducts(params: {
  farm_id: string;
  treatment_type: "vaccination" | "medicine";
  enabled?: boolean;
}) {
  const enabled = (params.enabled ?? true) && Boolean(params.farm_id);
  const qs = new URLSearchParams({
    farm_id: params.farm_id,
    treatment_type: params.treatment_type,
  }).toString();

  return useQuery({
    queryKey: ["group-treatment-products", params.farm_id, params.treatment_type],
    queryFn: () =>
      api.get<GroupTreatmentProduct[]>(`/group-treatments/products?${qs}`),
    enabled,
  });
}

export function useGroupTreatmentPreview() {
  return useMutation({
    mutationFn: (data: GroupTreatmentInput) =>
      api.post<GroupTreatmentPreviewResult>("/group-treatments/preview", data),
  });
}

export function useExecuteGroupTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GroupTreatmentInput) =>
      api.post<GroupTreatmentResult>("/group-treatments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["group-treatment-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["health-incidents"] });
    },
  });
}
