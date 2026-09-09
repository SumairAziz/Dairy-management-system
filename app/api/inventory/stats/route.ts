import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as inventoryStatsService from "@/services/inventory-stats.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("inventory", "read");
    const stats = await inventoryStatsService.getInventoryStats();
    return successResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
