import { NextRequest } from "next/server";
import * as vaccService from "@/services/vaccination.service";
import { createVaccinationSchema, vaccinationQuerySchema } from "@/validators/vaccination.validator";
import { handleApiError } from "@/lib/errors";
import { paginatedResponse, createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { log as auditLog } from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("vaccinations", "read");
    const sp = req.nextUrl.searchParams;
    const params = Object.fromEntries(sp.entries());
    const parsed = vaccinationQuerySchema.parse(params);
    const result = await vaccService.findAll(parsed);
    const { data, total, page, pageSize } = result as { data: unknown[]; total: number; page: number; pageSize: number };
    return paginatedResponse(data, total, page, pageSize);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("vaccinations", "create");
    const body = await req.json();
    const parsed = createVaccinationSchema.parse(body);
    const created = await vaccService.create(parsed);
    await auditLog(user.id, "vaccination_records", (created as { vaccination_id: number }).vaccination_id, "CREATE", undefined, parsed as unknown as Record<string, unknown>);
    return createdResponse(created);
  } catch (error) {
    return handleApiError(error);
  }
}