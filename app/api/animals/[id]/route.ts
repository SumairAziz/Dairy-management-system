import { NextRequest } from "next/server";
import * as animalService from "@/services/animal.service";
import { updateAnimalSchema } from "@/validators/animal.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("animals", "read");
    const id = await resolveId(params);
    const animal = await animalService.findById(id);
    return successResponse(animal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("animals", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = updateAnimalSchema.parse(body);
    const old = await animalService.findById(id);
    const updated = await animalService.update(id, parsed);
    await auditLog(user.id, "animals", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("animals", "delete");
    const id = await resolveId(params);
    const old = await animalService.findById(id);
    await animalService.remove(id);
    await auditLog(user.id, "animals", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}