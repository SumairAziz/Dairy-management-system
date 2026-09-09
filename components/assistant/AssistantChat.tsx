"use client";

import { useEffect, useRef, useState } from "react";

import { Sparkles, AlertCircle, RotateCcw } from "lucide-react";

import { api, ApiRequestError } from "@/lib/api-client";

import type { AiAssistantErrorPayload } from "@/lib/ai/assistant-errors";

import { useExportToast } from "@/components/export/ExportToastProvider";

import { ChatMessage } from "./ChatMessage";

import { ChatInput } from "./ChatInput";

import { SuggestedPrompts } from "./SuggestedPrompts";

import { TypingIndicator } from "./TypingIndicator";

import { ConversationSidebar } from "./ConversationSidebar";

import { ShareChatButton, ShareChatDialog } from "./ShareChatDialog";

import { useConversations } from "./use-conversations";

import {

  formatAssistantErrorBanner,

  formatAssistantErrorDetails,

  formatAssistantErrorSummary,

} from "./format-assistant-error";

import type { ChatMessageData } from "./types";



interface AssistantChatResponse {

  message: string;

  toolsUsed: string[];

}



function newMsgId(): string {

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

}



function normalizeAssistantError(error: unknown): AiAssistantErrorPayload {

  if (error instanceof ApiRequestError) {

    return error.payload;

  }

  if (error instanceof Error) {

    return {

      code: "AI_UNKNOWN_ERROR",

      message: error.message || "Something went wrong talking to the assistant.",

    };

  }

  return {

    code: "AI_UNKNOWN_ERROR",

    message: "Something went wrong talking to the assistant.",

  };

}



export function AssistantChat() {

  const { conversations, active, activeId, setActiveId, createConversation, deleteConversation, appendMessages } =

    useConversations();

  const { showToast } = useExportToast();



  const [pending, setPending] = useState(false);

  const [errorInfo, setErrorInfo] = useState<AiAssistantErrorPayload | null>(null);

  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);



  const messages: ChatMessageData[] = active?.messages ?? [];



  useEffect(() => {

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  }, [messages.length, pending]);



  useEffect(() => {

    setEditingMessageId(null);

  }, [activeId]);



  async function send(text: string) {

    setErrorInfo(null);

    setLastFailedText(null);

    setEditingMessageId(null);



    const conversationId = activeId ?? createConversation();

    const userMessage: ChatMessageData = { id: newMsgId(), role: "user", content: text };

    appendMessages(conversationId, [userMessage]);



    const transcript = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));



    setPending(true);

    try {

      const res = await api.post<AssistantChatResponse>("/assistant/chat", { messages: transcript });

      appendMessages(conversationId, [

        { id: newMsgId(), role: "assistant", content: res.message, toolsUsed: res.toolsUsed },

      ]);

    } catch (e) {

      const payload = normalizeAssistantError(e);

      setErrorInfo(payload);

      setLastFailedText(text);

      appendMessages(conversationId, [

        {

          id: newMsgId(),

          role: "assistant",

          content: formatAssistantErrorDetails(payload),

          isError: true,

          errorInfo: payload,

        },

      ]);

    } finally {

      setPending(false);

    }

  }



  function retry() {

    if (lastFailedText) send(lastFailedText);

  }



  function handleEditSend(text: string) {

    send(text);

  }



  return (

    <div className="flex h-[calc(100vh-0px)]">

      <ConversationSidebar

        conversations={conversations}

        activeId={activeId}

        onSelect={setActiveId}

        onCreate={createConversation}

        onDelete={deleteConversation}

      />



      <div className="flex-1 flex flex-col min-w-0">

        <div className="border-b px-6 py-4 flex items-center gap-3">

          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white shrink-0">

            <Sparkles size={18} />

          </div>

          <div className="min-w-0 flex-1">

            <h1 className="font-semibold tracking-tight">TerraDairy AI Farm Assistant</h1>

            <p className="text-xs muted">Ask anything about your animals, farms, milk, health, and breeding — in plain English.</p>

          </div>

          <ShareChatButton
            disabled={pending || !active?.messages.length}
            onOpen={() => setShareOpen(true)}
          />

        </div>



        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {messages.length === 0 ? (

            <div className="max-w-2xl mx-auto space-y-6 pt-6">

              <div className="text-center space-y-2">

                <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">

                  <Sparkles size={22} />

                </div>

                <h2 className="text-lg font-semibold">How can I help with the farm today?</h2>

                <p className="text-sm muted">I can look up live data, compare farms, spot trends, and generate full reports.</p>

              </div>

              <SuggestedPrompts onSelect={send} />

            </div>

          ) : (

            <>

              {messages.map((m) => (

                <ChatMessage

                  key={m.id}

                  message={m}

                  isEditing={editingMessageId === m.id}

                  disabled={pending}

                  onCopyError={(msg) => showToast(msg, "error")}

                  onEdit={
                    m.role === "user" && editingMessageId === null
                      ? () => setEditingMessageId(m.id)
                      : undefined
                  }

                  onEditSend={handleEditSend}

                  onEditCancel={() => setEditingMessageId(null)}

                />

              ))}

              {pending && (

                <div className="flex gap-3">

                  <div className="shrink-0 h-8 w-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">

                    <Sparkles size={15} />

                  </div>

                  <div className="surface border rounded-2xl rounded-tl-sm px-2">

                    <TypingIndicator />

                  </div>

                </div>

              )}

            </>

          )}

          <div ref={bottomRef} />

        </div>



        {errorInfo && (

          <div className="mx-6 mb-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 space-y-2">

            <div className="flex items-start justify-between gap-3">

              <div className="flex items-start gap-2 min-w-0">

                <AlertCircle size={15} className="shrink-0 mt-0.5" />

                <div className="min-w-0 space-y-1">

                  <p className="font-medium text-sm">AI Assistant Error</p>

                  <p className="text-sm">{formatAssistantErrorSummary(errorInfo)}</p>

                  <p className="text-xs opacity-90 break-words">{formatAssistantErrorBanner(errorInfo)}</p>

                </div>

              </div>

              {lastFailedText && (

                <button onClick={retry} className="shrink-0 flex items-center gap-1 text-sm font-medium hover:underline">

                  <RotateCcw size={12} /> Retry

                </button>

              )}

            </div>

          </div>

        )}



        <div className="px-6 pb-6 pt-2">

          <ChatInput onSend={send} disabled={pending || editingMessageId !== null} />

          <p className="text-[11px] muted text-center mt-2">

            The assistant only reads live farm data through approved tools — it cannot create, edit, or delete records.

          </p>

        </div>

      </div>

      <ShareChatDialog conversation={active} open={shareOpen} onOpenChange={setShareOpen} />

    </div>

  );

}

