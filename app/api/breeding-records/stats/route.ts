import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as breedingService from "@/services/breeding.service";

export async function GET() {
  try {
    await requirePermission("breeding", "read");
    const stats = await breedingService.getStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
