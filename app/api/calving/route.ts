import { NextRequest } from "next/server";
import * as calvingService from "@/services/calving.service";
import { createCalvingSchema, calvingQuerySchema } from "@/validators/calving.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("calving", "read");
    const sp = req.nextUrl.searchParams;
    const parsed = calvingQuerySchema.parse(Object.fromEntries(sp.entries()));
    const result = await calvingService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("calving", "create");
    const body = await req.json();
    const parsed = createCalvingSchema.parse(body);
    const created = await calvingService.create(parsed);
    await auditLog(user.id, "calving_records", (created as { calving_id: number }).calving_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}
