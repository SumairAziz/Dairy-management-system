"use client";
import { Sparkles } from "lucide-react";

const PROMPTS = [
  "Which farm produced the most milk this month?",
  "Show all pregnant animals due next month.",
  "Which vaccinations are overdue?",
  "Which breed produces the most milk?",
  "Which animals repeatedly return to heat?",
  "Generate a monthly farm report.",
  "How many calves were born this year?",
  "Show animals with health incidents.",
  "List dry animals.",
  "Show highest producing cows.",
  "How much milk was produced last week?",
];

export function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium muted">
        <Sparkles size={14} className="text-brand-500" />
        Try asking
      </div>
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className="text-xs px-3 py-2 rounded-full surface border hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors text-left"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
