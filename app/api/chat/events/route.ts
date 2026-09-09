import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/errors";
import {
  createHeartbeatPayload,
  subscribeUser,
  unsubscribeUser,
} from "@/lib/chat/event-bus";
import { touchPresence } from "@/services/chat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    await touchPresence(user.id);

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let activeSubscriber: { controller: ReadableStreamDefaultController<Uint8Array>; encoder: TextEncoder } | null =
      null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        activeSubscriber = { controller, encoder: new TextEncoder() };
        subscribeUser(user.id, activeSubscriber);
        controller.enqueue(createHeartbeatPayload());

        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(createHeartbeatPayload());
            void touchPresence(user.id);
          } catch {
            closed = true;
          }
        }, 25_000);
      },
      cancel() {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (activeSubscriber) unsubscribeUser(user.id, activeSubscriber);
        void markOfflineSafe(user.id);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function markOfflineSafe(userId: number) {
  try {
    const { markOffline } = await import("@/services/chat.service");
    await markOffline(userId);
  } catch {
    // Ignore disconnect errors.
  }
}
