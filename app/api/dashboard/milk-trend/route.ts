import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { getMilkProductionTrend } from "@/services/dashboard.service";
import { milkTrendQuerySchema } from "@/validators/dashboard.validator";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("reports", "read");
    const parsed = milkTrendQuerySchema.parse({
      period: req.nextUrl.searchParams.get("period") ?? undefined,
    });
    const trend = await getMilkProductionTrend(parsed.period);
    return successResponse(trend);
  } catch (error) {
    return handleApiError(error);
  }
}
