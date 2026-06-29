import { NextRequest } from "next/server";
import * as vaccService from "@/services/vaccination.service";
import { updateVaccinationSchema } from "@/validators/vaccination.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("vaccinations", "read");
    const id = await resolveId(params);
    const record = await vaccService.findById(id);
    return successResponse(record);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("vaccinations", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateVaccinationSchema.parse(body);
    const old = await vaccService.findById(id);
    const updated = await vaccService.update(id, parsed);
    await auditLog(user.id, "vaccination_records", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("vaccinations", "delete");
    const id = await resolveId(params);
    const old = await vaccService.findById(id);
    await vaccService.remove(id);
    await auditLog(user.id, "vaccination_records", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}