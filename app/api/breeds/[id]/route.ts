import { NextRequest } from "next/server";
import * as breedsService from "@/services/breeds.service";
import { updateBreedSchema } from "@/validators/breeds.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("breeds", "read");
    const id = await resolveId(params);
    const data = await breedsService.findById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("breeds", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateBreedSchema.parse(body);
    const old = await breedsService.findById(id);
    const updated = await breedsService.update(id, parsed);
    await auditLog(user.id, "breeds", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("breeds", "delete");
    const id = await resolveId(params);
    const old = await breedsService.findById(id);
    await breedsService.remove(id);
    await auditLog(user.id, "breeds", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}