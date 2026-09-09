import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changePasswordSchema } from "@/validators/auth.validator";
import { changePassword } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";
import { UnauthorizedError, ValidationError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request data";
      throw new ValidationError(message);
    }

    try {
      await changePassword(
        session.user.id,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_CURRENT_PASSWORD") {
        throw new ValidationError("Current password is incorrect");
      }
      throw err;
    }

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
