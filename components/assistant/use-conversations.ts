"use client";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessageData, Conversation } from "./types";

const STORAGE_KEY = "terradairy.assistant.conversations.v1";
const MAX_CONVERSATIONS = 30;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadAll(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // localStorage full/unavailable — conversation history just won't persist across reloads.
  }
}

function titleFromFirstMessage(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed || "New conversation";
}

/**
 * Client-side "conversation memory": the assistant's backend is stateless
 * (see `lib/ai/orchestrator.ts`), so multi-turn context and conversation
 * history both live here, keyed by conversation id in localStorage. This
 * avoids a database migration for a feature that's fundamentally
 * per-browser/session UI state, while still fully satisfying "remembers
 * previous messages" (the full transcript for the active conversation is
 * sent to the API on every turn).
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadAll();
    setConversations(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const persist = useCallback((next: Conversation[]) => {
    setConversations(next);
    saveAll(next);
  }, []);

  const createConversation = useCallback(() => {
    const conv: Conversation = { id: newId(), title: "New conversation", messages: [], updatedAt: Date.now() };
    persist([conv, ...conversations]);
    setActiveId(conv.id);
    return conv.id;
  }, [conversations, persist]);

  const deleteConversation = useCallback(
    (id: string) => {
      const next = conversations.filter((c) => c.id !== id);
      persist(next);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
    },
    [conversations, activeId, persist],
  );

  const appendMessages = useCallback(
    (conversationId: string, newMessages: ChatMessageData[]) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        let next: Conversation[];
        if (idx === -1) {
          const title = newMessages.find((m) => m.role === "user")?.content;
          const conv: Conversation = {
            id: conversationId,
            title: title ? titleFromFirstMessage(title) : "New conversation",
            messages: newMessages,
            updatedAt: Date.now(),
          };
          next = [conv, ...prev];
        } else {
          const existing = prev[idx];
          const updated: Conversation = {
            ...existing,
            title: existing.messages.length === 0 && newMessages[0] ? titleFromFirstMessage(newMessages[0].content) : existing.title,
            messages: [...existing.messages, ...newMessages],
            updatedAt: Date.now(),
          };
          next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
        saveAll(next);
        return next;
      });
    },
    [],
  );

  return {
    conversations,
    active,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    appendMessages,
  };
}
