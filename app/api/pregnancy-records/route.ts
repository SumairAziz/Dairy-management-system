import { NextRequest } from "next/server";
import * as pregnancyService from "@/services/pregnancy.service";
import { createPregnancyRecordSchema, pregnancyQuerySchema } from "@/validators/pregnancy.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("pregnancy", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = pregnancyQuerySchema.parse(params);
    const result = await pregnancyService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("pregnancy", "create");
    const body = await req.json();
    const parsed = createPregnancyRecordSchema.parse(body);
    const created = await pregnancyService.create(parsed);
    await auditLog(user.id, "pregnancy_records", (created as { pregnancy_id: number }).pregnancy_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}