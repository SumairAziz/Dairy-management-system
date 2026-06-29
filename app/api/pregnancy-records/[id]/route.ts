import { NextRequest } from "next/server";
import * as pregnancyService from "@/services/pregnancy.service";
import { updatePregnancyRecordSchema } from "@/validators/pregnancy.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("pregnancy", "read");
    const id = await resolveId(params);
    const data = await pregnancyService.findById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("pregnancy", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updatePregnancyRecordSchema.parse(body);
    const old = await pregnancyService.findById(id);
    const updated = await pregnancyService.update(id, parsed);
    await auditLog(user.id, "pregnancy_records", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("pregnancy", "delete");
    const id = await resolveId(params);
    const old = await pregnancyService.findById(id);
    await pregnancyService.remove(id);
    await auditLog(user.id, "pregnancy_records", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}