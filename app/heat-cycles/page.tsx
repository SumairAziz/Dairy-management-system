"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { StatCard } from "@/app/components/stat-card";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import {
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Flame,
  AlertTriangle,
  Heart,
  Calendar,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  useHeatCycles,
  useCreateHeatCycle,
  useUpdateHeatCycle,
  useDeleteHeatCycle,
  useAnimals,
  usePregnancyRecords,
} from "@/hooks";
import type { HeatCycleRecord } from "@/types";

const DEFAULT_CYCLE_DAYS = 21;

const DETECTION_METHODS = [
  "Visual Observation",
  "Heat Detector",
  "Vasectomized Bull",
  "Progesterone Testing",
];

// ─── Calculation helpers ──────────────────────────────────────────────────────

function diffDays(a: string | Date, b: string | Date): number {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

type HeatStatus =
  | "In Heat"
  | "Due Today"
  | "Upcoming"
  | "Overdue"
  | "Pregnant"
  | "—";

interface RowCalc {
  status: HeatStatus;
  cycleDay?: number;
  nextExpected?: string;
  daysUntil?: number;
  overdueDays?: number;
}

const STATUS_STYLE: Record<HeatStatus, { cls: string; dot: string }> = {
  "In Heat":  { cls: "bg-orange-500/15 text-orange-400", dot: "bg-orange-400" },
  "Due Today": { cls: "bg-amber-500/15 text-amber-400",  dot: "bg-amber-400" },
  "Upcoming": { cls: "bg-blue-500/15 text-blue-400",    dot: "bg-blue-400" },
  "Overdue":  { cls: "bg-red-500/15 text-red-400",      dot: "bg-red-400" },
  "Pregnant": { cls: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  "—":        { cls: "bg-slate-500/15 text-slate-400",  dot: "bg-slate-400" },
};

function StatusBadge({ status }: { status: HeatStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const defaultForm = {
  animal_id: "",
  heat_start_date: "",
  heat_end_date: "",
  detection_method: "",
  confidence_score: "",
  notes: "",
};

export default function HeatCyclesPage() {
  const router = useRouter();

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HeatCycleRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: "20",
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page],
  );

  // Paginated table data (respects filters)
  const { data, isLoading } = useHeatCycles(queryParams);
  // Full dataset for dashboard (unfiltered — React Query deduplicates same keys)
  const { data: allData } = useHeatCycles({ pageSize: "100" });
  const allRecords = useMemo(() => allData?.data ?? [], [allData]);

  const { data: animals } = useAnimals({
    pageSize: "500",
    is_active: "true",
    gender: "F",
  });
  const { data: pregData } = usePregnancyRecords({ pageSize: "500" });

  const createMutation = useCreateHeatCycle();
  const updateMutation = useUpdateHeatCycle();
  const deleteMutation = useDeleteHeatCycle();

  // ─── Dashboard computations ───────────────────────────────────────────────

  const dashboard = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    // Animals with an active CONFIRMED pregnancy only.
    // Pending pregnancies do not block heat predictions or breeding.
    const activePregs = new Set<number>();
    for (const p of pregData?.data ?? []) {
      if (!p.actual_delivery_date && p.pregnancy_confirmed === true && p.status !== "Failed") {
        activePregs.add(p.animal_id);
      }
    }

    // Group heat_start_dates by animal for cycle-length estimation
    const datesByAnimal = new Map<number, string[]>();
    for (const r of allRecords) {
      if (!r.animal_id || !r.heat_start_date) continue;
      const arr = datesByAnimal.get(r.animal_id) ?? [];
      arr.push(r.heat_start_date);
      datesByAnimal.set(r.animal_id, arr);
    }

    // Per-animal average cycle length from gap between consecutive heats
    const cycleLengthByAnimal = new Map<number, number>();
    let totalGapSum = 0;
    let totalGapCount = 0;
    for (const [animalId, dates] of datesByAnimal) {
      const sorted = [...dates].sort();
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const g = diffDays(sorted[i], sorted[i - 1]);
        if (g >= 10 && g <= 60) gaps.push(g); // sanity range for cattle
      }
      if (gaps.length > 0) {
        const avg = Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
        cycleLengthByAnimal.set(animalId, avg);
        totalGapSum += gaps.reduce((s, v) => s + v, 0);
        totalGapCount += gaps.length;
      }
    }
    const globalAvg =
      totalGapCount > 0
        ? Math.round(totalGapSum / totalGapCount)
        : DEFAULT_CYCLE_DAYS;

    // Latest heat cycle record per animal
    const latestByAnimal = new Map<number, HeatCycleRecord>();
    for (const r of allRecords) {
      if (!r.animal_id || !r.heat_start_date) continue;
      const ex = latestByAnimal.get(r.animal_id);
      if (!ex || r.heat_start_date > (ex.heat_start_date ?? "")) {
        latestByAnimal.set(r.animal_id, r);
      }
    }

    // Alert lists and summary counts
    const inHeatList: HeatCycleRecord[] = [];
    const dueSoonList: HeatCycleRecord[] = []; // within 24 h
    const overdueList: HeatCycleRecord[] = [];
    let inHeatCount = 0;
    let expectedToday = 0;
    let expectedThisWeek = 0;
    let overdueCount = 0;

    for (const [animalId, record] of latestByAnimal) {
      if (activePregs.has(animalId)) continue;
      if (!record.heat_start_date) continue;

      if (!record.heat_end_date) {
        // Currently in heat — no prediction yet
        inHeatCount++;
        inHeatList.push(record);
        continue;
      }

      const len = cycleLengthByAnimal.get(animalId) ?? globalAvg;
      const nextExp = addDays(record.heat_start_date, len);
      const daysUntil = diffDays(nextExp, today);

      if (daysUntil < 0) {
        overdueCount++;
        overdueList.push(record);
      } else if (daysUntil === 0) {
        expectedToday++;
        expectedThisWeek++;
        dueSoonList.push(record);
      } else if (daysUntil === 1) {
        expectedThisWeek++;
        dueSoonList.push(record); // tomorrow = within 24 h
      } else if (daysUntil <= 7) {
        expectedThisWeek++;
      }
    }

    // Detection method usage breakdown
    const methodCounts = new Map<string, number>();
    for (const r of allRecords) {
      const m = r.detection_method || "Unknown";
      methodCounts.set(m, (methodCounts.get(m) ?? 0) + 1);
    }
    const methodBreakdown = [...methodCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => ({ method, count }));

    return {
      activePregs,
      cycleLengthByAnimal,
      globalAvg,
      inHeatCount,
      expectedToday,
      expectedThisWeek,
      overdueCount,
      methodBreakdown,
      inHeatList,
      dueSoonList,
      overdueList,
      hasAlerts:
        inHeatList.length > 0 ||
        dueSoonList.length > 0 ||
        overdueList.length > 0,
    };
  }, [allRecords, pregData]);

  // ─── Row-level status calculation ────────────────────────────────────────

  function rowCalc(r: HeatCycleRecord): RowCalc {
    const today = new Date().toISOString().slice(0, 10);
    if (!r.heat_start_date) return { status: "—" };
    if (r.animal_id && dashboard.activePregs.has(r.animal_id))
      return { status: "Pregnant" };
    if (!r.heat_end_date) {
      return {
        status: "In Heat",
        cycleDay: Math.max(1, diffDays(today, r.heat_start_date) + 1),
      };
    }
    const len =
      dashboard.cycleLengthByAnimal.get(r.animal_id ?? 0) ??
      dashboard.globalAvg;
    const nextExp = addDays(r.heat_start_date, len);
    const daysUntil = diffDays(nextExp, today);
    if (daysUntil < 0)
      return { status: "Overdue", nextExpected: nextExp, overdueDays: -daysUntil };
    if (daysUntil === 0)
      return { status: "Due Today", nextExpected: nextExp, daysUntil: 0 };
    return { status: "Upcoming", nextExpected: nextExp, daysUntil };
  }

  function phaseLabel(calc: RowCalc): string {
    switch (calc.status) {
      case "In Heat":   return `Day ${calc.cycleDay}`;
      case "Due Today": return "Today";
      case "Upcoming":  return `In ${calc.daysUntil}d`;
      case "Overdue":   return `+${calc.overdueDays}d overdue`;
      default:          return "—";
    }
  }

  // ─── CRUD handlers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm({ ...defaultForm });
    setOpen(true);
  }

  function openEdit(record: HeatCycleRecord) {
    setEditing(record);
    setForm({
      animal_id: record.animal_id != null ? String(record.animal_id) : "",
      heat_start_date: record.heat_start_date?.slice(0, 10) ?? "",
      heat_end_date: record.heat_end_date?.slice(0, 10) ?? "",
      detection_method: record.detection_method ?? "",
      confidence_score:
        record.confidence_score != null ? String(record.confidence_score) : "",
      notes: record.notes ?? "",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm({ ...defaultForm });
  }

  function handleSubmit() {
    if (!form.animal_id) {
      alert("Please select an animal.");
      return;
    }
    if (!form.heat_start_date) {
      alert("Please enter a heat start date.");
      return;
    }
    const payload = {
      animal_id: Number(form.animal_id),
      heat_start_date: form.heat_start_date || null,
      heat_end_date: form.heat_end_date || null,
      detection_method: form.detection_method || null,
      confidence_score: form.confidence_score ? Number(form.confidence_score) : null,
      notes: form.notes || null,
    };
    const cb = {
      onSuccess: () => closeModal(),
      onError: (err: Error) => alert(err.message),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.heat_cycle_id, data: payload }, cb);
    } else {
      createMutation.mutate(payload, cb);
    }
  }

  // ─── Display helpers ──────────────────────────────────────────────────────

  function calcDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const days = diffDays(end, start);
    if (days < 0) return "—";
    return `${days} day${days !== 1 ? "s" : ""}`;
  }

  function confidenceBadge(score: number | null) {
    if (score == null) return <span className="muted text-xs">—</span>;
    const color =
      score >= 5
        ? "bg-emerald-500/15 text-emerald-400"
        : score >= 3
          ? "bg-amber-500/15 text-amber-400"
          : "bg-red-500/15 text-red-400";
    const dot =
      score >= 5 ? "bg-emerald-400" : score >= 3 ? "bg-amber-400" : "bg-red-400";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {score}
      </span>
    );
  }

  function animalLabel(r: HeatCycleRecord): string {
    if (!r.animals) return "—";
    return `#${r.animals.tag_number}${r.animals.animal_name ? ` – ${r.animals.animal_name}` : ""}`;
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const totalRecords = allRecords.length || 0;

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar
        title="Heat Cycles"
        subtitle={`${data?.total ?? 0} records · ${dashboard.globalAvg}d avg cycle`}
      />
      <div className="p-6 space-y-5">

        {/* ── Summary metrics bar ────────────────────────────────────── */}
        <div className="surface border rounded-2xl grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-white/10">
          <StatCard
            label="In Heat"
            value={dashboard.inHeatCount}
            icon={<Flame size={16} className="text-orange-400" />}
            iconBg="bg-orange-500/10"
          />
          <StatCard
            label="Due Today"
            value={dashboard.expectedToday}
            icon={<Calendar size={16} className="text-amber-400" />}
            iconBg="bg-amber-500/10"
          />
          <StatCard
            label="This Week"
            value={dashboard.expectedThisWeek}
            icon={<Clock size={16} className="text-blue-400" />}
            iconBg="bg-blue-500/10"
          />
          <StatCard
            label="Overdue"
            value={dashboard.overdueCount}
            icon={
              <AlertTriangle
                size={16}
                className={
                  dashboard.overdueCount > 0 ? "text-red-400" : "text-slate-400"
                }
              />
            }
            iconBg={
              dashboard.overdueCount > 0 ? "bg-red-500/10" : "bg-white/5"
            }
          />
          <StatCard
            label="Avg Cycle"
            value={`${dashboard.globalAvg}d`}
            icon={<TrendingUp size={16} className="text-brand-400" />}
            iconBg="bg-brand-500/10"
          />
        </div>

        {/* ── Detection methods breakdown ────────────────────────────── */}
        <div className="surface border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="muted" />
            <h4 className="text-xs uppercase tracking-wider muted font-semibold">
              Detection Methods Breakdown
            </h4>
          </div>
          {dashboard.methodBreakdown.length === 0 ? (
            <p className="text-sm muted">No detection records yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3">
              {dashboard.methodBreakdown.map(({ method, count }) => (
                <div key={method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate" title={method}>
                      {method}
                    </span>
                    <span className="muted ml-2 shrink-0">
                      {count} ({totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{
                        width: `${totalRecords > 0 ? (count / totalRecords) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Needs Attention ────────────────────────────────────────── */}
        {dashboard.hasAlerts && (
          <div className="surface border border-amber-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <h3 className="font-semibold text-sm">Needs Attention</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {/* Currently in heat */}
              {dashboard.inHeatList.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider muted">
                      Currently in Heat
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {dashboard.inHeatList.slice(0, 5).map((r) => {
                      const today = new Date().toISOString().slice(0, 10);
                      const day = Math.max(
                        1,
                        diffDays(today, r.heat_start_date!) + 1,
                      );
                      return (
                        <li
                          key={r.heat_cycle_id}
                          className="flex items-center justify-between text-xs gap-2"
                        >
                          <span className="font-medium truncate">
                            {animalLabel(r)}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="muted">Day {day}</span>
                            {r.animal_id && (
                              <button
                                onClick={() =>
                                  router.push(
                                    `/breeding?animal_id=${r.animal_id}`,
                                  )
                                }
                                className="px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 font-medium transition-colors"
                              >
                                Breed
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {dashboard.inHeatList.length > 5 && (
                      <li className="text-xs muted">
                        +{dashboard.inHeatList.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Expected within 24 h */}
              {dashboard.dueSoonList.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider muted">
                      Expected within 24 h
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {dashboard.dueSoonList.slice(0, 5).map((r) => {
                      const len =
                        dashboard.cycleLengthByAnimal.get(r.animal_id ?? 0) ??
                        dashboard.globalAvg;
                      const nextExp = addDays(r.heat_start_date!, len);
                      return (
                        <li
                          key={r.heat_cycle_id}
                          className="flex items-center justify-between text-xs gap-2"
                        >
                          <span className="font-medium truncate">
                            {animalLabel(r)}
                          </span>
                          <span className="muted shrink-0">{nextExp}</span>
                        </li>
                      );
                    })}
                    {dashboard.dueSoonList.length > 5 && (
                      <li className="text-xs muted">
                        +{dashboard.dueSoonList.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Overdue detection */}
              {dashboard.overdueList.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider muted">
                      Overdue Detection
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {dashboard.overdueList.slice(0, 5).map((r) => {
                      const today = new Date().toISOString().slice(0, 10);
                      const len =
                        dashboard.cycleLengthByAnimal.get(r.animal_id ?? 0) ??
                        dashboard.globalAvg;
                      const nextExp = addDays(r.heat_start_date!, len);
                      const overdueDays = -diffDays(nextExp, today);
                      return (
                        <li
                          key={r.heat_cycle_id}
                          className="flex items-center justify-between text-xs gap-2"
                        >
                          <span className="font-medium truncate">
                            {animalLabel(r)}
                          </span>
                          <span className="text-red-400 shrink-0">
                            +{overdueDays}d
                          </span>
                        </li>
                      );
                    })}
                    {dashboard.overdueList.length > 5 && (
                      <li className="text-xs muted">
                        +{dashboard.overdueList.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Action bar ─────────────────────────────────────────────── */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
          >
            <Filter size={14} />
            Filters
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
          >
            <Flame size={14} />
            New Heat Cycle
          </button>
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        {showFilters && (
          <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Animal">
              <select
                className={inputCls}
                value={filters.animal_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, animal_id: e.target.value });
                }}
              >
                <option value="">All</option>
                {animals?.data.map((a) => (
                  <option key={a.animal_id} value={a.animal_id}>
                    #{a.tag_number} - {a.animal_name || "Unnamed"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date From">
              <input
                className={inputCls}
                type="date"
                value={filters.date_from ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, date_from: e.target.value });
                }}
              />
            </Field>
            <Field label="Date To">
              <input
                className={inputCls}
                type="date"
                value={filters.date_to ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, date_to: e.target.value });
                }}
              />
            </Field>
            <Field label="Detection Method">
              <select
                className={inputCls}
                value={filters.detection_method ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, detection_method: e.target.value });
                }}
              >
                <option value="">All</option>
                {DETECTION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────────── */}
        <div className="surface border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead className="text-left muted border-b border-black/5 dark:border-white/10">
              <tr>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Animal</th>
                <th className="px-3 py-2.5">Start Date</th>
                <th className="px-3 py-2.5">End Date</th>
                <th className="px-3 py-2.5">Duration</th>
                <th className="px-3 py-2.5">Phase</th>
                <th className="px-3 py-2.5">Next Expected</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-8 text-center muted">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.data.map((r) => {
                const calc = rowCalc(r);
                const phase = phaseLabel(calc);
                return (
                  <tr
                    key={r.heat_cycle_id}
                    className="border-t border-black/5 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/5"
                  >
                    <td className="px-3 py-2">
                      <StatusBadge status={calc.status} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {animalLabel(r)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.heat_start_date?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.heat_end_date?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {calcDuration(r.heat_start_date, r.heat_end_date)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-medium ${
                          calc.status === "In Heat"
                            ? "text-orange-400"
                            : calc.status === "Overdue"
                              ? "text-red-400"
                              : calc.status === "Due Today"
                                ? "text-amber-400"
                                : "muted"
                        }`}
                      >
                        {phase}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums muted text-xs">
                      {calc.status === "Pregnant" ? "N/A" : (calc.nextExpected ?? "—")}
                    </td>
                    <td className="px-3 py-2 muted text-xs">
                      {r.detection_method ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {confidenceBadge(r.confidence_score)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        {r.animal_id && !dashboard.activePregs.has(r.animal_id) && (
                          <button
                            onClick={() =>
                              router.push(`/breeding?animal_id=${r.animal_id}`)
                            }
                            className="p-1.5 rounded hover:bg-brand-500/10 text-brand-400"
                            title="Breed this animal"
                          >
                            <Heart size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(r.heat_cycle_id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data && !data.data.length && !isLoading && (
                <tr>
                  <td colSpan={10} className="py-8 text-center muted">
                    No heat cycle records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────── */}
        <div className="flex justify-between items-center text-sm">
          <span className="muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded surface border disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded surface border disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Form modal (unchanged) ────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? "Edit Heat Cycle" : "New Heat Cycle"}
        footer={
          <>
            <button onClick={closeModal} className="px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-60"
            >
              {isPending
                ? editing
                  ? "Updating…"
                  : "Creating…"
                : editing
                  ? "Update"
                  : "Create"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Animal">
            <select
              className={inputCls}
              value={form.animal_id}
              onChange={(e) => setForm({ ...form, animal_id: e.target.value })}
            >
              <option value="">Select…</option>
              {animals?.data.map((a) => (
                <option key={a.animal_id} value={a.animal_id}>
                  #{a.tag_number} - {a.animal_name || "Unnamed"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detection Method">
            <select
              className={inputCls}
              value={form.detection_method}
              onChange={(e) =>
                setForm({ ...form, detection_method: e.target.value })
              }
            >
              <option value="">Select…</option>
              {DETECTION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Heat Start Date">
            <input
              className={inputCls}
              type="date"
              value={form.heat_start_date}
              onChange={(e) =>
                setForm({ ...form, heat_start_date: e.target.value })
              }
            />
          </Field>
          <Field label="Heat End Date">
            <input
              className={inputCls}
              type="date"
              value={form.heat_end_date}
              onChange={(e) =>
                setForm({ ...form, heat_end_date: e.target.value })
              }
            />
          </Field>
          <Field label="Confidence Score (0–5)">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={form.confidence_score}
              onChange={(e) =>
                setForm({ ...form, confidence_score: e.target.value })
              }
            />
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea
                className={inputCls}
                rows={3}
                value={form.notes}
                placeholder="Optional notes…"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* ── Confirm delete modal (unchanged) ─────────────────────────── */}
      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onError: (err) => alert(err.message),
          })
        }
        title="Delete Heat Cycle Record"
        message="Are you sure you want to delete this heat cycle record? This action cannot be undone."
      />
    </>
  );
}
