import type { ExportFilterMeta } from "./types";

const LABELS: Record<string, string> = {
  tag_number: "Tag #",
  search: "Search",
  animal_search: "Animal Search",
  vaccine_search: "Vaccine Search",
  farm_id: "Farm",
  unit_id: "Unit",
  breed_id: "Breed",
  species_id: "Species",
  gender: "Gender",
  lifecycle_stage: "Lifecycle",
  production_status: "Production Status",
  is_active: "Active Status",
  pregnancy_status: "Pregnancy Status",
  in_heat: "In Heat",
  vaccination_due: "Vaccination Due",
  breeding_eligible: "Breeding Eligible",
  has_health_issue: "Health Issue",
  stage_bucket: "Stage Bucket",
  animal_id: "Animal",
  female_animal_id: "Female Animal",
  male_animal_id: "Male Animal",
  method: "Method",
  result: "Result",
  status: "Status",
  confirmed: "Confirmed",
  date_from: "Date From",
  date_to: "Date To",
  session: "Session",
  detection_method: "Detection Method",
  source: "Source",
  sortBy: "Sort By",
  sortDir: "Sort Direction",
};

export function buildFilterMeta(
  filters: Record<string, string>,
  labelOverrides?: Record<string, string>,
): ExportFilterMeta[] {
  const entries: ExportFilterMeta[] = [];

  for (const [key, raw] of Object.entries(filters)) {
    if (!raw || raw === "all") continue;
    const label = labelOverrides?.[key] ?? LABELS[key] ?? key;
    entries.push({ label, value: raw });
  }

  return entries;
}
