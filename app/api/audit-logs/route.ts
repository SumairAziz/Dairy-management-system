import { NextRequest } from "next/server";
import { z } from "zod";
import * as auditService from "@/services/audit.service";
import { requirePermission } from "@/lib/api-auth";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, successResponse } from "@/lib/api-response";

const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  entity: z.string().max(50).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  action: z.string().max(20).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission("reports", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = auditQuerySchema.parse(params);
    const result = await auditService.findAll(parsed);
    return paginatedResponse(result.data, result.total, result.page, result.pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}