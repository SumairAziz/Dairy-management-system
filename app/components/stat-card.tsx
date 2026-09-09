import type { ReactNode } from "react";
import Link from "next/link";
import type { ModuleId, Tone } from "@/lib/theme";

const TONE_HOVER: Record<Tone | ModuleId, { hover: string; active: string }> = {
  success: { hover: "hover:bg-emerald-500/5", active: "bg-emerald-500/10" },
  warning: { hover: "hover:bg-amber-500/5", active: "bg-amber-500/10" },
  danger: { hover: "hover:bg-red-500/5", active: "bg-red-500/10" },
  info: { hover: "hover:bg-blue-500/5", active: "bg-blue-500/10" },
  neutral: { hover: "hover:bg-slate-500/5", active: "bg-slate-500/10" },
  dashboard: { hover: "hover:bg-brand-500/5", active: "bg-brand-500/10" },
  animals: { hover: "hover:bg-emerald-500/5", active: "bg-emerald-500/10" },
  milk: { hover: "hover:bg-sky-500/5", active: "bg-sky-500/10" },
  vaccinations: { hover: "hover:bg-amber-500/5", active: "bg-amber-500/10" },
  breeding: { hover: "hover:bg-pink-500/5", active: "bg-pink-500/10" },
  heat: { hover: "hover:bg-orange-500/5", active: "bg-orange-500/10" },
  pregnancy: { hover: "hover:bg-purple-500/5", active: "bg-purple-500/10" },
  calving: { hover: "hover:bg-green-500/5", active: "bg-green-500/10" },
  inventory: { hover: "hover:bg-indigo-500/5", active: "bg-indigo-500/10" },
};

export function StatCard({
  label,
  value,
  icon,
  iconBg,
  href,
  active,
  tone,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconBg?: string;
  /** When set, the whole card becomes a drill-down link (hover glow + "View details" affordance). */
  href?: string;
  /** Highlights the card as the currently-active filter (e.g. matches the page's selected status tab). */
  active?: boolean;
  /** Tints the hover/active background to match a semantic tone or module identity. Defaults to the brand teal used today. */
  tone?: Tone | ModuleId;
}) {
  const { hover, active: activeCls } = TONE_HOVER[tone ?? "dashboard"];
  const body = (
    <>
      {icon && (
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${iconBg ?? "bg-white/5"}`}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-xs text-white/50 uppercase tracking-wide truncate">
          {label}
        </div>
        <div className="text-lg font-semibold truncate">{value}</div>
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-3 p-3 border-r border-white/10 last:border-r-0">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title="View details"
      className={`group flex items-center gap-3 p-3 rounded-2xl border-r border-white/10 last:border-r-0 cursor-pointer transition-colors duration-200 ${hover} ${
        active ? activeCls : ""
      }`}
    >
      {body}
    </Link>
  );
}
