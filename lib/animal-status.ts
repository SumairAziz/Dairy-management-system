// Centralized badge styling for animal-level attributes (lifecycle stage,
// gender, active/inactive) — single source of truth so the Animals table and
// any other page showing these fields render identical colors.

export interface BadgeStyle {
  cls: string;
  dot: string;
}

const LIFECYCLE_STAGE_STYLES: Record<string, BadgeStyle> = {
  Calf: { cls: "bg-sky-500/15 text-sky-400", dot: "bg-sky-400" },
  Heifer: { cls: "bg-teal-500/15 text-teal-400", dot: "bg-teal-400" },
  "Pregnant Heifer": { cls: "bg-purple-500/15 text-purple-400", dot: "bg-purple-400" },
  Lactating: { cls: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  Dry: { cls: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" },
  Bull: { cls: "bg-blue-500/15 text-blue-400", dot: "bg-blue-400" },
  "Breeding Bull": { cls: "bg-blue-500/15 text-blue-400", dot: "bg-blue-400" },
  Retired: { cls: "bg-slate-500/15 text-slate-400", dot: "bg-slate-400" },
  Sold: { cls: "bg-gray-500/15 text-gray-400", dot: "bg-gray-400" },
  Deceased: { cls: "bg-red-500/15 text-red-400", dot: "bg-red-400" },
};

const DEFAULT_STAGE_STYLE: BadgeStyle = {
  cls: "bg-slate-500/15 text-slate-400",
  dot: "bg-slate-400",
};

export function lifecycleStageBadge(stage: string | null | undefined): BadgeStyle {
  if (!stage) return DEFAULT_STAGE_STYLE;
  return LIFECYCLE_STAGE_STYLES[stage] ?? DEFAULT_STAGE_STYLE;
}

const GENDER_STYLES: Record<"M" | "F", BadgeStyle> = {
  F: { cls: "bg-pink-500/15 text-pink-400", dot: "bg-pink-400" },
  M: { cls: "bg-blue-500/15 text-blue-400", dot: "bg-blue-400" },
};

export function genderBadge(gender: string | null | undefined): BadgeStyle {
  return GENDER_STYLES[gender as "M" | "F"] ?? DEFAULT_STAGE_STYLE;
}

export function activeBadge(isActive: boolean | null | undefined): BadgeStyle {
  return isActive
    ? { cls: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" }
    : { cls: "bg-slate-700 text-slate-400", dot: "bg-slate-500" };
}

const PRODUCTION_STATUS_STYLES: Record<string, BadgeStyle> = {
  lactating: { cls: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  dry: { cls: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" },
  never_lactated: { cls: "bg-sky-500/15 text-sky-400", dot: "bg-sky-400" },
  not_applicable: { cls: "bg-slate-500/15 text-slate-400", dot: "bg-slate-400" },
};

export function productionStatusBadge(status: string | null | undefined): BadgeStyle {
  if (!status) return DEFAULT_STAGE_STYLE;
  return PRODUCTION_STATUS_STYLES[status] ?? DEFAULT_STAGE_STYLE;
}
