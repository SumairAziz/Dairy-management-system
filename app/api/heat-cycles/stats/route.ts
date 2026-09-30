import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as heatCycleService from "@/services/heat-cycle.service";

export async function GET() {
  try {
    await requirePermission("heat_cycles", "read");
    const stats = await heatCycleService.getStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
