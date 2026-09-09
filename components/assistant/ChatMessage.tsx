"use client";
import { Bot, User, AlertTriangle } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import { MessageActions } from "./MessageActions";
import { EditMessageComposer } from "./EditMessageComposer";
import type { ChatMessageData } from "./types";

export function ChatMessage({
  message,
  isEditing,
  disabled,
  onCopyError,
  onEdit,
  onEditSend,
  onEditCancel,
}: {
  message: ChatMessageData;
  isEditing?: boolean;
  disabled?: boolean;
  onCopyError?: (message: string) => void;
  onEdit?: () => void;
  onEditSend?: (text: string) => void;
  onEditCancel?: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`group/message flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-brand-500/15 text-brand-500" : message.isError ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
        }`}
      >
        {isUser ? <User size={16} /> : message.isError ? <AlertTriangle size={16} /> : <Bot size={16} />}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {isUser && isEditing ? (
          <EditMessageComposer
            initialValue={message.content}
            disabled={disabled}
            onSend={(text) => onEditSend?.(text)}
            onCancel={() => onEditCancel?.()}
          />
        ) : (
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isUser
                ? "bg-brand-500 text-white rounded-tr-sm"
                : message.isError
                  ? "surface border border-red-500/30 rounded-tl-sm"
                  : "surface border rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownMessage content={message.content} />
            )}
          </div>
        )}

        {!isEditing && (
          <MessageActions
            message={message}
            isUser={isUser}
            disabled={disabled}
            onCopyError={onCopyError}
            onEdit={isUser ? onEdit : undefined}
          />
        )}

        {message.toolsUsed && message.toolsUsed.length > 0 && !isEditing && (
          <div className="text-[10px] muted px-1 flex items-center gap-1 flex-wrap">
            <span className="opacity-60">Data used:</span>
            {message.toolsUsed.map((t, i) => (
              <span key={`${t}-${i}`} className="px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
