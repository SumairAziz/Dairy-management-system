import { NextRequest } from "next/server";
import * as milkService from "@/services/milk.service";
import { createMilkLogSchema, milkLogQuerySchema } from "@/validators/milk-log.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("milk", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = milkLogQuerySchema.parse(params);
    const result = await milkService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("milk", "create");
    const body = await req.json();
    const parsed = createMilkLogSchema.parse(body);
    const created = await milkService.create(parsed);
    await auditLog(user.id, "milk_logs", (created as { milk_log_id: number }).milk_log_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}