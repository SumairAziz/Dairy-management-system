import { NextRequest } from "next/server";
import * as milkService from "@/services/milk.service";
import { dailyMilkQuerySchema, upsertDailyMilkSchema, deleteDailyMilkQuerySchema } from "@/validators/milk-log.validator";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { paginatedResponse, successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("milk", "read");
    const sp = req.nextUrl.searchParams;
    const parsed = dailyMilkQuerySchema.parse(Object.fromEntries(sp.entries()));
    const result = await milkService.findAllDaily(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission("milk", "update");
    const body = await req.json();
    const parsed = upsertDailyMilkSchema.parse(body);
    const updated = await milkService.upsertDaily(parsed);
    await auditLog(user.id, "milk_logs", parsed.animal_id, "UPDATE", undefined, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission("milk", "delete");
    const sp = req.nextUrl.searchParams;
    const parsed = deleteDailyMilkQuerySchema.parse(Object.fromEntries(sp.entries()));
    const count = await milkService.removeDaily(parsed.animal_id, parsed.production_date);
    if (count === 0) throw new NotFoundError("Milk record");
    await auditLog(user.id, "milk_logs", parsed.animal_id, "DELETE", parsed as unknown as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}
