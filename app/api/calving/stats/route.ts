import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as calvingService from "@/services/calving.service";

export async function GET() {
  try {
    await requirePermission("calving", "read");
    const stats = await calvingService.getStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
