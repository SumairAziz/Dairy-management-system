import { NextRequest } from "next/server";
import * as speciesService from "@/services/species.service";
import { createSpeciesSchema } from "@/validators/species.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("species", "read");
    const sp = req.nextUrl.searchParams;
    const speciesId = sp.get("species_id");
    const data = await speciesService.findAll(speciesId ? Number(speciesId) : undefined);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("species", "create");
    const body = await req.json();
    const parsed = createSpeciesSchema.parse(body);
    const created = await speciesService.create(parsed);
    await auditLog(user.id, "species", (created as { species_id: number }).species_id, "CREATE", undefined, parsed);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}