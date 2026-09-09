import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as animalStatsService from "@/services/animal-stats.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("animals", "read");
    const stats = await animalStatsService.getAnimalStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
