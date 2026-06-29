import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import * as dashboardService from "@/services/dashboard.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("reports", "read");
    const data = await dashboardService.getDashboardData();
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}