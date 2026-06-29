import { NextRequest } from "next/server";
import * as healthService from "@/services/health.service";
import { updateHealthIncidentSchema } from "@/validators/health-incidents.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string; incidentId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("health", "update");
    const { incidentId } = await params;
    const incidentNum = Number(incidentId);
    if (!incidentNum || !Number.isFinite(incidentNum)) {
      throw new Error("Invalid incidentId");
    }
    const body = await req.json();
    const parsed = updateHealthIncidentSchema.parse(body);
    const old = await healthService.findById(incidentNum);
    const updated = await healthService.update(incidentNum, parsed);
    await auditLog(user.id, "health_incidents", incidentNum, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("health", "delete");
    const { incidentId } = await params;
    const incidentNum = Number(incidentId);
    if (!incidentNum || !Number.isFinite(incidentNum)) {
      throw new Error("Invalid incidentId");
    }
    const old = await healthService.findById(incidentNum);
    await healthService.remove(incidentNum);
    await auditLog(user.id, "health_incidents", incidentNum, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}