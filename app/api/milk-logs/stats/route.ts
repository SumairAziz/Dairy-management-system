import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as milkService from "@/services/milk.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("milk", "read");
    const stats = await milkService.getStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}