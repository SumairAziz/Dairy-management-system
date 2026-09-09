import { NextRequest } from "next/server";
import * as inventoryService from "@/services/inventory.service";
import {
  createInventoryItemSchema,
  inventoryQuerySchema,
} from "@/validators/inventory.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("inventory", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = inventoryQuerySchema.parse(params);
    const result = await inventoryService.findAll(parsed);
    const { data, total, page, pageSize } = result as {
      data: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("inventory", "create");
    const body = await req.json();
    const parsed = createInventoryItemSchema.parse(body);
    const created = await inventoryService.create(parsed);
    await auditLog(
      user.id,
      "inventory_items",
      (created as unknown as { item_id: number }).item_id,
      "CREATE",
      undefined,
      parsed as unknown as Record<string, unknown>,
    );
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}
