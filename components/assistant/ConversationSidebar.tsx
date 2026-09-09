"use client";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import type { Conversation } from "./types";

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="w-64 shrink-0 border-r hidden lg:flex flex-col h-full">
      <div className="p-3 border-b">
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-colors"
        >
          <Plus size={15} /> New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs muted text-center py-6 px-2">No conversations yet. Start by asking a question below.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
              c.id === activeId ? "bg-brand-500/15 text-brand-700 dark:text-brand-300 font-medium" : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <MessageSquare size={14} className="shrink-0 opacity-60" />
            <span className="flex-1 truncate">{c.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0"
              aria-label="Delete conversation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
