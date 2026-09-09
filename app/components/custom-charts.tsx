"use client";
import { useId, useState, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { Tone, ModuleId } from "@/lib/theme";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PALETTE = [
  "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4",
  "#0891b2", "#6366f1", "#a855f7", "#ec4899",
  "#f59e0b", "#84cc16",
];

export function chartColor(index: number): string { return PALETTE[index % PALETTE.length]; }

// ─── Shared hooks ─────────────────────────────────────────────────────────────
function useMounted(delay = 80) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return mounted;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function roundedTopPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const s = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + s} Q${x},${y} ${x + s},${y} L${x + w - s},${y} Q${x + w},${y} ${x + w},${y + s} L${x + w},${y + h} Z`;
}

function catmullRom(pts: { x: number; y: number }[]): string {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({
  message = "No data available yet",
  hint = "Records will appear here once added.",
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 select-none">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="opacity-20">
        <rect x="5" y="24" width="7" height="15" rx="2" fill="currentColor" />
        <rect x="16" y="16" width="7" height="23" rx="2" fill="currentColor" />
        <rect x="27" y="8" width="7" height="31" rx="2" fill="currentColor" />
        <line x1="3" y1="41" x2="41" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium opacity-40">{message}</p>
        <p className="text-xs opacity-25">{hint}</p>
      </div>
    </div>
  );
}

const METRIC_CARD_GLOW: Record<Tone | ModuleId, string> = {
  success: "hover:border-emerald-500/40 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_10px_28px_-10px_rgba(16,185,129,0.4)]",
  warning: "hover:border-amber-500/40 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_10px_28px_-10px_rgba(245,158,11,0.4)]",
  danger: "hover:border-red-500/40 hover:shadow-[0_0_0_1px_rgba(239,68,68,0.25),0_10px_28px_-10px_rgba(239,68,68,0.4)]",
  info: "hover:border-blue-500/40 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_10px_28px_-10px_rgba(59,130,246,0.4)]",
  neutral: "hover:border-slate-500/40 hover:shadow-[0_0_0_1px_rgba(148,163,184,0.25),0_10px_28px_-10px_rgba(148,163,184,0.4)]",
  dashboard: "hover:border-brand-500/40 hover:shadow-[0_0_0_1px_rgba(20,184,166,0.25),0_10px_28px_-10px_rgba(20,184,166,0.4)]",
  animals: "hover:border-emerald-500/40 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_10px_28px_-10px_rgba(16,185,129,0.4)]",
  milk: "hover:border-sky-500/40 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.25),0_10px_28px_-10px_rgba(14,165,233,0.4)]",
  vaccinations: "hover:border-amber-500/40 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_10px_28px_-10px_rgba(245,158,11,0.4)]",
  breeding: "hover:border-pink-500/40 hover:shadow-[0_0_0_1px_rgba(236,72,153,0.25),0_10px_28px_-10px_rgba(236,72,153,0.4)]",
  heat: "hover:border-orange-500/40 hover:shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_10px_28px_-10px_rgba(249,115,22,0.4)]",
  pregnancy: "hover:border-purple-500/40 hover:shadow-[0_0_0_1px_rgba(168,85,247,0.25),0_10px_28px_-10px_rgba(168,85,247,0.4)]",
  calving: "hover:border-green-500/40 hover:shadow-[0_0_0_1px_rgba(34,197,94,0.25),0_10px_28px_-10px_rgba(34,197,94,0.4)]",
  inventory: "hover:border-indigo-500/40 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_10px_28px_-10px_rgba(99,102,241,0.4)]",
};

// ─── MetricCard ───────────────────────────────────────────────────────────────
export function MetricCard({
  label, value, hint, icon, href, tooltip, tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  /** When set, the whole card becomes a drill-down link (hover glow + "View details" affordance). */
  href?: string;
  /** Overrides the hover tooltip text (defaults to "View details" when href is set). */
  tooltip?: string;
  /** Tints the hover glow to match a semantic tone or module identity. Defaults to the brand teal used today. */
  tone?: Tone | ModuleId;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider muted">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-xs muted">{hint}</div>}
      {href && (
        <div className="flex items-center gap-0.5 text-[11px] font-medium text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
          View details <ChevronRight size={12} />
        </div>
      )}
    </>
  );

  if (!href) {
    return (
      <div className="surface border rounded-2xl p-5 flex flex-col gap-2 hover:border-white/20 dark:hover:border-white/15 transition-colors duration-200">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={tooltip ?? "View details"}
      className={`group surface border rounded-2xl p-5 flex flex-col gap-2 cursor-pointer transition-all duration-200 ${METRIC_CARD_GLOW[tone ?? "dashboard"]}`}
    >
      {body}
    </Link>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────
export function BarChart({
  data,
  height = 220,
}: {
  data: { label: string; value: number; href?: string; color?: string }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const mounted = useMounted(100);
  const router = useRouter();

  if (!data.length) return <EmptyState />;

  const w = 600;
  const padL = 46; const padB = 38; const padT = 28; const padR = 14;
  const innerW = w - padL - padR;
  const innerH = height - padB - padT;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = innerW / data.length;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + innerH * (1 - t),
    val: Math.round(max * t),
  }));

  let ttX = 0, ttY = 0;
  const ttW = 96, ttH = 52;
  if (hover !== null) {
    const bh = (data[hover].value / max) * innerH;
    const cx = padL + hover * bw + bw * 0.5;
    ttX = Math.max(padL, Math.min(cx - ttW / 2, w - ttW - padR));
    ttY = padT + innerH - bh - ttH - 10;
    if (ttY < padT) ttY = padT + innerH - bh + 8;
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full h-auto"
      onMouseLeave={() => setHover(null)}
    >
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL} x2={w - padR} y1={t.y} y2={t.y}
            stroke="currentColor"
            opacity={i === 0 ? 0.18 : 0.06}
            strokeDasharray={i === 0 ? "" : "4,5"}
          />
          <text
            x={padL - 8} y={t.y + 4}
            textAnchor="end" fontSize="9" fill="currentColor" opacity="0.4"
          >
            {t.val}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const bh = (d.value / max) * innerH;
        const x = padL + i * bw + bw * 0.18;
        const y = padT + innerH - bh;
        const bwActual = bw * 0.64;
        const isHov = hover === i;
        const col = d.color ?? PALETTE[i % PALETTE.length];

        return (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onClick={() => d.href && router.push(d.href)}
            style={{ cursor: "pointer" }}
          >
            {d.href && <title>View details</title>}
            {/* Bar */}
            <path
              d={roundedTopPath(x, y, bwActual, bh, 5)}
              fill={col}
              opacity={!mounted ? 0 : hover === null || isHov ? 1 : 0.38}
              style={{ transition: `opacity 0.4s ease ${i * 0.04}s` }}
            />
            {/* Hover glow */}
            {isHov && (
              <path
                d={roundedTopPath(x - 1, y - 1, bwActual + 2, bh + 1, 5)}
                fill="none"
                stroke={col}
                strokeWidth={d.href ? 1.5 : 1}
                opacity={d.href ? 0.65 : 0.4}
              />
            )}
            {/* Value label */}
            <text
              x={x + bwActual / 2} y={y - 6}
              textAnchor="middle" fontSize="10.5" fill="currentColor"
              fontWeight={isHov ? "700" : "500"}
              opacity={mounted ? (hover === null ? 0.55 : isHov ? 1 : 0.2) : 0}
              style={{ transition: "opacity 0.18s ease" }}
            >
              {d.value}
            </text>
            {/* X label */}
            <text
              x={x + bwActual / 2} y={height - 10}
              textAnchor="middle" fontSize="9.5" fill="currentColor"
              opacity={isHov ? 0.85 : 0.45}
              style={{ transition: "opacity 0.15s" }}
            >
              {d.label.length > 11 ? d.label.slice(0, 11) + "…" : d.label}
            </text>
          </g>
        );
      })}

      {/* Tooltip */}
      {hover !== null && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={ttX} y={ttY} width={ttW} height={ttH} rx="8"
            fill="rgba(6,12,22,0.95)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"
          />
          <text x={ttX + 11} y={ttY + 18} fontSize="9.5" fill="rgba(255,255,255,0.45)">
            {data[hover].label.length > 11 ? data[hover].label.slice(0, 11) + "…" : data[hover].label}
          </text>
          <text x={ttX + 11} y={ttY + 40} fontSize="18" fill="white" fontWeight="700">
            {data[hover].value}
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── LineChart ────────────────────────────────────────────────────────────────
export function LineChart({
  data,
  height = 220,
  yLabel,
  color = "#14b8a6",
  colorFrom = "#0d9488",
  colorTo = "#2dd4bf",
}: {
  data: { label: string; value: number; href?: string }[];
  height?: number;
  yLabel?: string;
  /** Area fill / dot / crosshair color, defaults to the brand teal used today. */
  color?: string;
  /** Line-stroke gradient start, defaults to the brand teal used today. */
  colorFrom?: string;
  /** Line-stroke gradient end, defaults to the brand teal used today. */
  colorTo?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const mounted = useMounted(120);
  const id = useId();
  const router = useRouter();

  if (!data.length) return <EmptyState />;

  const w = 600;
  const padL = 54; const padB = 34; const padT = 18; const padR = 18;
  const innerW = w - padL - padR;
  const innerH = height - padB - padT;
  const max = Math.max(...data.map((d) => d.value), 1);
  const range = max || 1;

  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(1, data.length - 1)) * innerW,
    y: padT + innerH - (d.value / range) * innerH,
    ...d,
  }));

  const linePath = catmullRom(pts);
  const areaPath =
    pts.length > 0
      ? `${linePath} L${pts.at(-1)!.x},${padT + innerH} L${pts[0].x},${padT + innerH} Z`
      : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + innerH * (1 - t),
    val: Math.round(max * t),
  }));

  const xStep = Math.max(1, Math.ceil(data.length / 7));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let minDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    setHoverIdx(nearest);
  }

  const hovPt = hoverIdx !== null ? pts[hoverIdx] : null;
  const ttW = 118; const ttH = 60;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full h-auto"
      style={{ cursor: "crosshair" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="80%" stopColor={color} stopOpacity="0.02" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL} x2={w - padR} y1={t.y} y2={t.y}
            stroke="currentColor"
            opacity={i === 0 ? 0.16 : 0.06}
            strokeDasharray={i === 0 ? "" : "4,5"}
          />
          <text
            x={padL - 9} y={t.y + 4}
            textAnchor="end" fontSize="9" fill="currentColor" opacity="0.4"
          >
            {t.val}{i === yTicks.length - 1 && yLabel ? ` ${yLabel}` : ""}
          </text>
        </g>
      ))}

      {/* X axis baseline */}
      <line
        x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH}
        stroke="currentColor" opacity="0.14"
      />

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`url(#${id}-fill)`}
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.9s ease 0.5s" }}
      />

      {/* Animated line */}
      <path
        d={linePath}
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={mounted ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />

      {/* X-axis labels */}
      {pts.map((p, i) =>
        i % xStep === 0 ? (
          <text
            key={`xl${i}`}
            x={p.x} y={height - 9}
            textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.4"
          >
            {p.label}
          </text>
        ) : null,
      )}

      {/* Data point dots */}
      {pts.map((p, i) => (
        <g key={`dot${i}`}>
          <circle
            cx={p.x} cy={p.y}
            r={hoverIdx === i ? 5.5 : 3}
            fill={hoverIdx === i ? color : "rgb(var(--surface, 15 23 42))"}
            stroke={hoverIdx === i ? colorTo : colorFrom}
            strokeWidth={hoverIdx === i ? 2.5 : 1.5}
            style={{
              opacity: mounted ? 1 : 0,
              transition: "r 0.15s ease, stroke-width 0.15s ease, fill 0.15s ease",
            }}
          />
          {/* Larger invisible hit area so a clickable point is easy to hit */}
          {p.href && (
            <circle
              cx={p.x} cy={p.y} r={10}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => router.push(p.href!)}
            >
              <title>View details</title>
            </circle>
          )}
        </g>
      ))}

      {/* Crosshair + tooltip */}
      {hovPt && (() => {
        const tx = Math.min(hovPt.x + 14, w - ttW - padR);
        const ty = Math.max(hovPt.y - ttH - 12, padT);
        return (
          <g style={{ pointerEvents: "none" }}>
            {/* Vertical crosshair */}
            <line
              x1={hovPt.x} y1={padT} x2={hovPt.x} y2={padT + innerH}
              stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.35"
            />
            {/* Tooltip */}
            <rect
              x={tx} y={ty} width={ttW} height={ttH} rx="9"
              fill="rgba(6,12,22,0.96)" stroke="rgba(255,255,255,0.11)" strokeWidth="1"
            />
            <text x={tx + 12} y={ty + 19} fontSize="9.5" fill="rgba(255,255,255,0.45)" letterSpacing="0.3">
              {hovPt.label}
            </text>
            <text x={tx + 12} y={ty + 45} fontSize="19" fill="white" fontWeight="700">
              <tspan>{hovPt.value.toFixed(1)}</tspan>
              {yLabel && (
                <tspan fontSize="11" fontWeight="400" fill="rgba(255,255,255,0.45)"> {yLabel}</tspan>
              )}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ─── PieChart (donut) ─────────────────────────────────────────────────────────
export function PieChart({
  data,
  size = 200,
}: {
  data: { label: string; value: number; href?: string; color?: string }[];
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const mounted = useMounted(80);
  const router = useRouter();

  if (!data.length) return <EmptyState />;

  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const r = size / 2 - 10;
  const innerR = r * 0.56;
  const cx = size / 2;
  const cy = size / 2;

  let acc = 0;
  const arcs = data.map((d, i) => {
    const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const midAngle = (startAngle + endAngle) / 2;
    const outset = hover === i ? 7 : 0;
    const dx = Math.cos(midAngle) * outset;
    const dy = Math.sin(midAngle) * outset;

    const ox1 = cx + r * Math.cos(startAngle) + dx;
    const oy1 = cy + r * Math.sin(startAngle) + dy;
    const ox2 = cx + r * Math.cos(endAngle) + dx;
    const oy2 = cy + r * Math.sin(endAngle) + dy;
    const ix1 = cx + innerR * Math.cos(startAngle) + dx;
    const iy1 = cy + innerR * Math.sin(startAngle) + dy;
    const ix2 = cx + innerR * Math.cos(endAngle) + dx;
    const iy2 = cy + innerR * Math.sin(endAngle) + dy;

    // Outer arc CW → inner edge → inner arc CCW → close
    const path = `M${ox1},${oy1} A${r},${r} 0 ${large} 1 ${ox2},${oy2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large} 0 ${ix1},${iy1} Z`;

    return {
      path,
      color: d.color ?? PALETTE[i % PALETTE.length],
      label: d.label,
      value: d.value,
      pct: (d.value / total) * 100,
      href: d.href,
    };
  });

  const hov = hover !== null ? arcs[hover] : null;

  return (
    <div className="flex items-center gap-5">
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.path}
            fill={a.color}
            opacity={!mounted ? 0 : hover === null || hover === i ? 1 : 0.3}
            style={{
              transition: `opacity 0.18s ease, transform 0.2s ease`,
              cursor: "pointer",
            }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => a.href && router.push(a.href)}
          >
            {a.href && <title>View details</title>}
          </path>
        ))}

        {/* Center label */}
        {hov ? (
          <>
            <text
              x={cx} y={cy - 8}
              textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.45"
            >
              {hov.label.length > 9 ? hov.label.slice(0, 9) + "…" : hov.label}
            </text>
            <text
              x={cx} y={cy + 10}
              textAnchor="middle" fontSize="18" fill="currentColor" fontWeight="700"
            >
              {hov.value}
            </text>
            <text
              x={cx} y={cy + 26}
              textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.45"
            >
              {hov.pct.toFixed(1)}%
            </text>
          </>
        ) : (
          <>
            <text
              x={cx} y={cy - 4}
              textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.4"
            >
              Total
            </text>
            <text
              x={cx} y={cy + 14}
              textAnchor="middle" fontSize="19" fill="currentColor" fontWeight="700"
            >
              {total}
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <ul className="text-sm space-y-2 flex-1 min-w-0">
        {arcs.map((a, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => a.href && router.push(a.href)}
            title={a.href ? "View details" : undefined}
            style={{
              cursor: "pointer",
              opacity: hover === null || hover === i ? 1 : 0.45,
              transition: "opacity 0.15s ease",
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: a.color }}
            />
            <span className="muted truncate flex-1 text-xs">{a.label}</span>
            <span className="tabular-nums text-xs font-semibold shrink-0">{a.value}</span>
            <span className="muted text-xs shrink-0 w-10 text-right">
              {a.pct.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── CapacityGauge ────────────────────────────────────────────────────────────
export function CapacityGauge({
  value,
  max,
  color: colorOverride,
}: {
  value: number;
  max: number;
  /** Overrides the default 3-tier teal/amber/red threshold coloring. */
  color?: string;
}) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const color = colorOverride ?? (pct < 70 ? "#14b8a6" : pct < 90 ? "#f59e0b" : "#ef4444");
  const mounted = useMounted();
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm items-center">
        <span className="muted">Occupancy</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {value}/{max}
          <span className="font-normal muted ml-1.5 text-xs">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: mounted ? `${pct}%` : "0%",
            background: color,
            transition: "width 0.85s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
export function StatusPill({
  status,
  kind = "neutral",
}: {
  status: string;
  kind?: "good" | "warn" | "bad" | "neutral";
}) {
  const cls = {
    good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bad: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    neutral: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  }[kind];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function healthKind(s?: string | null): "good" | "warn" | "bad" | "neutral" {
  if (!s) return "neutral";
  if (/healthy/i.test(s)) return "good";
  if (/sick|critical|injured/i.test(s)) return "bad";
  if (/recovering|monitor/i.test(s)) return "warn";
  return "neutral";
}

// ─── MiniDonut ────────────────────────────────────────────────────────────────
export function MiniDonut({
  value,
  max,
  size = 80,
  color,
  href,
}: {
  value: number;
  max: number;
  size?: number;
  color?: string;
  href?: string;
}) {
  const pct = max ? Math.min(1, value / max) : 0;
  const r = size / 2 - 9;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeColor =
    color || (pct < 0.7 ? "#14b8a6" : pct < 0.9 ? "#f59e0b" : "#ef4444");
  const mounted = useMounted(150);

  const body = (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="currentColor" strokeWidth="9" opacity="0.08"
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? circumference * (1 - pct) : circumference}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.95s cubic-bezier(0.4, 0, 0.2, 1) 0.1s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums">
          {(pct * 100).toFixed(0)}%
        </span>
      </div>
    </>
  );

  if (!href) {
    return (
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title="View details"
      className="relative inline-flex items-center justify-center cursor-pointer"
      style={{ width: size, height: size }}
    >
      {body}
    </Link>
  );
}

// ─── HorizontalBar ────────────────────────────────────────────────────────────
export function HorizontalBar({
  label,
  value,
  max,
  color,
  href,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  href?: string;
}) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const barColor = color || (pct < 70 ? "#14b8a6" : pct < 90 ? "#f59e0b" : "#ef4444");
  const mounted = useMounted();

  const body = (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="truncate max-w-[150px] font-medium">{label}</span>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="tabular-nums text-xs muted">{value}/{max}</span>
          <span
            className="tabular-nums text-xs font-semibold w-10 text-right"
            style={{ color: barColor }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: mounted ? `${pct}%` : "0%",
            background: barColor,
            transition: "width 0.85s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      title="View details"
      className="block rounded-lg -m-1.5 p-1.5 cursor-pointer transition-colors hover:bg-brand-500/5"
    >
      {body}
    </Link>
  );
}
