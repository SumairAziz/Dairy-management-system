"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/assistant/clipboard";
import { getMessageCopyText } from "@/lib/assistant/message-content";
import type { ChatMessageData } from "./types";

const COPIED_RESET_MS = 2000;

interface MessageActionsProps {
  message: ChatMessageData;
  isUser: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onCopyError?: (message: string) => void;
}

export function MessageActions({
  message,
  isUser,
  disabled,
  onEdit,
  onCopyError,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const text = getMessageCopyText(message);
    const result = await copyTextToClipboard(text);
    if (!result.ok) {
      onCopyError?.(result.error);
      return;
    }
    setCopied(true);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [message, onCopyError]);

  return (
    <div
      className={`flex items-center gap-0.5 ${
        isUser ? "justify-end" : "justify-start"
      } opacity-100 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100 transition-opacity`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy message"}
        title={copied ? "Copied" : "Copy"}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </Button>

      {isUser && onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onEdit}
          aria-label="Edit message"
          title="Edit"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Pencil size={14} />
        </Button>
      )}
    </div>
  );
}
