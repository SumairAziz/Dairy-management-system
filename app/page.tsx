"use client";
import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import {
  MetricCard,
  BarChart,
  PieChart,
  LineChart,
  StatusPill,
  healthKind,
  MiniDonut,
  HorizontalBar,
  EmptyState,
  chartColor,
} from "@/app/components/custom-charts";
import {
  Beef,
  Building2,
  Dna,
  Droplets,
  HeartPulse,
  Syringe,
  Baby,
  Flame,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Heart,
  CalendarDays,
  Plus,
  Milk,
  ArrowRight,
  AlertCircle,
  Info,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { useDashboard } from "@/hooks";

// ─── Section card wrapper ───────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  children,
  className = "",
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`surface border rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Alert chip ─────────────────────────────────────────────────────────────
type AlertKind = "critical" | "warning" | "info" | "success";
const ALERT_STYLES: Record<AlertKind, string> = {
  critical:
    "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/15",
  warning:
    "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/15",
  info: "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/15",
  success:
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15",
};

function AlertChip({
  kind,
  icon,
  text,
  href,
}: {
  kind: AlertKind;
  icon: React.ReactNode;
  text: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors shrink-0 ${ALERT_STYLES[kind]}`}
    >
      {icon}
      <span>{text}</span>
      <ArrowRight size={13} className="opacity-60" />
    </Link>
  );
}

// ─── Quick action button ─────────────────────────────────────────────────────
function QuickAction({
  href,
  icon,
  label,
  color = "brand",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: "bg-brand-500/10 text-brand-500 group-hover:bg-brand-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20",
    rose: "bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20",
    purple: "bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20",
    teal: "bg-teal-500/10 text-teal-500 group-hover:bg-teal-500/20",
  };
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 p-3 rounded-xl surface border hover:border-slate-500 transition-all"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${colorMap[color] ?? colorMap.brand}`}
      >
        {icon}
      </div>
      <span className="text-xs text-center muted group-hover:text-foreground transition-colors">
        {label}
      </span>
    </Link>
  );
}

// ─── Trend badge ─────────────────────────────────────────────────────────────
function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-400" : "text-rose-400"}`}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Main dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, error, isLoading } = useDashboard();

  if (error)
    return (
      <div className="p-6 text-rose-500 text-sm">
        Failed to load dashboard. Is the database running?
      </div>
    );
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64 muted text-sm">
        Loading dashboard…
      </div>
    );
  if (!data) return <div className="p-6 muted text-sm">No data.</div>;

  const t = data.totals;

  // ── Derived metrics ─────────────────────────────────────────────────────
  const todayMilk = data.milkTrend.at(-1)?.value ?? 0;
  const yesterdayMilk = data.milkTrend.at(-2)?.value ?? 0;
  const milkDeltaPct =
    yesterdayMilk > 0
      ? ((todayMilk - yesterdayMilk) / yesterdayMilk) * 100
      : null;

  const lactatingCount =
    data.lifecycleDist.find((d) => d.label === "Lactating")?.value ?? 0;
  const milkPerLactating =
    lactatingCount > 0 ? (todayMilk / lactatingCount).toFixed(1) : "—";

  const confirmedPregs =
    data.pregnancyByStatus.find((g) => g.label === "Confirmed")?.value ??
    t.pregnantCount;
  const pendingPregs =
    data.pregnancyByStatus.find((g) => g.label === "Pending")?.value ?? 0;

  const sickAnimalCount = data.health
    .filter((g) =>
      ["Sick", "Critical", "Injured"].includes(g.status || ""),
    )
    .reduce((s, g) => s + g._count, 0);

  const openIncidents = data.health
    .filter((g) => ["Open", "In Progress"].includes(g.status || ""))
    .reduce((s, g) => s + g._count, 0);

  const pendingBreedings =
    data.breedingStats.find((g) => g.label === "Pending")?.value ?? 0;

  const vaccTotal = data.vaccination.reduce((s, g) => s + g._count, 0);
  const dueSoonVacc = Math.max(
    0,
    data.upcomingVaccinations - data.overdueVaccinations,
  );

  const totalAlerts =
    sickAnimalCount +
    openIncidents +
    data.overdueVaccinations +
    dueSoonVacc +
    data.animalsInHeat +
    data.upcomingDeliveries +
    pendingBreedings;

  // ── Alert definitions ───────────────────────────────────────────────────
  const alerts: Array<{
    kind: AlertKind;
    icon: React.ReactNode;
    text: string;
    href: string;
  }> = [];

  if (sickAnimalCount > 0)
    alerts.push({
      kind: "critical",
      icon: <AlertCircle size={14} />,
      text: `${sickAnimalCount} animal${sickAnimalCount > 1 ? "s" : ""} with active health issue${sickAnimalCount > 1 ? "s" : ""}`,
      href: "/animals",
    });

  if (data.overdueVaccinations > 0)
    alerts.push({
      kind: "critical",
      icon: <Syringe size={14} />,
      text: `${data.overdueVaccinations} vaccination${data.overdueVaccinations > 1 ? "s" : ""} overdue`,
      href: "/vaccinations",
    });

  if (dueSoonVacc > 0)
    alerts.push({
      kind: "warning",
      icon: <Syringe size={14} />,
      text: `${dueSoonVacc} vaccination${dueSoonVacc > 1 ? "s" : ""} due within 7 days`,
      href: "/vaccinations",
    });

  if (data.animalsInHeat > 0)
    alerts.push({
      kind: "info",
      icon: <Flame size={14} />,
      text: `${data.animalsInHeat} animal${data.animalsInHeat > 1 ? "s" : ""} currently in heat`,
      href: "/heat-cycles",
    });

  if (data.upcomingDeliveries > 0)
    alerts.push({
      kind: "info",
      icon: <Baby size={14} />,
      text: `${data.upcomingDeliveries} deliver${data.upcomingDeliveries > 1 ? "ies" : "y"} expected within 30 days`,
      href: "/pregnancy",
    });

  if (pendingBreedings > 0)
    alerts.push({
      kind: "warning",
      icon: <Heart size={14} />,
      text: `${pendingBreedings} breeding result${pendingBreedings > 1 ? "s" : ""} pending confirmation`,
      href: "/breeding",
    });

  const healthData = data.health.map((g) => ({
    label: g.status || "Unknown",
    value: g._count,
  }));

  return (
    <>
      <Navbar title="Dashboard" subtitle="Farm command center" />
      <div className="p-6 space-y-5">

        {/* ── Alerts bar ─────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="surface border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle
                size={14}
                className={
                  alerts.some((a) => a.kind === "critical")
                    ? "text-rose-400"
                    : "text-amber-400"
                }
              />
              <span className="text-xs font-semibold uppercase tracking-wider muted">
                {totalAlerts} action
                {totalAlerts !== 1 ? "s" : ""} require attention
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <AlertChip key={i} {...a} />
              ))}
            </div>
          </div>
        )}

        {/* ── KPI row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Active Animals"
            value={t.animalCount}
            hint={`${lactatingCount} lactating`}
            icon={<Beef size={16} className="text-brand-500" />}
          />
          <div className="surface border rounded-2xl p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider muted">
                Today&apos;s Milk
              </span>
              <Droplets size={16} className="text-brand-500" />
            </div>
            <div className="text-3xl font-semibold tracking-tight">
              {todayMilk.toFixed(1)}
              <span className="text-base font-normal ml-1 muted">L</span>
            </div>
            <div className="flex items-center gap-2 text-xs muted">
              <span>{milkPerLactating} L/cow</span>
              <TrendBadge pct={milkDeltaPct} />
            </div>
          </div>
          <MetricCard
            label="Confirmed Pregnant"
            value={confirmedPregs}
            hint={`${pendingPregs} pending confirmation`}
            icon={<Baby size={16} className="text-pink-500" />}
          />
          <MetricCard
            label="Due in 30 Days"
            value={data.upcomingDeliveries}
            hint="expected deliveries"
            icon={
              <CalendarDays
                size={16}
                className={
                  data.upcomingDeliveries > 0
                    ? "text-purple-400"
                    : "text-brand-500"
                }
              />
            }
          />
          <MetricCard
            label="Vaccination Alerts"
            value={data.upcomingVaccinations}
            hint={
              data.overdueVaccinations > 0
                ? `${data.overdueVaccinations} overdue`
                : "due within 7 days"
            }
            icon={
              <Syringe
                size={16}
                className={
                  data.overdueVaccinations > 0
                    ? "text-rose-500"
                    : data.upcomingVaccinations > 0
                      ? "text-amber-500"
                      : "text-brand-500"
                }
              />
            }
          />
          <MetricCard
            label="Health Issues"
            value={sickAnimalCount + openIncidents}
            hint={
              sickAnimalCount > 0
                ? `${sickAnimalCount} sick/critical`
                : "no active incidents"
            }
            icon={
              <HeartPulse
                size={16}
                className={
                  sickAnimalCount > 0
                    ? "text-rose-500"
                    : openIncidents > 0
                      ? "text-amber-500"
                      : "text-brand-500"
                }
              />
            }
          />
        </div>

        {/* ── Milk trend + Quick actions ───────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Milk Production — 14 Day Trend"
            icon={<TrendingUp size={15} className="muted" />}
            className="lg:col-span-2"
            action={
              <Link
                href="/milk-production"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View all <ArrowRight size={11} />
              </Link>
            }
          >
            <LineChart data={data.milkTrend} height={240} yLabel="L" />
          </SectionCard>

          <SectionCard
            title="Quick Actions"
            icon={<Zap size={15} className="muted" />}
          >
            <div className="grid grid-cols-3 gap-2">
              <QuickAction
                href="/animals"
                icon={<Plus size={16} />}
                label="New Animal"
                color="brand"
              />
              <QuickAction
                href="/milk-production"
                icon={<Milk size={16} />}
                label="Log Milk"
                color="teal"
              />
              <QuickAction
                href="/breeding"
                icon={<Heart size={16} />}
                label="Breeding"
                color="rose"
              />
              <QuickAction
                href="/vaccinations"
                icon={<Syringe size={16} />}
                label="Vaccinate"
                color="amber"
              />
              <QuickAction
                href="/pregnancy"
                icon={<Baby size={16} />}
                label="Pregnancy"
                color="purple"
              />
              <QuickAction
                href="/heat-cycles"
                icon={<Flame size={16} />}
                label="Heat Cycle"
                color="emerald"
              />
            </div>

            {/* Summary stats */}
            <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="muted">Farms</span>
                <span className="font-medium">
                  {t.farmCount}
                  <span className="muted ml-1 text-xs">
                    ({t.unitCount} units)
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="muted">Species / Breeds</span>
                <span className="font-medium">
                  {t.speciesCount} /{" "}
                  <span className="muted text-xs">{t.breedCount}</span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="muted">In Heat Now</span>
                <span
                  className={`font-medium ${data.animalsInHeat > 0 ? "text-teal-400" : ""}`}
                >
                  {data.animalsInHeat}
                  <span className="muted ml-1 text-xs">animals</span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="muted">Total Milk (all-time)</span>
                <span className="font-medium tabular-nums">
                  {t.dailyMilk.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  <span className="muted ml-1 text-xs">L</span>
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Reproductive health ──────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Breeding Results"
            icon={<Heart size={15} className="muted" />}
            action={
              <Link
                href="/breeding"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            <PieChart data={data.breedingStats} size={170} />
          </SectionCard>

          <SectionCard
            title="Pregnancy Status"
            icon={<Baby size={15} className="muted" />}
            action={
              <Link
                href="/pregnancy"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            <PieChart data={data.pregnancyByStatus} size={170} />
          </SectionCard>

          <SectionCard
            title="Heat Cycle Methods"
            icon={<Flame size={15} className="muted" />}
            action={
              <Link
                href="/heat-cycles"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            <BarChart data={data.heatCycleByMethod} height={200} />
          </SectionCard>
        </div>

        {/* ── Farm capacity + Lifecycle ─────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-4">
          <SectionCard
            title="Farm Capacity Utilization"
            icon={<Building2 size={15} className="muted" />}
            action={
              <Link
                href="/farms"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            {data.farmCapacity.length > 0 ? (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {data.farmCapacity.map((f) => (
                  <HorizontalBar
                    key={f.label}
                    label={f.label}
                    value={f.value}
                    max={f.max}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No farm capacity data" hint="Add units to farms to see capacity utilization." />
            )}
          </SectionCard>

          <SectionCard
            title="Lifecycle Stage Distribution"
            icon={<Activity size={15} className="muted" />}
            action={
              <Link
                href="/animals"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            <BarChart data={data.lifecycleDist} height={220} />
          </SectionCard>
        </div>

        {/* ── Milk by farm + Species + Health ─────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Milk by Farm"
            icon={<BarChart3 size={15} className="muted" />}
            action={
              <Link
                href="/milk-production"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            <BarChart
              data={data.milkByFarm.map((m) => ({
                label: m.farm_name,
                value: Math.round(m.liters),
              }))}
              height={200}
            />
          </SectionCard>

          <SectionCard
            title="Species Distribution"
            icon={<Dna size={15} className="muted" />}
          >
            <PieChart
              data={data.speciesDist.filter((d) => d.value > 0)}
              size={170}
            />
          </SectionCard>

          <SectionCard
            title="Health Summary"
            icon={<Activity size={15} className="muted" />}
            action={
              <Link
                href="/animals"
                className="text-xs muted hover:opacity-80 flex items-center gap-1"
              >
                View <ArrowRight size={11} />
              </Link>
            }
          >
            <PieChart data={healthData} size={170} />
          </SectionCard>
        </div>

        {/* ── Vaccination coverage ─────────────────────────────────────── */}
        <SectionCard
          title="Vaccination Coverage"
          icon={<Syringe size={15} className="muted" />}
          action={
            <Link
              href="/vaccinations"
              className="text-xs muted hover:opacity-80 flex items-center gap-1"
            >
              Manage <ArrowRight size={11} />
            </Link>
          }
        >
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Donut + numbers */}
            <div className="flex items-center gap-5 shrink-0">
              <MiniDonut value={vaccTotal} max={t.animalCount} size={100} />
              <div className="space-y-1">
                <div className="text-2xl font-semibold tabular-nums">
                  {vaccTotal}
                  <span className="text-sm font-normal ml-1 muted">
                    / {t.animalCount}
                  </span>
                </div>
                <div className="text-xs muted">
                  {t.animalCount > 0
                    ? `${((vaccTotal / t.animalCount) * 100).toFixed(0)}% coverage`
                    : "No animals"}
                </div>
                <div className="text-xs muted">
                  {data.vaccination.length} vaccine types on record
                </div>
                {data.overdueVaccinations > 0 && (
                  <div className="flex items-center gap-1 text-xs text-rose-400">
                    <AlertCircle size={11} />
                    {data.overdueVaccinations} overdue
                  </div>
                )}
                {dueSoonVacc > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle size={11} />
                    {dueSoonVacc} due within 7 days
                  </div>
                )}
                {data.upcomingVaccinations === 0 && (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 size={11} />
                    All vaccinations up to date
                  </div>
                )}
              </div>
            </div>

            {/* Top vaccines list */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="text-[10px] uppercase tracking-widest muted font-semibold mb-2">
                Top vaccines administered
              </div>
              {data.vaccination
                .sort((a, b) => b._count - a._count)
                .slice(0, 6)
                .map((v, i) => {
                  const maxCount = data.vaccination[0]._count;
                  return (
                    <div key={v.vaccine_name} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: chartColor(i) }}
                      />
                      <span className="flex-1 truncate">
                        {v.vaccine_name || "Unknown"}
                      </span>
                      <div className="w-24 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(v._count / maxCount) * 100}%`,
                            background: chartColor(i),
                          }}
                        />
                      </div>
                      <span className="tabular-nums muted text-xs w-6 text-right">
                        {v._count}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </SectionCard>

        {/* ── Recently added animals ───────────────────────────────────── */}
        <SectionCard
          title="Recently Added Animals"
          icon={<Beef size={15} className="muted" />}
          action={
            <Link
              href="/animals"
              className="text-xs muted hover:opacity-80 flex items-center gap-1"
            >
              View all <ArrowRight size={11} />
            </Link>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest muted border-b border-black/5 dark:border-white/10">
                  <th className="text-left py-2.5 pr-4">Tag</th>
                  <th className="text-left py-2.5 pr-4">Name</th>
                  <th className="text-left py-2.5 pr-4">Species / Breed</th>
                  <th className="text-left py-2.5 pr-4">Farm</th>
                  <th className="text-left py-2.5 pr-4">Gender</th>
                  <th className="text-left py-2.5 pr-4">Stage</th>
                  <th className="text-left py-2.5 pr-4">Health</th>
                  <th className="py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.recent.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-sm muted"
                    >
                      No animals yet. Add your first animal to get started.
                    </td>
                  </tr>
                )}
                {data.recent.map((a) => {
                  const healthStatus =
                    a.health_incidents?.[0]?.status ?? "Healthy";
                  return (
                    <tr
                      key={a.animal_id}
                      className="border-t border-black/5 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-brand-600 font-medium">
                        #{a.tag_number}
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {a.animal_name || (
                          <span className="muted italic text-xs">Unnamed</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          {a.breeds?.breed_name ?? "—"}
                        </div>
                        <div className="text-xs muted">
                          {a.breeds?.species?.species_name}
                        </div>
                      </td>
                      <td className="py-3 pr-4 muted">
                        {a.farms?.farm_name ?? "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.gender === "M" ? "bg-blue-500/10 text-blue-400" : "bg-pink-500/10 text-pink-400"}`}
                        >
                          {a.gender === "M" ? "Male" : "Female"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-500/10 text-slate-400">
                          {a.lifecycle_stage}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill
                          status={healthStatus}
                          kind={healthKind(healthStatus)}
                        />
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/animals/${a.animal_id}`}
                          className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-400 font-medium transition-colors"
                        >
                          View <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.recent.length > 0 && (
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs muted">
                Showing {data.recent.length} most recently added animals
              </span>
              <Link
                href="/animals"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors"
              >
                <Plus size={12} /> Add Animal
              </Link>
            </div>
          )}
        </SectionCard>

        {/* ── System info strip ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 px-1 text-xs muted">
          <span className="flex items-center gap-1.5">
            <Info size={11} />
            Dashboard refreshes with live data on each page load.
          </span>
          <span>·</span>
          <span>
            {t.farmCount} farm{t.farmCount !== 1 ? "s" : ""} ·{" "}
            {t.unitCount} unit{t.unitCount !== 1 ? "s" : ""} ·{" "}
            {t.animalCount} animal{t.animalCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </>
  );
}
