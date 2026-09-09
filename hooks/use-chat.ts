"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChatAttachmentDto,
  ChatMessageDto,
  ChatUser,
  ConversationListItem,
} from "@/services/chat.service";
import type { SendMessageInput } from "@/validators/chat.validator";

async function parseJson<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Request failed");
  }
  return json.data as T;
}

export function useChatConversations() {
  return useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => fetch("/api/chat/conversations").then((res) => parseJson<ConversationListItem[]>(res)),
  });
}

export function useChatUsers(search: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["chat", "users", search],
    queryFn: () => fetch(`/api/chat/users${qs}`).then((res) => parseJson<ChatUser[]>(res)),
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).then((res) => parseJson<{ conversation_id: number }>(res)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
  });
}

export function useChatMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ["chat", "messages", conversationId, "initial"],
    enabled: Boolean(conversationId),
    queryFn: () =>
      fetch(`/api/chat/conversations/${conversationId}/messages`).then((res) =>
        parseJson<{
          messages: ChatMessageDto[];
          has_more: boolean;
          oldest_message_id: number | null;
        }>(res),
      ),
  });
}

export function useLoadOlderMessages(conversationId: number | null) {
  return useMutation({
    mutationFn: ({ before, limit = 20 }: { before: number; limit?: number }) =>
      fetch(
        `/api/chat/conversations/${conversationId}/messages?before=${before}&limit=${limit}`,
      ).then((res) =>
        parseJson<{
          messages: ChatMessageDto[];
          has_more: boolean;
          oldest_message_id: number | null;
        }>(res),
      ),
  });
}

export function useSendChatMessage(conversationId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessageInput) =>
      fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => parseJson<ChatMessageDto>(res)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useMarkConversationRead(conversationId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetch(`/api/chat/conversations/${conversationId}/read`, { method: "POST" }).then((res) =>
        parseJson<{ updated: number }>(res),
      ),
    onSuccess: (data) => {
      if (data.updated > 0) {
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
      }
    },
  });
}

export function useUploadChatAttachment(conversationId: number | null) {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("conversation_id", String(conversationId));
      formData.append("file", file);
      return fetch("/api/chat/attachments", { method: "POST", body: formData }).then((res) =>
        parseJson<ChatAttachmentDto>(res),
      );
    },
  });
}

export function useChatRealtime(onEvent: (event: { type: string; payload: Record<string, unknown> }) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/chat/events");

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { type: string; payload: Record<string, unknown> };
        onEventRef.current(event);
      } catch {
        // Ignore malformed events.
      }
    };

    const heartbeat = setInterval(() => {
      void fetch("/api/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline: false }),
      });
    }, 30_000);

    const handleUnload = () => {
      navigator.sendBeacon(
        "/api/chat/presence",
        new Blob([JSON.stringify({ offline: true })], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      source.close();
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleUnload);
      void fetch("/api/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline: true }),
      });
    };
  }, []);
}

export function useAppendChatMessage() {
  const qc = useQueryClient();
  return useCallback(
    (conversationId: number, message: ChatMessageDto) => {
      qc.setQueryData(
        ["chat", "messages", conversationId, "initial"],
        (current: { messages: ChatMessageDto[]; has_more: boolean; oldest_message_id: number | null } | undefined) => {
          if (!current) return current;
          if (current.messages.some((entry) => entry.message_id === message.message_id)) return current;
          return { ...current, messages: [...current.messages, message] };
        },
      );
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    [qc],
  );
}
