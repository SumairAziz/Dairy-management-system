import { NextRequest } from "next/server";
import * as breedsService from "@/services/breeds.service";
import { createBreedSchema } from "@/validators/breeds.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("breeds", "read");
    const sp = req.nextUrl.searchParams;
    const speciesId = sp.get("species_id");
    const data = await breedsService.findAll(speciesId ? Number(speciesId) : undefined);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("breeds", "create");
    const body = await req.json();
    const parsed = createBreedSchema.parse(body);
    const created = await breedsService.create(parsed);
    await auditLog(user.id, "breeds", (created as { breed_id: number }).breed_id, "CREATE", undefined, parsed);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}