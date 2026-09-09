import type { AiTool, AiToolSpec } from "../types";

/**
 * Central catalog of every tool the assistant may call. Domain tool files
 * (`animals.tools.ts`, `milk.tools.ts`, ...) each export an array of
 * `AiTool` objects; this module just aggregates + indexes them by name.
 *
 * Adding a brand-new module later (Inventory, Finance, IoT Sensors, ...) is
 * exactly: write `lib/ai/tools/<module>.tools.ts` exporting `AiTool[]`, then
 * add one line to `ALL_TOOL_GROUPS` below. Nothing else in the assistant
 * (provider, orchestrator, UI) needs to change.
 */
import { animalTools } from "./animals.tools";
import { farmTools } from "./farms.tools";
import { milkTools } from "./milk.tools";
import { vaccinationTools } from "./vaccinations.tools";
import { breedingTools } from "./breeding.tools";
import { reproductionTools } from "./reproduction.tools";
import { healthTools } from "./health.tools";
import { dashboardTools } from "./dashboard.tools";
import { reportTools } from "./reports.tools";
import { inventoryTools } from "./inventory.tools";

const ALL_TOOL_GROUPS: AiTool<any, any>[][] = [
  animalTools,
  farmTools,
  milkTools,
  vaccinationTools,
  breedingTools,
  reproductionTools,
  healthTools,
  dashboardTools,
  inventoryTools,
  reportTools,
];

export const TOOL_REGISTRY: Map<string, AiTool<any, any>> = new Map(
  ALL_TOOL_GROUPS.flat().map((tool) => [tool.name, tool]),
);

export function getAllTools(): AiTool<any, any>[] {
  return [...TOOL_REGISTRY.values()];
}

export function getToolSpecs(): AiToolSpec[] {
  return getAllTools().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function getTool(name: string): AiTool<any, any> | undefined {
  return TOOL_REGISTRY.get(name);
}
