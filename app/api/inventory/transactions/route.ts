import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/services/inventory.service";
import { transactionQuerySchema } from "@/validators/inventory.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("inventory", "read");
    const params = transactionQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );

    if (params.limit && !req.nextUrl.searchParams.has("page")) {
      const rows = await inventoryService.findRecentTransactions(params.limit);
      return successResponse(rows);
    }

    const result = await inventoryService.findTransactions(params);
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
