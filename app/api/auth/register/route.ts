import { NextRequest } from "next/server";
import { registerSchema } from "@/validators/auth.validator";
import { register } from "@/services/auth.service";
import { createdResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/errors";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { log as auditLog } from "@/services/audit.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse({
      ...body,
      role: "FARM_WORKER",
    });

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request data", 400);
    }

    if (body?.role && body.role !== "FARM_WORKER") {
      throw new ForbiddenError("Public registration is limited to farm worker accounts.");
    }

    try {
      const user = await register(parsed.data);
      await auditLog(user.id, "users", user.id, "CREATE", undefined, {
        email: user.email,
        name: user.name,
        role: user.role,
      });
      return createdResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Email already registered") {
        throw new ConflictError("A user with this email already exists");
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}