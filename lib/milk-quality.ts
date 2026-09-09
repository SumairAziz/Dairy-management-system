import { ShieldCheck, Check, AlertTriangle, X, MinusCircle, type LucideIcon } from "lucide-react";

// Centralized milk quality grade styling — single source of truth for the
// Milk Production table's grade badge. Uses the real schema values
// (A / B / C / Rejected — there is no "D" grade).

export interface MilkGradeStyle {
  cls: string;
  icon: LucideIcon;
  label: string;
}

const GRADE_STYLES: Record<string, MilkGradeStyle> = {
  A: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: ShieldCheck, label: "A" },
  B: { cls: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Check, label: "B" },
  C: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: AlertTriangle, label: "C" },
  Rejected: { cls: "bg-red-500/15 text-red-400 border-red-500/20", icon: X, label: "Rejected" },
};

const UNGRADED_STYLE: MilkGradeStyle = {
  cls: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  icon: MinusCircle,
  label: "Not graded",
};

export function milkGradeStyle(grade: string | null | undefined): MilkGradeStyle {
  if (!grade) return UNGRADED_STYLE;
  return GRADE_STYLES[grade] ?? GRADE_STYLES.C;
}
