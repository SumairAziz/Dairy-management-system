import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as vaccService from "@/services/vaccination.service";

export async function GET() {
  try {
    await requirePermission("vaccinations", "read");
    const stats = await vaccService.getStatusCounts();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
