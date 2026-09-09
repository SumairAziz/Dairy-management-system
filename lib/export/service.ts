import type { ExportResource } from "./types";
import { EXPORT_RESOURCE_CONFIG, isExportResource } from "./registry";
import { buildFilterMeta } from "./filter-labels";
import {
  exportAnimalQuerySchema,
  exportBreedingQuerySchema,
  exportHeatCycleQuerySchema,
  exportMilkQuerySchema,
  exportPregnancyQuerySchema,
  exportVaccinationQuerySchema,
} from "./query-schemas";
import * as animalService from "@/services/animal.service";
import * as milkService from "@/services/milk.service";
import * as breedingService from "@/services/breeding.service";
import * as pregnancyService from "@/services/pregnancy.service";
import * as vaccinationService from "@/services/vaccination.service";
import * as heatCycleService from "@/services/heat-cycle.service";

function normalizeExportParams(
  resource: ExportResource,
  params: Record<string, string>,
): Record<string, string> {
  const next = { ...params };

  if (resource === "pregnancy" && next.status === "all") {
    delete next.status;
  }

  if (resource === "vaccinations") {
    if (next.status === "all") delete next.status;
    if (next.status === "auto_generated") {
      delete next.status;
      next.source = "pregnancy_workflow";
    }
    if (next.vaccine_search) {
      next.vaccine_name = next.vaccine_search;
      delete next.vaccine_search;
    }
  }

  return next;
}

async function fetchResourceData(
  resource: ExportResource,
  params: Record<string, string>,
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const normalized = normalizeExportParams(resource, params);

  switch (resource) {
    case "animals": {
      const query = exportAnimalQuerySchema.parse(normalized);
      const result = (await animalService.findAll(query)) as {
        data: Record<string, unknown>[];
        total: number;
      };
      return { data: result.data, total: result.total };
    }
    case "milk": {
      const query = exportMilkQuerySchema.parse(normalized);
      const result = (await milkService.findAllForExport(query)) as {
        data: Record<string, unknown>[];
        total: number;
      };
      return { data: result.data, total: result.total };
    }
    case "breeding": {
      const query = exportBreedingQuerySchema.parse(normalized);
      const result = (await breedingService.findAll(query)) as {
        data: Record<string, unknown>[];
        total: number;
      };
      return { data: result.data, total: result.total };
    }
    case "pregnancy": {
      const query = exportPregnancyQuerySchema.parse(normalized);
      const result = (await pregnancyService.findAll(query)) as {
        data: Record<string, unknown>[];
        total: number;
      };
      return { data: result.data, total: result.total };
    }
    case "vaccinations": {
      const query = exportVaccinationQuerySchema.parse(normalized);
      const result = (await vaccinationService.findAll(query)) as {
        data: Record<string, unknown>[];
        total: number;
      };
      return { data: result.data, total: result.total };
    }
    case "heat-cycles": {
      const query = exportHeatCycleQuerySchema.parse(normalized);
      const result = (await heatCycleService.findAll(query)) as {
        data: Record<string, unknown>[];
        total: number;
      };
      return { data: result.data, total: result.total };
    }
    default:
      throw new Error(`Unsupported export resource: ${resource}`);
  }
}

export async function buildExportPayload(
  resource: string,
  rawParams: Record<string, string>,
) {
  if (!isExportResource(resource)) {
    throw new Error(`Unknown export resource: ${resource}`);
  }

  const config = EXPORT_RESOURCE_CONFIG[resource];
  const { data, total } = await fetchResourceData(resource, rawParams);

  const rows = data.map((row) => config.mapRow(row));
  const filtersApplied = buildFilterMeta(rawParams);

  return {
    rows,
    columns: config.columns,
    meta: {
      reportTitle: config.reportTitle,
      generatedAt: new Date().toISOString(),
      filtersApplied,
      totalRecords: total,
    },
    filenamePrefix: config.filenamePrefix,
    sheetName: config.sheetName,
  };
}

export { isExportResource, EXPORT_RESOURCE_CONFIG };
