import { NextRequest } from "next/server";
import * as lactationService from "@/services/lactation.service";
import { productionStatusActionSchema } from "@/validators/lactation.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("animals", "read");
    const id = await resolveId(params);
    const summary = await lactationService.getProductionSummary(id);
    return successResponse(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("animals", "update");
    const id = await resolveId(params);
    const body = await req.json();
    const parsed = productionStatusActionSchema.parse(body);
    const result = await lactationService.applyProductionStatusAction(id, parsed);
    await auditLog(user.id, "animals", id, "UPDATE", null, {
      production_action: parsed.action,
      start_date: parsed.start_date ?? null,
    });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
