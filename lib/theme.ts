// Centralized color tokens — the single source of truth for semantic tones,
// per-module identity colors, and chart palettes. Every color used outside a
// domain's own status file (lib/pregnancy-status.ts, lib/vaccination-status.ts,
// lib/heat-cycle-status.ts, lib/animal-status.ts, lib/milk-quality.ts) should
// come from here rather than being hardcoded inline.

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export interface ToneStyle {
  /** Badge background + text, e.g. for a pill. */
  cls: string;
  /** Small status dot. */
  dot: string;
  /** Text-only color, for icons/numbers that should "inherit" the tone. */
  text: string;
  /** Icon chip background. */
  iconBg: string;
  /** Hex equivalent, for SVG/chart fills that can't take Tailwind classes. */
  hex: string;
}

export const TONE: Record<Tone, ToneStyle> = {
  success: {
    cls: "bg-emerald-500/15 text-emerald-400",
    dot: "bg-emerald-400",
    text: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    hex: "#10b981",
  },
  warning: {
    cls: "bg-amber-500/15 text-amber-400",
    dot: "bg-amber-400",
    text: "text-amber-500",
    iconBg: "bg-amber-500/10",
    hex: "#f59e0b",
  },
  danger: {
    cls: "bg-red-500/15 text-red-400",
    dot: "bg-red-400",
    text: "text-red-500",
    iconBg: "bg-red-500/10",
    hex: "#ef4444",
  },
  info: {
    cls: "bg-blue-500/15 text-blue-400",
    dot: "bg-blue-400",
    text: "text-blue-500",
    iconBg: "bg-blue-500/10",
    hex: "#3b82f6",
  },
  neutral: {
    cls: "bg-slate-500/15 text-slate-400",
    dot: "bg-slate-400",
    text: "text-slate-500",
    iconBg: "bg-slate-500/10",
    hex: "#94a3b8",
  },
};

export type ModuleId =
  | "dashboard"
  | "animals"
  | "milk"
  | "vaccinations"
  | "breeding"
  | "heat"
  | "pregnancy"
  | "calving"
  | "inventory";

export interface ModuleTheme {
  hex: string;
  text: string;
  iconBg: string;
  /** Key into QuickAction's colorMap (app/page.tsx). */
  quickAction: string;
}

/**
 * Per-module identity color. Only covers modules the user's spec assigns a
 * color to; Farms/Units/Species & Breeds have no requested identity and stay
 * on the existing neutral `brand` teal (not listed here).
 */
export const MODULE_THEME: Record<ModuleId, ModuleTheme> = {
  dashboard: { hex: "#14b8a6", text: "text-brand-500", iconBg: "bg-brand-500/10", quickAction: "brand" },
  animals: { hex: "#10b981", text: "text-emerald-500", iconBg: "bg-emerald-500/10", quickAction: "emerald" },
  milk: { hex: "#0ea5e9", text: "text-sky-500", iconBg: "bg-sky-500/10", quickAction: "sky" },
  vaccinations: { hex: "#f59e0b", text: "text-amber-500", iconBg: "bg-amber-500/10", quickAction: "amber" },
  breeding: { hex: "#ec4899", text: "text-pink-500", iconBg: "bg-pink-500/10", quickAction: "pink" },
  heat: { hex: "#f97316", text: "text-orange-500", iconBg: "bg-orange-500/10", quickAction: "orange" },
  pregnancy: { hex: "#a855f7", text: "text-purple-500", iconBg: "bg-purple-500/10", quickAction: "purple" },
  calving: { hex: "#22c55e", text: "text-green-500", iconBg: "bg-green-500/10", quickAction: "green" },
  inventory: { hex: "#6366f1", text: "text-indigo-500", iconBg: "bg-indigo-500/10", quickAction: "indigo" },
};

/**
 * Label-keyed chart palettes (never positional arrays) — colors are looked up
 * by the datum's own label via `colorFor()`, so a chart's color can never
 * drift out of sync with a reordered/filtered data array.
 */
export const CHART_PALETTES = {
  lifecycleStage: {
    Calf: "#38bdf8",
    Heifer: "#34d399",
    "Pregnant Heifer": "#a855f7",
    Lactating: "#10b981",
    Dry: "#f59e0b",
    Bull: "#0ea5e9",
    "Breeding Bull": "#0ea5e9",
    Retired: "#94a3b8",
    Sold: "#94a3b8",
    Deceased: "#64748b",
  },
  pregnancyStatus: {
    Pending: "#f59e0b",
    Confirmed: "#3b82f6",
    "In Progress": "#3b82f6",
    Delivered: "#10b981",
    Failed: "#ef4444",
    Aborted: "#ef4444",
  },
  breedingResult: {
    Success: "#10b981",
    Failed: "#ef4444",
    Pending: "#f59e0b",
  },
  healthStatus: {
    Healthy: "#10b981",
    Recovering: "#f59e0b",
    "Under Treatment": "#f59e0b",
    Sick: "#ef4444",
    Critical: "#dc2626",
    Injured: "#ef4444",
    Monitored: "#6366f1",
    Deceased: "#64748b",
  },
  /** Coarse Animals-dashboard age buckets (distinct from the fine-grained `lifecycleStage` map above). */
  stageBucket: {
    Calves: "#38bdf8",
    Heifers: "#2dd4bf",
    Adults: "#10b981",
    Seniors: "#94a3b8",
  },
  /** Inventory dashboard — Stock by Category donut (label-keyed for legend sync). */
  inventoryCategory: {
    Feed: MODULE_THEME.calving.hex,
    Medicines: MODULE_THEME.breeding.hex,
    Supplies: TONE.info.hex,
    Vaccines: MODULE_THEME.pregnancy.hex,
    Equipment: TONE.warning.hex,
    Other: TONE.neutral.hex,
  },
} as const;

/** Looks up a hex color by label in one of the palettes above, with a guaranteed fallback. */
export function colorFor(
  map: Record<string, string>,
  label: string,
  fallback = "#94a3b8",
): string {
  return map[label] ?? fallback;
}

/**
 * Shared table row treatment — hover + very subtle zebra striping. A strict
 * superset of the `border-t border-black/5 dark:border-white/10 hover:bg-black/2
 * dark:hover:bg-white/5` className used identically across 5 pages (animals,
 * breeding, pregnancy, heat-cycles, vaccinations) before this token existed.
 */
export const TABLE_ROW =
  "border-t border-black/5 dark:border-white/10 odd:bg-black/[0.012] dark:odd:bg-white/[0.018] hover:bg-black/[0.035] dark:hover:bg-white/[0.055] transition-colors";
