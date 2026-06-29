import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconBg?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border-r border-white/10 last:border-r-0">
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
    </div>
  );
}
