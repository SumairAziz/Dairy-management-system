import { NextRequest } from "next/server";
import * as unitsService from "@/services/units.service";
import { createUnitSchema } from "@/validators/units.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("units", "read");
    const sp = req.nextUrl.searchParams;
    const farmId = sp.get("farm_id");
    const data = await unitsService.findAll(farmId ? Number(farmId) : undefined);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("units", "create");
    const body = await req.json();
    const parsed = createUnitSchema.parse(body);
    const created = await unitsService.create(parsed);
    await auditLog(user.id, "units", (created as { unit_id: number }).unit_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}