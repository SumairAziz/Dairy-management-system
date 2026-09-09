import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleApiError, AppError } from "@/lib/errors";
import { runAssistant } from "@/lib/ai/orchestrator";
import { toAssistantError } from "@/lib/ai/assistant-errors";
import { AI_LIMITS } from "@/lib/ai/security";

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(AI_LIMITS.MAX_USER_MESSAGE_LENGTH * 2),
      }),
    )
    .min(1)
    .max(AI_LIMITS.MAX_HISTORY_MESSAGES),
});

/**
 * POST /api/assistant/chat — the single entry point into the AI Farm
 * Assistant. Requires an authenticated session (any role may use it; it's
 * strictly read-only regardless of the caller's write permissions). The
 * client sends the full transcript so far; the server has no per-user
 * conversation state, keeping this route trivially horizontally scalable.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("assistant", "read");
    const body = await request.json();
    const parsed = chatRequestSchema.parse(body);

    const lastMessage = parsed.messages[parsed.messages.length - 1];
    if (lastMessage.role !== "user") {
      return errorResponse("VALIDATION_ERROR", "The last message must be from the user.", 400);
    }

    const result = await runAssistant({
      history: parsed.messages,
      ctx: { userId: user.id, role: user.role },
    });

    return successResponse({
      message: result.message,
      toolsUsed: result.toolsUsed,
      sourceRoute: result.sourceRoute,
    });
  } catch (error) {
    if (
      error instanceof AppError ||
      error instanceof ZodError ||
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      return handleApiError(error);
    }
    return handleApiError(toAssistantError(error));
  }
}