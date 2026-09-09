"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  Loader2,
  MessageCircle,
  Paperclip,
  Search,
  Send,
} from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import {
  formatConversationTime,
  formatLastSeen,
  formatMessageDateDivider,
  formatMessageTime,
  formatRoleLabel,
  getInitials,
  messageDateKey,
  previewMessage,
} from "@/lib/chat/format";
import {
  useAppendChatMessage,
  useChatConversations,
  useChatMessages,
  useChatRealtime,
  useChatUsers,
  useLoadOlderMessages,
  useMarkConversationRead,
  useSendChatMessage,
  useStartConversation,
  useUploadChatAttachment,
} from "@/hooks/use-chat";
import type { ChatAttachmentDto, ChatMessageDto, ConversationListItem } from "@/services/chat.service";
import { ChatMediaAttachment } from "@/components/chat/ChatMediaAttachment";
import { MediaViewer, type MediaViewerItem } from "@/components/chat/MediaViewer";

function Avatar({ name, online }: { name: string; online?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div className="h-10 w-10 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 flex items-center justify-center text-sm font-semibold">
        {getInitials(name)}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
            online ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`}
        />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onOpenMedia,
}: {
  message: ChatMessageDto;
  onOpenMedia: (item: MediaViewerItem) => void;
}) {
  const mine = message.is_mine;

  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,520px)] rounded-2xl px-3.5 py-2.5 shadow-sm ${
          mine
            ? "bg-brand-600 text-white rounded-br-md"
            : "surface border rounded-bl-md"
        }`}
      >
        {!mine && (
          <p className="text-xs font-semibold mb-1 text-brand-700 dark:text-brand-300">
            {message.sender_name}
          </p>
        )}
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
            {message.body}
          </p>
        )}
        {message.attachments.map((attachment) => (
          <ChatMediaAttachment
            key={attachment.attachment_id}
            attachment={attachment}
            mine={mine}
            onOpen={onOpenMedia}
          />
        ))}
        <div
          className={`mt-1.5 flex items-center gap-1 text-[11px] ${
            mine ? "text-white/75 justify-end" : "muted justify-end"
          }`}
        >
          <span>{formatMessageTime(message.created_at)}</span>
          {mine &&
            (message.read_by_other ? (
              <CheckCheck size={13} className="text-sky-200" aria-label="Read" />
            ) : (
              <Check size={13} aria-label="Sent" />
            ))}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachmentDto[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerItem | null>(null);
  const [presenceMap, setPresenceMap] = useState<
    Record<number, { is_online: boolean; last_seen_at: string | null }>
  >({});

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);

  const { data: conversations = [], isLoading: conversationsLoading } = useChatConversations();
  const { data: users = [] } = useChatUsers(sidebarSearch);
  const { data: messageData, isLoading: messagesLoading } = useChatMessages(selectedConversationId);
  const loadOlder = useLoadOlderMessages(selectedConversationId);
  const sendMessage = useSendChatMessage(selectedConversationId);
  const markRead = useMarkConversationRead(selectedConversationId);
  const markReadAsyncRef = useRef(markRead.mutateAsync);
  markReadAsyncRef.current = markRead.mutateAsync;
  const lastMarkedConversationRef = useRef<number | null>(null);
  const startConversation = useStartConversation();
  const uploadAttachment = useUploadChatAttachment(selectedConversationId);
  const appendMessage = useAppendChatMessage();
  const queryClient = useQueryClient();

  const selectedConversation = useMemo(
    () => conversations.find((entry) => entry.conversation_id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const mergedUsers = useMemo(() => {
    const map = new Map<number, ConversationListItem["other_user"] | (typeof users)[number]>();
    for (const conversation of conversations) map.set(conversation.other_user.user_id, conversation.other_user);
    for (const user of users) map.set(user.user_id, user);
    return [...map.values()].filter((user) =>
      sidebarSearch
        ? user.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
          user.email.toLowerCase().includes(sidebarSearch.toLowerCase())
        : true,
    );
  }, [conversations, users, sidebarSearch]);

  useChatRealtime(
    useCallback(
      (event) => {
        if (event.type === "message") {
          const payload = event.payload as { conversation_id: number; message: ChatMessageDto };
          appendMessage(payload.conversation_id, payload.message);
          if (payload.conversation_id === selectedConversationId) {
            shouldStickToBottomRef.current = true;
            void markReadAsyncRef.current().catch(() => undefined);
          }
        }
        if (event.type === "presence") {
          const payload = event.payload as {
            user_id: number;
            is_online: boolean;
            last_seen_at: string | null;
          };
          setPresenceMap((current) => ({
            ...current,
            [payload.user_id]: {
              is_online: payload.is_online,
              last_seen_at: payload.last_seen_at,
            },
          }));
        }
        if (event.type === "read") {
          const payload = event.payload as { conversation_id: number };
          if (payload.conversation_id === selectedConversationId) {
            void queryClient.invalidateQueries({
              queryKey: ["chat", "messages", selectedConversationId, "initial"],
            });
          }
        }
      },
      [appendMessage, queryClient, selectedConversationId],
    ),
  );

  useEffect(() => {
    if (!selectedConversationId) {
      lastMarkedConversationRef.current = null;
      return;
    }
    if (lastMarkedConversationRef.current === selectedConversationId) return;
    lastMarkedConversationRef.current = selectedConversationId;
    void markReadAsyncRef.current().catch(() => undefined);
  }, [selectedConversationId]);

  const openConversation = async (otherUserId: number, existingConversationId?: number) => {
    setSendError(null);
    setPendingAttachments([]);
    setDraft("");
    if (existingConversationId) {
      setSelectedConversationId(existingConversationId);
      return;
    }
    const result = await startConversation.mutateAsync(otherUserId);
    setSelectedConversationId(result.conversation_id);
  };

  const handleScroll = async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlderRef.current || !effectiveHasMore) {
      return;
    }
    const oldestId = localOldestId ?? messageData?.oldest_message_id;
    if (!oldestId) return;
    if (container.scrollTop > 80) return;

    loadingOlderRef.current = true;
    const previousHeight = container.scrollHeight;
    try {
      const older = await loadOlder.mutateAsync({ before: oldestId });
      // Merge handled by manually updating query cache through refetch pattern:
      // For simplicity, prepend via local state merge below.
      prependOlderMessages(older.messages, older.has_more, older.oldest_message_id);
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight - previousHeight;
        }
      });
    } finally {
      loadingOlderRef.current = false;
    }
  };

  const [localOlderMessages, setLocalOlderMessages] = useState<ChatMessageDto[]>([]);
  const [localHasMore, setLocalHasMore] = useState(false);
  const [localOldestId, setLocalOldestId] = useState<number | null>(null);

  useEffect(() => {
    setLocalOlderMessages([]);
    setLocalHasMore(messageData?.has_more ?? false);
    setLocalOldestId(messageData?.oldest_message_id ?? null);
    shouldStickToBottomRef.current = true;
  }, [selectedConversationId, messageData?.has_more, messageData?.oldest_message_id]);

  const prependOlderMessages = (
    messages: ChatMessageDto[],
    hasMore: boolean,
    oldestId: number | null,
  ) => {
    setLocalOlderMessages((current) => [...messages, ...current]);
    setLocalHasMore(hasMore);
    setLocalOldestId(oldestId);
  };

  const displayedMessages = useMemo(() => {
    const initial = messageData?.messages ?? [];
    const merged = [...localOlderMessages, ...initial];
    const seen = new Set<number>();
    return merged.filter((message) => {
      if (seen.has(message.message_id)) return false;
      seen.add(message.message_id);
      return true;
    });
  }, [localOlderMessages, messageData?.messages]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current || !messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [displayedMessages.length, selectedConversationId]);

  const effectiveHasMore = localHasMore || messageData?.has_more;

  const handleSend = async () => {
    if (!selectedConversationId) return;
    setSendError(null);
    const body = draft.trim();
    if (!body && pendingAttachments.length === 0) return;

    try {
      const messageType = pendingAttachments.some((item) => item.is_video)
        ? "video"
        : pendingAttachments.some((item) => item.is_image)
          ? "image"
          : pendingAttachments.length > 0
            ? "file"
            : "text";

      await sendMessage.mutateAsync({
        body: body || undefined,
        message_type: messageType,
        attachment_ids: pendingAttachments.map((item) => item.attachment_id),
      });
      setDraft("");
      setPendingAttachments([]);
      shouldStickToBottomRef.current = true;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send message.");
    }
  };

  const handleAttachmentPick = async (file: File | null) => {
    if (!file || !selectedConversationId) return;
    setSendError(null);
    try {
      const uploaded = await uploadAttachment.mutateAsync(file);
      setPendingAttachments((current) => [...current, uploaded]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to upload attachment.");
    }
  };

  const activeOtherUser = selectedConversation?.other_user;
  const activePresence = activeOtherUser
    ? presenceMap[activeOtherUser.user_id] ?? {
        is_online: activeOtherUser.is_online,
        last_seen_at: activeOtherUser.last_seen_at,
      }
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh)] max-h-[calc(100vh)] overflow-hidden">
      <Navbar title="Messages" subtitle="Internal team chat" />
      <div className="flex-1 min-h-0 p-4 md:p-6">
        <div className="h-full surface border rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr]">
          <aside className="border-b lg:border-b-0 lg:border-r flex flex-col h-full min-h-0 overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle size={18} />
                <h2 className="font-semibold">Conversations</h2>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
                <input
                  value={sidebarSearch}
                  onChange={(event) => setSidebarSearch(event.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border bg-transparent text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversationsLoading ? (
                <p className="p-4 text-sm muted">Loading conversations…</p>
              ) : (
                <>
                  {conversations.map((conversation) => {
                    const presence = presenceMap[conversation.other_user.user_id] ?? {
                      is_online: conversation.other_user.is_online,
                      last_seen_at: conversation.other_user.last_seen_at,
                    };
                    const active = selectedConversationId === conversation.conversation_id;
                    return (
                      <button
                        key={conversation.conversation_id}
                        type="button"
                        onClick={() => openConversation(conversation.other_user.user_id, conversation.conversation_id)}
                        className={`w-full text-left px-4 py-3 border-b border-black/5 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] ${
                          active ? "bg-brand-500/10" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={conversation.other_user.name} online={presence.is_online} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium truncate">{conversation.other_user.name}</p>
                              <span className="text-xs muted shrink-0">
                                {formatConversationTime(conversation.updated_at)}
                              </span>
                            </div>
                            <p className="text-xs muted">{formatRoleLabel(conversation.other_user.role)}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <p className="text-sm muted truncate">
                                {conversation.last_message
                                  ? previewMessage(
                                      conversation.last_message.body,
                                      conversation.last_message.message_type,
                                      conversation.last_message.attachment_preview,
                                    )
                                  : "No messages yet"}
                              </p>
                              {conversation.unread_count > 0 && (
                                <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">
                                  {conversation.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {mergedUsers
                    .filter(
                      (user) =>
                        !conversations.some((conversation) => conversation.other_user.user_id === user.user_id),
                    )
                    .map((user) => (
                      <button
                        key={`user-${user.user_id}`}
                        type="button"
                        onClick={() => openConversation(user.user_id)}
                        className="w-full text-left px-4 py-3 border-b border-black/5 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={user.name} online={user.is_online} />
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs muted">{formatRoleLabel(user.role)}</p>
                            <p className="text-xs muted mt-1">Start conversation</p>
                          </div>
                        </div>
                      </button>
                    ))}
                </>
              )}
            </div>
          </aside>

          <section className="flex flex-col h-full min-h-0 overflow-hidden">
            {!selectedConversationId || !activeOtherUser ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div>
                  <MessageCircle size={36} className="mx-auto mb-3 muted" />
                  <p className="font-medium">Select a conversation</p>
                  <p className="text-sm muted mt-1">
                    Choose a teammate from the left to start messaging.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="shrink-0 px-4 py-3 border-b flex items-center gap-3 bg-background/80">
                  <Avatar
                    name={activeOtherUser.name}
                    online={activePresence?.is_online ?? activeOtherUser.is_online}
                  />
                  <div>
                    <p className="font-semibold">{activeOtherUser.name}</p>
                    <p className="text-xs muted">
                      {formatRoleLabel(activeOtherUser.role)} ·{" "}
                      {formatLastSeen(
                        activePresence?.last_seen_at ?? activeOtherUser.last_seen_at,
                        activePresence?.is_online ?? activeOtherUser.is_online,
                      )}
                    </p>
                  </div>
                </div>

                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-black/[0.02] dark:bg-white/[0.02]"
                >
                  {effectiveHasMore && (
                    <div className="text-center">
                      {loadOlder.isPending ? (
                        <span className="inline-flex items-center gap-2 text-xs muted">
                          <Loader2 size={14} className="animate-spin" /> Loading older messages…
                        </span>
                      ) : (
                        <span className="text-xs muted">Scroll up to load older messages</span>
                      )}
                    </div>
                  )}

                  {messagesLoading ? (
                    <p className="text-sm muted">Loading messages…</p>
                  ) : displayedMessages.length === 0 ? (
                    <p className="text-sm muted">No messages yet. Say hello.</p>
                  ) : (
                    displayedMessages.map((message, index) => {
                      const previous = displayedMessages[index - 1];
                      const showDateDivider =
                        !previous ||
                        messageDateKey(previous.created_at) !== messageDateKey(message.created_at);

                      return (
                        <div key={message.message_id} className="space-y-2">
                          {showDateDivider && (
                            <div className="flex justify-center py-2">
                              <span className="rounded-full border px-3 py-1 text-[11px] muted bg-background/80">
                                {formatMessageDateDivider(message.created_at)}
                              </span>
                            </div>
                          )}
                          <MessageBubble message={message} onOpenMedia={setMediaViewer} />
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 md:p-4 space-y-2">
                  {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment) => (
                        <div
                          key={attachment.attachment_id}
                          className="text-xs px-2.5 py-1.5 rounded-lg border surface muted max-w-[220px] truncate"
                          title={attachment.file_name}
                        >
                          {attachment.is_video
                            ? `[Video] ${attachment.file_name}`
                            : attachment.is_image
                              ? `[Image] ${attachment.file_name}`
                              : `[File] ${attachment.file_name}`}
                        </div>
                      ))}
                    </div>
                  )}
                  {sendError && <p className="text-sm text-red-400">{sendError}</p>}
                  <div className="flex items-end gap-2 rounded-xl border surface p-2">
                    <label className="inline-flex shrink-0 items-center justify-center h-10 w-10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                      <Paperclip size={18} className="muted" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        onChange={(event) => {
                          void handleAttachmentPick(event.target.files?.[0] ?? null);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm min-h-[40px] max-h-32 focus:outline-none"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={
                        sendMessage.isPending ||
                        uploadAttachment.isPending ||
                        (!draft.trim() && pendingAttachments.length === 0)
                      }
                      className="inline-flex shrink-0 items-center justify-center h-10 w-10 rounded-lg bg-brand-600 text-white disabled:opacity-50"
                      aria-label="Send message"
                    >
                      {sendMessage.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      {mediaViewer && <MediaViewer item={mediaViewer} onClose={() => setMediaViewer(null)} />}
    </div>
  );
}
