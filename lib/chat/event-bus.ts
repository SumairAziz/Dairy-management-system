export type ChatEventType = "message" | "read" | "presence" | "typing";

export type ChatEvent = {
  type: ChatEventType;
  payload: Record<string, unknown>;
};

type Subscriber = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

const globalForChat = globalThis as unknown as {
  chatSubscribers?: Map<number, Set<Subscriber>>;
};

function getSubscribers() {
  if (!globalForChat.chatSubscribers) {
    globalForChat.chatSubscribers = new Map();
  }
  return globalForChat.chatSubscribers;
}

function encodeEvent(event: ChatEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function subscribeUser(userId: number, subscriber: Subscriber) {
  const map = getSubscribers();
  const set = map.get(userId) ?? new Set<Subscriber>();
  set.add(subscriber);
  map.set(userId, set);
}

export function unsubscribeUser(userId: number, subscriber: Subscriber) {
  const map = getSubscribers();
  const set = map.get(userId);
  if (!set) return;
  set.delete(subscriber);
  if (set.size === 0) map.delete(userId);
}

export function publishToUsers(userIds: number[], event: ChatEvent) {
  const map = getSubscribers();
  const payload = encodeEvent(event);
  const bytes = new TextEncoder().encode(payload);

  for (const userId of userIds) {
    const set = map.get(userId);
    if (!set) continue;
    for (const subscriber of set) {
      try {
        subscriber.controller.enqueue(bytes);
      } catch {
        // Stream closed — ignore.
      }
    }
  }
}

export function createHeartbeatPayload() {
  return new TextEncoder().encode(": keepalive\n\n");
}
