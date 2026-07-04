import { NextRequest } from "next/server";
import * as calvingService from "@/services/calving.service";
import { updateCalvingSchema, calvingIdParamSchema } from "@/validators/calving.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("calving", "read");
    const { id } = calvingIdParamSchema.parse(await params);
    const record = await calvingService.findById(id);
    return successResponse(record);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("calving", "update");
    const { id } = calvingIdParamSchema.parse(await params);
    const body = await req.json();
    const parsed = updateCalvingSchema.parse(body);
    const old = await calvingService.findById(id);
    const updated = await calvingService.update(id, parsed);
    await auditLog(user.id, "calving_records", id, "UPDATE", old as Record<string, unknown>, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("calving", "delete");
    const { id } = calvingIdParamSchema.parse(await params);
    await calvingService.remove(id);
    await auditLog(user.id, "calving_records", id, "DELETE");
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
