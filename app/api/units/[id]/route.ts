import { NextRequest } from "next/server";
import * as unitsService from "@/services/units.service";
import { updateUnitSchema } from "@/validators/units.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("units", "read");
    const id = await resolveId(params);
    const data = await unitsService.findById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("units", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateUnitSchema.parse(body);
    const old = await unitsService.findById(id);
    const updated = await unitsService.update(id, parsed);
    await auditLog(user.id, "units", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("units", "delete");
    const id = await resolveId(params);
    const old = await unitsService.findById(id);
    await unitsService.remove(id);
    await auditLog(user.id, "units", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}