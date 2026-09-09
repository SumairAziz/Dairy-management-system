"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditMessageComposer({
  initialValue,
  disabled,
  onSend,
  onCancel,
}: {
  initialValue: string;
  disabled?: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function autoGrow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-end gap-2 surface border rounded-2xl p-2 focus-within:ring-2 focus-within:ring-brand-500/40 bg-brand-500/5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={autoGrow}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus
          aria-label="Edit message"
          className="flex-1 resize-none bg-transparent outline-none text-sm px-2 py-2 max-h-40"
          disabled={disabled}
        />
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel edit"
          >
            <X size={14} />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send edited message"
            className="bg-brand-500 hover:bg-brand-600 text-white"
          >
            <SendHorizontal size={14} />
            Send
          </Button>
        </div>
      </div>
      <p className="text-[11px] muted px-1">Enter to send · Shift+Enter for newline · Esc to cancel</p>
    </div>
  );
}
