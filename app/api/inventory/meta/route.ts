import * as inventoryService from "@/services/inventory.service";
import { handleApiError } from "@/lib/errors";
import { successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("inventory", "read");
    const [categories, suppliers] = await Promise.all([
      inventoryService.listCategories(),
      inventoryService.listSuppliers(),
    ]);
    return successResponse({ categories, suppliers });
  } catch (error) {
    return handleApiError(error);
  }
}
