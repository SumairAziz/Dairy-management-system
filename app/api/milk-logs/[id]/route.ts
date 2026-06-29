import { NextRequest } from "next/server";
import * as milkService from "@/services/milk.service";
import { handleApiError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("milk", "read");
    const id = await resolveId(params);
    const record = await milkService.findById(id);
    return successResponse(record);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("milk", "delete");
    const id = await resolveId(params);
    const old = await milkService.findById(id);
    await milkService.remove(id);
    await auditLog(user.id, "milk_logs", id, "DELETE", old as Record<string, unknown>);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}