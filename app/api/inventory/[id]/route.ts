import { NextRequest } from "next/server";
import * as inventoryService from "@/services/inventory.service";
import {
  inventoryIdParamSchema,
  stockAdjustmentSchema,
  stockInSchema,
  stockMovementSchema,
  updateInventoryItemSchema,
} from "@/validators/inventory.validator";
import { handleApiError, ValidationError } from "@/lib/errors";
import { successResponse, noContentResponse } from "@/lib/api-response";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePermission("inventory", "read");
    const id = await resolveId(ctx.params);
    inventoryIdParamSchema.parse({ id: String(id) });
    const item = await inventoryService.findById(id);
    return successResponse(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission("inventory", "update");
    const id = await resolveId(ctx.params);
    const body = await req.json();
    const parsed = updateInventoryItemSchema.parse(body);
    const updated = await inventoryService.update(id, parsed);
    await auditLog(user.id, "inventory_items", id, "UPDATE", undefined, parsed as unknown as Record<string, unknown>);
    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission("inventory", "delete");
    const id = await resolveId(ctx.params);
    await inventoryService.remove(id);
    await auditLog(user.id, "inventory_items", id, "DELETE");
    return noContentResponse();
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const id = await resolveId(ctx.params);
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === "stock_in" || action === "stock_out" || action === "usage") {
      const user = await requirePermission(
        "inventory",
        action === "stock_in" ? "stock_in" : "stock_out",
      );
      const parsed =
        action === "stock_in"
          ? stockInSchema.parse(body)
          : stockMovementSchema.parse(body);
      const updated =
        action === "stock_in"
          ? await inventoryService.recordStockIn(id, parsed, user.id)
          : await inventoryService.recordStockOut(
              id,
              parsed,
              user.id,
              action === "usage",
            );
      await auditLog(user.id, "inventory_items", id, "UPDATE", undefined, {
        action,
        ...parsed,
      });
      return successResponse(updated);
    }

    if (
      action === "adjustment" ||
      action === "damaged" ||
      action === "expired" ||
      action === "lost" ||
      action === "return" ||
      action === "physical_count"
    ) {
      const user = await requirePermission("inventory", "stock_out");
      const parsed = stockAdjustmentSchema.parse(body);
      const updated = await inventoryService.recordAdjustment(id, parsed, user.id);
      await auditLog(user.id, "inventory_items", id, "UPDATE", undefined, parsed as unknown as Record<string, unknown>);
      return successResponse(updated);
    }

    if (action === "archive") {
      const user = await requirePermission("inventory", "update");
      const updated = await inventoryService.archive(id);
      await auditLog(user.id, "inventory_items", id, "UPDATE", undefined, { action: "archive" });
      return successResponse(updated);
    }

    void action;
    throw new ValidationError("Unsupported inventory action.");
  } catch (error) {
    return handleApiError(error);
  }
}
