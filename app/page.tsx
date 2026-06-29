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
  statusColor,
  chartColor,
} from "@/app/components/custom-charts";
import {
  Beef,
  Building2,
  Boxes,
  Dna,
  Droplets,
  HeartPulse,
  Syringe,
  Baby,
  Flame,
  Activity,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useDashboard } from "@/hooks";

function SectionCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface border rounded-2xl p-5 ${className}`}>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, isLoading } = useDashboard();

  if (error)
    return (
      <div className="p-6 text-rose-500">
        Failed to load dashboard. Is the database running?
      </div>
    );
  if (isLoading)
    return (
      <div className="p-6 muted">Loading dashboard…</div>
    );
  if (!data) return <div className="p-6 muted">No data.</div>;

  const t = data.totals;
  const totalAnimals = t.animalCount || 1;
  const healthData = data.health.map((g) => ({
    label: g.status || "Unknown",
    value: g._count,
  }));
  const vaccTotal = data.vaccination.reduce((s, g) => s + g._count, 0);

  // Derived metrics
  const lactatingCount =
    data.lifecycleDist.find((d) => d.label === "Lactating")?.value ?? 0;
  const milkPerLactating =
    lactatingCount > 0 ? (t.dailyMilk / lactatingCount).toFixed(1) : "—";

  return (
    <>
      <Navbar title="Dashboard" subtitle="Organization-wide overview" />
      <div className="p-6 space-y-6">
        {/* ─── Row 1: KPI Metric Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Animals"
            value={t.animalCount}
            hint={`${lactatingCount} lactating`}
            icon={<Beef size={16} className="text-brand-500" />}
          />
          <MetricCard
            label="Daily Milk"
            value={`${t.dailyMilk.toFixed(1)} L`}
            hint={`${milkPerLactating} L/cow`}
            icon={<Droplets size={16} className="text-brand-500" />}
          />
          <MetricCard
            label="Pregnant"
            value={t.pregnantCount}
            hint={`${((t.pregnantCount / totalAnimals) * 100).toFixed(1)}% of herd`}
            icon={<Baby size={16} className="text-pink-500" />}
          />
          <MetricCard
            label="Farms"
            value={t.farmCount}
            hint={`${t.unitCount} units`}
            icon={<Building2 size={16} className="text-brand-500" />}
          />
          <MetricCard
            label="Species"
            value={t.speciesCount}
            hint={`${t.breedCount} breeds`}
            icon={<Dna size={16} className="text-brand-500" />}
          />
          <MetricCard
            label="Due Vaccinations"
            value={data.upcomingVaccinations}
            hint="next 7 days"
            icon={
              <Syringe
                size={16}
                className={
                  data.upcomingVaccinations > 0
                    ? "text-amber-500"
                    : "text-brand-500"
                }
              />
            }
          />
        </div>

        {/* ─── Row 2: Milk Trend (large) + Species Distribution ─── */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Milk Production — 14 Day Trend"
            icon={<TrendingUp size={16} />}
            className="lg:col-span-2"
          >
            <LineChart
              data={data.milkTrend}
              height={240}
              yLabel="L"
            />
          </SectionCard>
          <SectionCard
            title="Species Distribution"
            icon={<Dna size={16} />}
          >
            <PieChart data={data.speciesDist.filter((d) => d.value > 0)} />
          </SectionCard>
        </div>

        {/* ─── Row 3: Milk by Farm + Lifecycle Stages ─── */}
        <div className="grid lg:grid-cols-2 gap-4">
          <SectionCard
            title="Milk Production by Farm"
            icon={<BarChart3 size={16} />}
          >
            {data.milkByFarm.length > 0 ? (
              <BarChart
                data={data.milkByFarm.map((m) => ({
                  label: m.farm_name,
                  value: Math.round(m.liters),
                }))}
              />
            ) : (
              <div className="text-sm muted py-8 text-center">
                No milk production data yet.
              </div>
            )}
          </SectionCard>
          <SectionCard
            title="Lifecycle Stage Distribution"
            icon={<Activity size={16} />}
          >
            {data.lifecycleDist.length > 0 ? (
              <BarChart
                data={data.lifecycleDist}
                height={220}
              />
            ) : (
              <div className="text-sm muted py-8 text-center">
                No animal data yet.
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── Row 4: Breeding + Heat Cycles + Pregnancy Status ─── */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Breeding Results"
            icon={<HeartPulse size={16} />}
          >
            {data.breedingStats.length > 0 ? (
              <PieChart data={data.breedingStats} size={170} />
            ) : (
              <div className="text-sm muted py-6 text-center">
                No breeding records yet.
              </div>
            )}
          </SectionCard>
          <SectionCard
            title="Heat Cycle Detection Methods"
            icon={<Flame size={16} />}
          >
            {data.heatCycleByMethod.length > 0 ? (
              <BarChart
                data={data.heatCycleByMethod}
                height={180}
              />
            ) : (
              <div className="text-sm muted py-6 text-center">
                No heat cycle data yet.
              </div>
            )}
          </SectionCard>
          <SectionCard
            title="Pregnancy Status"
            icon={<Baby size={16} />}
          >
            {data.pregnancyByStatus.length > 0 ? (
              <div className="space-y-4">
                <PieChart data={data.pregnancyByStatus} size={160} />
              </div>
            ) : (
              <div className="text-sm muted py-6 text-center">
                No pregnancy records yet.
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── Row 5: Health Summary + Vaccination Progress + Farm Capacity ─── */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Health Summary"
            icon={<Activity size={16} />}
          >
            {healthData.length > 0 ? (
              <PieChart data={healthData} size={170} />
            ) : (
              <div className="text-sm muted py-6 text-center">
                No health incidents recorded.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Vaccination Coverage"
            icon={<Syringe size={16} />}
          >
            <div className="flex items-center gap-5">
              <MiniDonut
                value={vaccTotal}
                max={totalAnimals}
                size={100}
              />
              <div className="flex-1 space-y-2">
                <div className="text-2xl font-semibold">
                  {vaccTotal}
                  <span className="text-sm font-normal ml-1 muted">
                    / {totalAnimals} animals
                  </span>
                </div>
                <div className="text-xs muted">
                  {data.vaccination.length} different vaccine types administered
                </div>
                {data.upcomingVaccinations > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 mt-1">
                    <AlertTriangle size={12} />
                    {data.upcomingVaccinations} vaccination
                    {data.upcomingVaccinations === 1 ? "" : "s"} due within 7
                    days
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-1.5 max-h-[140px] overflow-y-auto">
              {data.vaccination
                .sort((a, b) => b._count - a._count)
                .slice(0, 5)
                .map((v, i) => (
                  <div
                    key={v.vaccine_name}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: chartColor(i) }}
                      />
                      <span className="truncate max-w-[160px]">
                        {v.vaccine_name || "Unknown"}
                      </span>
                    </div>
                    <span className="tabular-nums muted">{v._count}</span>
                  </div>
                ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Farm Capacity"
            icon={<Building2 size={16} />}
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
              <div className="text-sm muted py-6 text-center">
                No farm capacity data.
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── Row 6: Recently Added Animals Table ─── */}
        <SectionCard title="Recently Added Animals" icon={<Beef size={16} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left muted">
                <tr>
                  <th className="py-2 pr-3">Tag</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Species</th>
                  <th className="py-2 pr-3">Breed</th>
                  <th className="py-2 pr-3">Farm</th>
                  <th className="py-2 pr-3">Gender</th>
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Health</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((a) => (
                  <tr
                    key={a.animal_id}
                    className="border-t border-black/5 dark:border-white/10"
                  >
                    <td className="py-2 pr-3 font-medium">#{a.tag_number}</td>
                    <td className="py-2 pr-3">{a.animal_name || "—"}</td>
                    <td className="py-2 pr-3">
                      {a.breeds?.species?.species_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {a.breeds?.breed_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {a.farms?.farm_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{a.gender}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-700 dark:text-slate-300">
                        {a.lifecycle_stage}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <StatusPill
                        status={
                          a.health_incidents?.[0]?.status ?? "Healthy"
                        }
                        kind={healthKind(
                          a.health_incidents?.[0]?.status ?? "Healthy",
                        )}
                      />
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/animals/${a.animal_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}