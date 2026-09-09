import { NextRequest } from "next/server";
import * as groupTreatmentService from "@/services/group-treatment.service";
import { groupTreatmentProductsQuerySchema } from "@/validators/group-treatment.validator";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("vaccinations", "read");
    await requirePermission("inventory", "read");
    const parsed = groupTreatmentProductsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const products = await groupTreatmentService.listTreatmentProducts(parsed);
    return successResponse(products);
  } catch (error) {
    return handleApiError(error);
  }
}
