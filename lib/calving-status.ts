// Centralized badge styling for calving outcome and calf gender — single
// source of truth for the Calving table.

const OUTCOME_STYLES: Record<string, string> = {
  "Live Birth": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Stillbirth: "bg-red-500/15 text-red-400 border-red-500/20",
  Twins: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Complications: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Other: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const DEFAULT_OUTCOME_STYLE = "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";

export function outcomeBadgeCls(outcome: string | null | undefined): string {
  if (!outcome) return DEFAULT_OUTCOME_STYLE;
  return OUTCOME_STYLES[outcome] ?? DEFAULT_OUTCOME_STYLE;
}

export function calfGenderBadgeCls(gender: string | null | undefined): string {
  return gender === "F" ? "bg-pink-500/15 text-pink-400" : "bg-blue-500/15 text-blue-400";
}
