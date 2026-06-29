import { NextRequest } from "next/server";
import * as animalService from "@/services/animal.service";
import { createAnimalSchema, animalQuerySchema } from "@/validators/animal.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("animals", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = animalQuerySchema.parse(params);
    const result = await animalService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("animals", "create");
    const body = await req.json();
    const parsed = createAnimalSchema.parse(body);
    const created = await animalService.create(parsed);
    await auditLog(user.id, "animals", (created as { animal_id: number }).animal_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}