import { NextRequest } from "next/server";
import * as growthService from "@/services/growth.service";
import { createGrowthLogSchema } from "@/validators/growth-logs.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, createdResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("animals", "read");
    const animalId = await resolveId(params);
    const data = await growthService.findByAnimal(animalId);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("animals", "read");
    const animalId = await resolveId(params);
    const body = await req.json();
    const parsed = createGrowthLogSchema.parse(body);
    const created = await growthService.create(animalId, parsed);
    await auditLog(user.id, "growth_logs", (created as { growth_log_id: number }).growth_log_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}