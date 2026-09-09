import type { ExportColumnDef, ExportResource } from "./types";

function animalLabel(
  row: {
    tag_number?: string | null;
    animal_name?: string | null;
  } | null | undefined,
): string {
  if (!row) return "—";
  return row.animal_name || row.tag_number || "—";
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export type ExportResourceConfig = {
  permissionModule: string;
  reportTitle: string;
  filenamePrefix: string;
  sheetName: string;
  columns: ExportColumnDef[];
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>;
};

export const EXPORT_RESOURCE_CONFIG: Record<ExportResource, ExportResourceConfig> = {
  animals: {
    permissionModule: "animals",
    reportTitle: "Animals",
    filenamePrefix: "animals_filtered",
    sheetName: "Animals",
    columns: [
      { key: "animal_id", header: "Animal ID", format: "integer" },
      { key: "tag_number", header: "Tag Number", format: "id" },
      { key: "animal_name", header: "Animal Name" },
      { key: "gender", header: "Gender" },
      { key: "date_of_birth", header: "Date of Birth", format: "date" },
      { key: "breed", header: "Breed" },
      { key: "farm", header: "Farm" },
      { key: "unit", header: "Unit" },
      { key: "lifecycle_stage", header: "Lifecycle Stage" },
      { key: "pregnancy_status", header: "Pregnancy Status" },
      { key: "lactation_status", header: "Lactation Status" },
      { key: "is_active", header: "Active Status" },
    ],
    mapRow: (row) => {
      const breeds = row.breeds as { breed_name?: string } | null | undefined;
      const farms = row.farms as { farm_name?: string } | null | undefined;
      const units = row.units as { unit_name?: string } | null | undefined;
      return {
        animal_id: row.animal_id,
        tag_number: row.tag_number ?? "",
        animal_name: row.animal_name ?? "",
        gender: row.gender ?? "",
        date_of_birth: dateOnly(row.date_of_birth as string | null),
        breed: breeds?.breed_name ?? "",
        farm: farms?.farm_name ?? "",
        unit: units?.unit_name ?? "",
        lifecycle_stage: row.lifecycle_stage ?? "",
        pregnancy_status: row.pregnancy_status ?? "",
        lactation_status: row.lactation_status ?? "",
        is_active: row.is_active ? "Active" : "Inactive",
      };
    },
  },
  milk: {
    permissionModule: "milk",
    reportTitle: "Milk Production",
    filenamePrefix: "milk_production",
    sheetName: "Milk Production",
    columns: [
      { key: "animal", header: "Animal" },
      { key: "tag_number", header: "Tag Number", format: "id" },
      { key: "production_date", header: "Production Date", format: "date" },
      { key: "session", header: "Session" },
      { key: "milk_liters", header: "Milk Liters (L)", format: "quantity" },
      { key: "quality_grade", header: "Quality Grade" },
      { key: "notes", header: "Notes", wrap: true },
    ],
    mapRow: (row) => {
      const animals = row.animals as {
        tag_number?: string;
        animal_name?: string | null;
      } | null;
      const liters = row.milk_liters;
      return {
        animal: animalLabel(animals ?? undefined),
        tag_number: animals?.tag_number ?? "",
        production_date: dateOnly(row.production_date as string | null),
        session: row.session ?? "",
        milk_liters:
          liters === null || liters === undefined ? null : Number(liters),
        quality_grade: row.quality_grade ?? "",
        notes: row.notes ?? "",
      };
    },
  },
  breeding: {
    permissionModule: "breeding",
    reportTitle: "Breeding Records",
    filenamePrefix: "breeding_records",
    sheetName: "Breeding",
    columns: [
      { key: "female_animal", header: "Female Animal" },
      { key: "male_animal", header: "Male Animal" },
      { key: "breeding_date", header: "Breeding Date", format: "date" },
      { key: "method", header: "Method" },
      { key: "result", header: "Result" },
      { key: "notes", header: "Notes", wrap: true },
    ],
    mapRow: (row) => {
      const female = row.animals_breeding_records_female_animal_idToanimals as {
        tag_number?: string;
        animal_name?: string | null;
      } | null;
      const male = row.animals_breeding_records_male_animal_idToanimals as {
        tag_number?: string;
        animal_name?: string | null;
      } | null;
      return {
        female_animal: animalLabel(female ?? undefined),
        male_animal: animalLabel(male ?? undefined),
        breeding_date: dateOnly(row.breeding_date as string | null),
        method: row.method ?? "",
        result: row.result ?? "Pending",
        notes: row.notes ?? "",
      };
    },
  },
  pregnancy: {
    permissionModule: "pregnancy",
    reportTitle: "Pregnancy Records",
    filenamePrefix: "pregnancy_records",
    sheetName: "Pregnancy",
    columns: [
      { key: "animal", header: "Animal" },
      { key: "insemination_date", header: "Insemination Date", format: "date" },
      { key: "pregnancy_confirmed", header: "Pregnancy Confirmed" },
      { key: "confirmation_date", header: "Confirmation Date", format: "date" },
      { key: "expected_delivery_date", header: "Expected Delivery Date", format: "date" },
      { key: "actual_delivery_date", header: "Actual Delivery Date", format: "date" },
      { key: "status", header: "Status" },
    ],
    mapRow: (row) => {
      const animals = row.animals as {
        tag_number?: string;
        animal_name?: string | null;
      } | null;
      return {
        animal: animalLabel(animals ?? undefined),
        insemination_date: dateOnly(row.insemination_date as string | null),
        pregnancy_confirmed: row.pregnancy_confirmed ? "Yes" : "No",
        confirmation_date: dateOnly(row.confirmation_date as string | null),
        expected_delivery_date: dateOnly(
          row.expected_delivery_date as string | null,
        ),
        actual_delivery_date: dateOnly(row.actual_delivery_date as string | null),
        status: row.status ?? "",
      };
    },
  },
  vaccinations: {
    permissionModule: "vaccinations",
    reportTitle: "Vaccination Records",
    filenamePrefix: "vaccination_records",
    sheetName: "Vaccinations",
    columns: [
      { key: "animal", header: "Animal" },
      { key: "vaccine_name", header: "Vaccine Name", wrap: true },
      { key: "vaccination_date", header: "Vaccination Date", format: "date" },
      { key: "next_due_date", header: "Next Due Date", format: "date" },
      { key: "administered_by", header: "Administered By", wrap: true },
      { key: "notes", header: "Notes", wrap: true },
    ],
    mapRow: (row) => {
      const animals = row.animals as {
        tag_number?: string;
        animal_name?: string | null;
      } | null;
      return {
        animal: animalLabel(animals ?? undefined),
        vaccine_name: row.vaccine_name ?? "",
        vaccination_date: dateOnly(row.vaccination_date as string | null),
        next_due_date: dateOnly(row.next_due_date as string | null),
        administered_by: row.administered_by ?? "",
        notes: row.notes ?? "",
      };
    },
  },
  "heat-cycles": {
    permissionModule: "heatCycles",
    reportTitle: "Heat Cycle Records",
    filenamePrefix: "heat_cycle_records",
    sheetName: "Heat Cycles",
    columns: [
      { key: "animal", header: "Animal" },
      { key: "heat_start_date", header: "Heat Start Date", format: "date" },
      { key: "heat_end_date", header: "Heat End Date", format: "date" },
      { key: "detection_method", header: "Detection Method" },
      { key: "confidence_score", header: "Confidence Score", format: "percent" },
      { key: "notes", header: "Notes", wrap: true },
    ],
    mapRow: (row) => {
      const animals = row.animals as {
        tag_number?: string;
        animal_name?: string | null;
      } | null;
      const score = row.confidence_score;
      return {
        animal: animalLabel(animals ?? undefined),
        heat_start_date: dateOnly(row.heat_start_date as string | null),
        heat_end_date: dateOnly(row.heat_end_date as string | null),
        detection_method: row.detection_method ?? "",
        confidence_score:
          score === null || score === undefined ? null : Number(score),
        notes: row.notes ?? "",
      };
    },
  },
};

export function isExportResource(value: string): value is ExportResource {
  return value in EXPORT_RESOURCE_CONFIG;
}
