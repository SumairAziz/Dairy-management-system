"use client";
import { MetricCard, PieChart, BarChart, HorizontalBar, EmptyState } from "@/app/components/custom-charts";
import { useAnimalStats } from "@/hooks";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import { CHART_PALETTES, colorFor } from "@/lib/theme";
import {
  Users,
  CheckCircle2,
  Droplets,
  Baby,
  Flame,
  PawPrint,
  Layers,
  Dna,
  Building2,
  Syringe,
  Heart,
  PauseCircle,
  HeartPulse,
} from "lucide-react";

/** Filter keys the quick-filter chips are allowed to own — used both to
 * highlight the active chip and to clear stale chip filters on click,
 * without touching any filter set by the Filters panel (farm, breed, etc). */
export const CHIP_FILTER_KEYS = [
  "gender",
  "pregnancy_status",
  "lifecycle_stage",
  "production_status",
  "in_heat",
  "vaccination_due",
  "breeding_eligible",
] as const;

interface Chip {
  key: string;
  label: string;
  filters: Record<string, string>;
}

const CHIPS: Chip[] = [
  { key: "all", label: "All", filters: {} },
  { key: "females", label: "Females", filters: { gender: "F" } },
  { key: "males", label: "Males", filters: { gender: "M" } },
  { key: "pregnant", label: "Pregnant", filters: { pregnancy_status: "PREGNANT" } },
  { key: "lactating", label: "Lactating", filters: { production_status: "lactating" } },
  { key: "dry", label: "Dry", filters: { production_status: "dry" } },
  { key: "calves", label: "Calves", filters: { lifecycle_stage: "Calf" } },
  { key: "in_heat", label: "In Heat", filters: { in_heat: "true" } },
  { key: "vaccination_due", label: "Vaccination Due", filters: { vaccination_due: "true" } },
  { key: "breeding_eligible", label: "Breeding Eligible", filters: { breeding_eligible: "true" } },
];

function isChipActive(chip: Chip, filters: Record<string, string>): boolean {
  if (chip.key === "all") return CHIP_FILTER_KEYS.every((k) => !filters[k]);
  const matches = Object.entries(chip.filters).every(([k, v]) => filters[k] === v);
  const noExtra = CHIP_FILTER_KEYS.filter((k) => !(k in chip.filters)).every((k) => !filters[k]);
  return matches && noExtra;
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="surface border rounded-2xl p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-4 text-sm">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="flex items-center justify-center h-[170px] gap-2 text-sm muted">
      <div className="w-4 h-4 border-2 border-black/10 dark:border-white/20 border-t-brand-500 rounded-full animate-spin" />
      Loading…
    </div>
  );
}

export function AnimalsDashboard({
  filters,
  onQuickFilter,
}: {
  filters: Record<string, string>;
  onQuickFilter: (chipFilters: Record<string, string>) => void;
}) {
  const { data: stats, isLoading, isError } = useAnimalStats();

  if (isError) {
    return (
      <div className="surface border rounded-2xl p-5">
        <EmptyState message="Couldn't load herd overview" hint="Try refreshing the page." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1 — main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Total Animals"
          value={isLoading ? "…" : (stats?.total.count ?? 0)}
          hint={stats ? `${stats.total.female} Female • ${stats.total.male} Male` : undefined}
          icon={<Users size={16} className="text-brand-500" />}
          href="/animals/list"
        />
        <MetricCard
          label="Active Animals"
          value={isLoading ? "…" : (stats?.active.count ?? 0)}
          hint={stats ? `${stats.active.inactiveCount} inactive/sold/deceased` : undefined}
          icon={<CheckCircle2 size={16} className="text-emerald-500" />}
          href={buildFilterUrl("/animals/list", { is_active: "true" })}
          tooltip="Animals currently marked active vs. inactive, sold, or deceased"
          tone="success"
        />
        <MetricCard
          label="Lactating"
          value={isLoading ? "…" : (stats?.lactating.count ?? 0)}
          hint={stats ? `${stats.lactating.percentOfHerd}% of herd` : undefined}
          icon={<Droplets size={16} className="text-sky-500" />}
          href={buildFilterUrl("/animals/list", { production_status: "lactating" })}
          tone="milk"
        />
        <MetricCard
          label="Pregnant"
          value={isLoading ? "…" : (stats?.pregnant.count ?? 0)}
          hint={stats ? `${stats.pregnant.dueWithin30Days} due within 30 days` : undefined}
          icon={<Baby size={16} className="text-purple-500" />}
          href={buildFilterUrl("/animals/list", { pregnancy_status: "PREGNANT" })}
          tone="pregnancy"
        />
        <MetricCard
          label="Animals in Heat"
          value={isLoading ? "…" : (stats?.inHeat.count ?? 0)}
          hint="Require breeding attention"
          icon={<Flame size={16} className="text-orange-500" />}
          href={buildFilterUrl("/animals/list", { in_heat: "true" })}
          tooltip="Animals with an open heat cycle — a breeding window that hasn't closed yet"
          tone="heat"
        />
        <MetricCard
          label="Calves"
          value={isLoading ? "…" : (stats?.calves.count ?? 0)}
          hint={stats ? `${stats.calves.male} Male • ${stats.calves.female} Female` : undefined}
          icon={<PawPrint size={16} className="text-amber-500" />}
          href={buildFilterUrl("/animals/list", { lifecycle_stage: "Calf" })}
        />
      </div>

      {/* Row 2 — distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Stage Distribution" icon={<Layers size={15} className="muted" />}>
          {isLoading ? (
            <ChartLoading />
          ) : (
            <PieChart
              data={(stats?.stageDistribution ?? []).map((d) => ({
                ...d,
                color: colorFor(CHART_PALETTES.stageBucket, d.label),
                href: buildFilterUrl("/animals/list", { stage_bucket: d.label }),
              }))}
              size={170}
            />
          )}
        </ChartCard>
        <ChartCard title="Breed Distribution" icon={<Dna size={15} className="muted" />}>
          {isLoading ? (
            <ChartLoading />
          ) : (
            <BarChart
              data={(stats?.breedDistribution ?? []).map((d) => ({
                ...d,
                href: d.id != null ? buildFilterUrl("/animals/list", { breed_id: d.id }) : undefined,
              }))}
              height={200}
            />
          )}
        </ChartCard>
        <ChartCard title="Farm Distribution" icon={<Building2 size={15} className="muted" />}>
          {isLoading ? (
            <ChartLoading />
          ) : stats && stats.farmDistribution.length > 0 ? (
            <div className="space-y-3">
              {stats.farmDistribution.map((f) => (
                <HorizontalBar
                  key={f.label}
                  label={f.label}
                  value={f.value}
                  max={stats.total.count || 1}
                  href={f.id != null ? buildFilterUrl("/animals/list", { farm_id: f.id }) : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No farm data" hint="Add animals to farms to see distribution." />
          )}
        </ChartCard>
      </div>

      {/* Row 3 — attention widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Vaccination Due"
          value={isLoading ? "…" : (stats?.vaccinationDue.count ?? 0)}
          hint="Overdue or upcoming"
          icon={<Syringe size={16} className="text-amber-500" />}
          href={buildFilterUrl("/animals/list", { vaccination_due: "true" })}
          tooltip="Animals with an overdue or upcoming (within 7 days) vaccination"
          tone="warning"
        />
        <MetricCard
          label="Breeding Eligible"
          value={isLoading ? "…" : (stats?.breedingEligible.count ?? 0)}
          hint="Ready to breed"
          icon={<Heart size={16} className="text-purple-500" />}
          href={buildFilterUrl("/animals/list", { breeding_eligible: "true" })}
          tooltip="Active females past minimum breeding age, not pregnant, and not in a dry/rest period"
        />
        <MetricCard
          label="Dry Animals"
          value={isLoading ? "…" : (stats?.dry.count ?? 0)}
          hint="In dry period"
          icon={<PauseCircle size={16} className="text-amber-500" />}
          href={buildFilterUrl("/animals/list", { production_status: "dry" })}
          tooltip="Animals in the pre-calving dry (rest) period"
        />
        <MetricCard
          label="Health Issues"
          value={isLoading ? "…" : (stats?.healthIssues.count ?? 0)}
          hint="Active incidents"
          icon={<HeartPulse size={16} className="text-red-500" />}
          href={buildFilterUrl("/animals/list", { has_health_issue: "true" })}
          tooltip="Animals with an active health incident or ongoing treatment"
          tone="danger"
        />
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const active = isChipActive(chip, filters);
          return (
            <button
              key={chip.key}
              onClick={() => onQuickFilter(chip.filters)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-brand-600 text-white border-brand-600"
                  : "surface border hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
