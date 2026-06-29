import { NextRequest } from "next/server";
import * as healthService from "@/services/health.service";
import { createHealthIncidentSchema } from "@/validators/health-incidents.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, createdResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("health", "read");
    const animalId = await resolveId(params);
    const data = await healthService.findByAnimal(animalId);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("health", "create");
    const animalId = await resolveId(params);
    const body = await req.json();
    const parsed = createHealthIncidentSchema.parse(body);
    const created = await healthService.create(animalId, parsed);
    await auditLog(user.id, "health_incidents", (created as { incident_id: number }).incident_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}