import { NextRequest } from "next/server";
import * as farmService from "@/services/farm.service";
import { createFarmSchema } from "@/validators/farm.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET() {
  try {
    await requirePermission("farms", "read");
    const farms = await farmService.findAll();
    return successResponse(farms);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("farms", "create");
    const body = await req.json();
    const parsed = createFarmSchema.parse(body);
    const created = await farmService.create(parsed);
    await auditLog(user.id, "farms", (created as { farm_id: number }).farm_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}