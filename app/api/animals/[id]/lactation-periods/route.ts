import { NextRequest } from "next/server";
import * as lactationService from "@/services/lactation.service";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("animals", "read");
    const id = await resolveId(params);
    const periods = await lactationService.getPeriodHistory(id);
    return successResponse(periods);
  } catch (error) {
    return handleApiError(error);
  }
}
