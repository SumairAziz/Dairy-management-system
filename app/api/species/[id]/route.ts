import { NextRequest } from "next/server";
import * as speciesService from "@/services/species.service";
import { updateSpeciesSchema } from "@/validators/species.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("species", "read");
    const id = await resolveId(params);
    const data = await speciesService.findById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("species", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateSpeciesSchema.parse(body);
    const old = await speciesService.findById(id);
    const updated = await speciesService.update(id, parsed);
    await auditLog(user.id, "species", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("species", "delete");
    const id = await resolveId(params);
    const old = await speciesService.findById(id);
    await speciesService.remove(id);
    await auditLog(user.id, "species", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}