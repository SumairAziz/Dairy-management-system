import { NextRequest } from "next/server";
import * as heatCycleService from "@/services/heat-cycle.service";
import { updateHeatCycleSchema } from "@/validators/heat-cycle.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("heatCycles", "read");
    const id = await resolveId(params);
    const data = await heatCycleService.findById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("heatCycles", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateHeatCycleSchema.parse(body);
    const old = await heatCycleService.findById(id);
    const updated = await heatCycleService.update(id, parsed);
    await auditLog(user.id, "heat_cycle_records", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("heatCycles", "delete");
    const id = await resolveId(params);
    const old = await heatCycleService.findById(id);
    await heatCycleService.remove(id);
    await auditLog(user.id, "heat_cycle_records", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}