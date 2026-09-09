import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requirePermission } from "@/lib/api-auth";
import {
  buildExportPayload,
  EXPORT_RESOURCE_CONFIG,
  isExportResource,
} from "@/lib/export/service";

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { resource } = await ctx.params;
    if (!isExportResource(resource)) {
      return Response.json({ error: "Unknown export resource" }, { status: 404 });
    }

    const config = EXPORT_RESOURCE_CONFIG[resource];
    await requirePermission(config.permissionModule, "read");

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const payload = await buildExportPayload(resource, params);

    if (payload.rows.length === 0) {
      return Response.json(
        { error: "No records match the current filters.", code: "EMPTY_EXPORT" },
        { status: 404 },
      );
    }

    return Response.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
