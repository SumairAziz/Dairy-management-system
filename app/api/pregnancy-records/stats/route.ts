import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as pregnancyService from "@/services/pregnancy.service";

export async function GET() {
  try {
    await requirePermission("pregnancy", "read");
    const stats = await pregnancyService.getStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
