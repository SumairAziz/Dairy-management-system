import { NextRequest } from "next/server";
import * as breedingService from "@/services/breeding.service";
import { updateBreedingRecordSchema } from "@/validators/breeding.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("breeding", "read");
    const id = await resolveId(params);
    const data = await breedingService.findById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("breeding", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateBreedingRecordSchema.parse(body);
    const old = await breedingService.findById(id);
    const updated = await breedingService.update(id, parsed);
    await auditLog(user.id, "breeding_records", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("breeding", "delete");
    const id = await resolveId(params);
    const old = await breedingService.findById(id);
    await breedingService.remove(id);
    await auditLog(user.id, "breeding_records", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}