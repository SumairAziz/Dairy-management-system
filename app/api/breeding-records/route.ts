import { NextRequest } from "next/server";
import * as breedingService from "@/services/breeding.service";
import { createBreedingRecordSchema, breedingQuerySchema } from "@/validators/breeding.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("breeding", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = breedingQuerySchema.parse(params);
    const result = await breedingService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("breeding", "create");
    const body = await req.json();
    const parsed = createBreedingRecordSchema.parse(body);
    const created = await breedingService.create(parsed);
    await auditLog(user.id, "breeding_records", (created as { breeding_id: number }).breeding_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}