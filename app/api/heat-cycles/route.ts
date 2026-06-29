import { NextRequest } from "next/server";
import * as heatCycleService from "@/services/heat-cycle.service";
import { createHeatCycleSchema, heatCycleQuerySchema } from "@/validators/heat-cycle.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("heatCycles", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = heatCycleQuerySchema.parse(params);
    const result = await heatCycleService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("heatCycles", "create");
    const body = await req.json();
    const parsed = createHeatCycleSchema.parse(body);
    const created = await heatCycleService.create(parsed);
    await auditLog(user.id, "heat_cycle_records", (created as { heat_cycle_id: number }).heat_cycle_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}