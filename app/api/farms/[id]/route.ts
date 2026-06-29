import { NextRequest } from "next/server";
import * as farmService from "@/services/farm.service";
import { updateFarmSchema } from "@/validators/farm.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("farms", "read");
    const id = await resolveId(params);
    const result = await farmService.findById(id);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("farms", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateFarmSchema.parse(body);
    const old = await farmService.findById(id);
    const updated = await farmService.update(id, parsed);
    await auditLog(user.id, "farms", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("farms", "delete");
    const id = await resolveId(params);
    const old = await farmService.findById(id);
    await farmService.remove(id);
    await auditLog(user.id, "farms", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}