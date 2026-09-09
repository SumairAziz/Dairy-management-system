import { NextRequest } from "next/server";
import * as groupTreatmentService from "@/services/group-treatment.service";
import { groupTreatmentSchema } from "@/validators/group-treatment.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requirePermission("vaccinations", "read");
    await requirePermission("inventory", "read");
    const body = await req.json();
    const parsed = groupTreatmentSchema.parse(body);
    const preview = await groupTreatmentService.previewGroupTreatment(parsed);
    return successResponse(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
