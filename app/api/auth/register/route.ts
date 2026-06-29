import { NextRequest } from "next/server";
import { registerSchema } from "@/validators/auth.validator";
import { register } from "@/services/auth.service";
import { createdResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/errors";
import { ConflictError } from "@/lib/errors";
import { log as auditLog } from "@/services/audit.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return errorResponse("VALIDATION_ERROR", "Invalid request data", 400);
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