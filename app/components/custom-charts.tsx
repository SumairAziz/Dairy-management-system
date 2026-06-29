"use client";
import { useId, useState } from "react";

const PALETTE = ["#0d9488","#14b8a6","#2dd4bf","#5eead4","#0891b2","#6366f1","#a855f7","#ec4899","#f59e0b","#84cc16"];

export function MetricCard({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="surface border rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider muted">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-xs muted">{hint}</div>}
    </div>
  );
}

export function BarChart({ data, height = 220 }: { data: { label: string; value: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  const w = 600; const padL = 36; const padB = 30; const padT = 10;
  const innerW = w - padL - 10; const innerH = height - padB - padT;
  const bw = data.length ? innerW / data.length : 0;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      {[0,0.25,0.5,0.75,1].map((t,i)=>{
        const y = padT + innerH*(1-t);
        return <g key={i}>
          <line x1={padL} x2={w-10} y1={y} y2={y} stroke="currentColor" opacity="0.08"/>
          <text x={padL-6} y={y+3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5">{Math.round(max*t)}</text>
        </g>;
      })}
      {data.map((d,i)=>{
        const bh = (d.value/max)*innerH;
        const x = padL + i*bw + bw*0.15;
        const y = padT + innerH - bh;
        const bwActual = bw*0.7;
        return (
          <g key={i} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
            <rect x={x} y={y} width={bwActual} height={bh} rx="4" fill={PALETTE[i%PALETTE.length]} opacity={hover===null||hover===i?1:0.5}/>
            <text x={x+bwActual/2} y={height-12} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">{d.label.slice(0,12)}</text>
            {hover===i && <text x={x+bwActual/2} y={y-4} textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="600">{d.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function PieChart({ data, size = 200 }: { data: { label: string; value: number }[]; size?: number }) {
  const total = Math.max(1, data.reduce((s,d)=>s+d.value,0));
  const r = size/2 - 8; const cx = size/2; const cy = size/2;
  let acc = 0;
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const arcs = data.map((d,i)=>{
    const start = acc/total * Math.PI*2; acc += d.value;
    const end = acc/total * Math.PI*2;
    const large = end-start > Math.PI ? 1 : 0;
    const x1 = cx + r*Math.sin(start); const y1 = cy - r*Math.cos(start);
    const x2 = cx + r*Math.sin(end);   const y2 = cy - r*Math.cos(end);
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, color: PALETTE[i%PALETTE.length], label: d.label, value: d.value, pct: (d.value/total)*100 };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a,i)=>(
          <path key={i} d={a.d} fill={a.color} opacity={hover===null||hover===i?1:0.4}
            onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}/>
        ))}
        <circle cx={cx} cy={cy} r={r*0.55} fill="rgb(var(--surface))"/>
        <text x={cx} y={cy-2} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.6">{hover!==null?arcs[hover].label:"Total"}</text>
        <text x={cx} y={cy+14} textAnchor="middle" fontSize="16" fill="currentColor" fontWeight="600">{hover!==null?arcs[hover].value:total}</text>
      </svg>
      <ul className="text-sm space-y-1.5">
        {arcs.map((a,i)=>(
          <li key={i} className="flex items-center gap-2" onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
            <span className="h-3 w-3 rounded-sm" style={{background:a.color}}/>
            <span className="muted">{a.label}</span>
            <span className="ml-auto tabular-nums">{a.value} <span className="muted">({a.pct.toFixed(0)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ data, height = 220, yLabel }: { data: { label: string; value: number }[]; height?: number; yLabel?: string }) {
  if (!data.length) return <div className="text-sm muted">No data yet.</div>;
  const w = 600; const padL = 40; const padB = 28; const padT = 10;
  const innerW = w - padL - 10; const innerH = height - padB - padT;
  const max = Math.max(...data.map(d=>d.value)); const min = Math.min(...data.map(d=>d.value));
  const range = max-min || 1;
  const pts = data.map((d,i)=>({ x: padL + (i/Math.max(1,data.length-1))*innerW, y: padT + innerH - ((d.value-min)/range)*innerH, ...d }));
  const path = pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length-1].x},${padT+innerH} L${pts[0].x},${padT+innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0,0.5,1].map((t,i)=>{ const y=padT+innerH*(1-t); return <line key={i} x1={padL} x2={w-10} y1={y} y2={y} stroke="currentColor" opacity="0.08"/>; })}
      <path d={area} fill="url(#lg)"/>
      <path d={path} fill="none" stroke="#0d9488" strokeWidth="2"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#0d9488"/>
          <title>{p.label}: {p.value}{yLabel?` ${yLabel}`:""}</title>
        </g>
      ))}
      {pts.map((p,i)=> i%Math.ceil(pts.length/6)===0 ? <text key={"l"+i} x={p.x} y={height-10} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">{p.label}</text> : null)}
    </svg>
  );
}

export function CapacityGauge({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, (value/max)*100) : 0;
  const color = pct < 70 ? "#14b8a6" : pct < 90 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span className="muted">Occupancy</span><span className="font-medium">{value}/{max} ({pct.toFixed(0)}%)</span></div>
      <div className="h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
      </div>
    </div>
  );
}

export function StatusPill({ status, kind = "neutral" }: { status: string; kind?: "good"|"warn"|"bad"|"neutral" }) {
  const map = {
    good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bad: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    neutral: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  }[kind];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${map}`}>{status}</span>;
}

export function healthKind(s?: string|null): "good"|"warn"|"bad"|"neutral" {
  if (!s) return "neutral";
  if (/healthy/i.test(s)) return "good";
  if (/sick|critical|injured/i.test(s)) return "bad";
  if (/recovering|monitor/i.test(s)) return "warn";
  return "neutral";
}

const STATUS_COLORS: Record<string, string> = {
  Healthy: "#10b981",
  Recovering: "#f59e0b",
  "Under Treatment": "#f59e0b",
  Sick: "#ef4444",
  Critical: "#ef4444",
  Injured: "#ef4444",
  Monitored: "#6366f1",
  Deceased: "#6b7280",
  Pending: "#f59e0b",
  Confirmed: "#3b82f6",
  "In Progress": "#8b5cf6",
  Pregnant: "#ec4899",
  Delivered: "#10b981",
  Failed: "#ef4444",
  Success: "#10b981",
  Open: "#f59e0b",
  Closed: "#10b981",
};

export function chartColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function statusColor(label: string): string {
  return STATUS_COLORS[label] || PALETTE[0];
}

export function MiniDonut({ value, max, size = 80, color }: { value: number; max: number; size?: number; color?: string }) {
  const pct = max ? Math.min(1, value / max) : 0;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * pct;
  const strokeColor = color || (pct < 0.7 ? "#14b8a6" : pct < 0.9 ? "#f59e0b" : "#ef4444");

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="6" opacity="0.08" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={strokeColor} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference - filled}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const barColor = color || (pct < 70 ? "#14b8a6" : pct < 90 ? "#f59e0b" : "#ef4444");
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="truncate max-w-[140px]">{label}</span>
        <span className="tabular-nums muted">{value}/{max}</span>
      </div>
      <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}
