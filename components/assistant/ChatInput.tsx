"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontal, Loader2 } from "lucide-react";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoGrow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div className="flex items-end gap-2 surface border rounded-2xl p-2 focus-within:ring-2 focus-within:ring-brand-500/40">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={autoGrow}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Ask about your farm — animals, milk, breeding, vaccinations, reports…"
        className="flex-1 resize-none bg-transparent outline-none text-sm px-2 py-2 max-h-40 placeholder:muted"
        disabled={disabled}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="shrink-0 h-9 w-9 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
        aria-label="Send message"
      >
        {disabled ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
      </button>
    </div>
  );
}
