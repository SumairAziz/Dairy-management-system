import { NextRequest } from "next/server";
import * as groupTreatmentService from "@/services/group-treatment.service";
import { groupTreatmentSchema } from "@/validators/group-treatment.validator";
import { handleApiError } from "@/lib/errors";
import { createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = groupTreatmentSchema.parse(body);

    const user =
      parsed.treatment_type === "vaccination"
        ? await requirePermission("vaccinations", "create")
        : await requirePermission("health", "create");
    await requirePermission("inventory", "update");

    const result = await groupTreatmentService.executeGroupTreatment(parsed);

    await auditLog(
      user.id,
      "group_treatment_batches",
      (result as { batch_id: number }).batch_id,
      "CREATE",
      undefined,
      parsed as unknown as Record<string, unknown>,
    );

    return createdResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
