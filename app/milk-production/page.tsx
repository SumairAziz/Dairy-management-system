"use client";
import { useMemo, useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { StatCard } from "@/app/components/stat-card";
import {
  Plus,
  Trash2,
  Filter,
  X,
  Droplets,
  Users,
  TrendingUp,
  CalendarDays,
  Crown,
  Sunrise,
  Sun,
  Moon,
  Search,
  RotateCcw,
  Tag,
  Clock,
  Award,
  Check,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  MinusCircle,
} from "lucide-react";
import {
  useMilkLogs,
  useMilkStats,
  useCreateMilkLog,
  useDeleteMilkLog,
  useAnimals,
} from "@/hooks";
import type { Animal, MilkLog } from "@/types";

function animalLabel(a: Animal | undefined): string {
  if (!a) return "—";
  return a.animal_name
    ? `${a.animal_name} (${a.tag_number})`
    : `#${a.tag_number}`;
}

const sessionMeta: Record<
  string,
  { icon: typeof Sunrise; cls: string; dot: string }
> = {
  Morning: {
    icon: Sunrise,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400",
  },
  Afternoon: {
    icon: Sun,
    cls: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    dot: "bg-orange-400",
  },
  Evening: {
    icon: Moon,
    cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
    dot: "bg-indigo-400",
  },
};

function SessionBadge({ session }: { session: string }) {
  const meta = sessionMeta[session] ?? sessionMeta.Morning;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.cls}`}
    >
      <Icon size={12} />
      {session}
    </span>
  );
}

function gradeBadge(grade: string | null) {
  if (!grade)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
        <MinusCircle size={11} /> Not graded
      </span>
    );
  const map: Record<string, { cls: string; icon: typeof Check }> = {
    A: {
      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      icon: ShieldCheck,
    },
    B: {
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      icon: Check,
    },
    C: {
      cls: "bg-orange-500/15 text-orange-400 border-orange-500/20",
      icon: AlertTriangle,
    },
    Rejected: {
      cls: "bg-red-500/15 text-red-400 border-red-500/20",
      icon: X,
    },
  };
  const meta = map[grade] ?? {
    cls: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    icon: AlertTriangle,
  };
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}
    >
      <Icon size={11} />
      {grade}
    </span>
  );
}

function Th({
  children,
  icon: Icon,
  className = "",
}: {
  children: React.ReactNode;
  icon?: typeof Tag;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={13} className="text-slate-500" />}
        {children}
      </span>
    </th>
  );
}

export default function MilkProductionPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animalFilterSearch, setAnimalFilterSearch] = useState("");
  const [animalFilterOpen, setAnimalFilterOpen] = useState(false);

  const { data: animalsRes } = useAnimals({ pageSize: "1000" });
  // Only lactating animals (active females in the "Lactating" lifecycle
  // stage) should be selectable when logging a *new* milk record.
  const { data: lactatingRes } = useAnimals({
    pageSize: "1000",
    gender: "F",
    lifecycle_stage: "Lactating",
    is_active: "true",
  });

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { pageSize: "100" };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    return p;
  }, [filters]);

  const { data, isLoading } = useMilkLogs(queryParams);
  const { data: stats, isLoading: statsLoading } = useMilkStats();

  const [animalSearch, setAnimalSearch] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    animal_id: "",
    production_date: today,
    session: "Morning",
    milk_liters: "",
    quality_grade: "",
  });

  const animalList: Animal[] = animalsRes?.data ?? [];
  const lactatingAnimals: Animal[] = lactatingRes?.data ?? [];
  const records: MilkLog[] = data?.data ?? [];

  const filteredAnimalsModal = lactatingAnimals.filter((a) =>
    animalLabel(a).toLowerCase().includes(animalSearch.toLowerCase()),
  );
  const filteredAnimalsFilter = animalList.filter((a) =>
    animalLabel(a).toLowerCase().includes(animalFilterSearch.toLowerCase()),
  );
  const selectedAnimal = animalList.find(
    (a) => a.animal_id === Number(filters.animal_id),
  );

  const createMutation = useCreateMilkLog();
  const deleteMutation = useDeleteMilkLog();

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function create() {
    if (!form.animal_id) {
      setError("Please select an animal.");
      return;
    }
    if (!form.production_date) {
      setError("Please select a production date.");
      return;
    }
    if (!form.milk_liters) {
      setError("Please enter milk liters.");
      return;
    }

    createMutation.mutate(
      {
        animal_id: Number(form.animal_id),
        production_date: form.production_date,
        session: form.session as "Morning" | "Afternoon" | "Evening",
        milk_liters: Number(form.milk_liters),
        quality_grade: form.quality_grade || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            animal_id: "",
            production_date: new Date().toISOString().split("T")[0],
            session: "Morning",
            milk_liters: "",
            quality_grade: "",
          });
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function remove(id: number) {
    setDeleteId(id);
  }

  return (
    <>
      <Navbar
        title="Milk Production"
        subtitle="Track daily milk yield records"
      />
      <div className="p-6 space-y-6">
        {/* Primary stats */}
        <div className="surface border rounded-2xl grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          <StatCard
            label="Today Milk"
            value={statsLoading ? "…" : `${stats?.todayProduction ?? 0} L`}
            icon={<Droplets size={16} className="text-sky-400" />}
            iconBg="bg-sky-500/10"
          />
          <StatCard
            label="Animals (today)"
            value={statsLoading ? "…" : String(stats?.animalsMilkedToday ?? 0)}
            icon={<Users size={16} className="text-emerald-400" />}
            iconBg="bg-emerald-500/10"
          />
          <StatCard
            label="Avg Yield (today)"
            value={statsLoading ? "…" : `${stats?.avgYieldPerAnimal ?? 0} L`}
            icon={<TrendingUp size={16} className="text-violet-400" />}
            iconBg="bg-violet-500/10"
          />
          <StatCard
            label="This Month Total"
            value={statsLoading ? "…" : `${stats?.monthlyProduction ?? 0} L`}
            icon={<CalendarDays size={16} className="text-amber-400" />}
            iconBg="bg-amber-500/10"
          />
        </div>

        {/* Secondary stats */}
        <div className="surface border rounded-2xl grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          <StatCard
            label="Top Prod"
            value={stats?.topProducerLabel ?? "—"}
            icon={<Crown size={16} className="text-yellow-400" />}
            iconBg="bg-yellow-500/10"
          />
          <StatCard
            label="Morning (today)"
            value={statsLoading ? "…" : `${stats?.sessions?.Morning ?? 0} L`}
            icon={<Sunrise size={16} className="text-amber-400" />}
            iconBg="bg-amber-500/10"
          />
          <StatCard
            label="Afternoon (today)"
            value={statsLoading ? "…" : `${stats?.sessions?.Afternoon ?? 0} L`}
            icon={<Sun size={16} className="text-orange-400" />}
            iconBg="bg-orange-500/10"
          />
          <StatCard
            label="Evening (today)"
            value={statsLoading ? "…" : `${stats?.sessions?.Evening ?? 0} L`}
            icon={<Moon size={16} className="text-indigo-400" />}
            iconBg="bg-indigo-500/10"
          />
        </div>

        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg surface border text-sm font-medium transition-colors hover:bg-white/5 ${
                  showFilters ? "ring-1 ring-brand-500/40" : ""
                }`}
              >
                <Filter size={14} /> Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={() => {
                setForm({
                  animal_id: "",
                  production_date: new Date().toISOString().split("T")[0],
                  session: "Morning",
                  milk_liters: "",
                  quality_grade: "",
                });
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shadow-sm shadow-brand-600/20 transition-colors"
            >
              <Plus size={14} /> New record
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Animal">
                <div className="relative">
                  {selectedAnimal ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm">
                      <Tag size={13} className="text-teal-400 shrink-0" />
                      <span className="flex-1 text-white">
                        {animalLabel(selectedAnimal)}
                      </span>
                      <button
                        onClick={() => {
                          setFilters({ ...filters, animal_id: "" });
                          setAnimalFilterSearch("");
                        }}
                        className="text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                      />
                      <input
                        className={`${inputCls} pl-9`}
                        placeholder="Search animal…"
                        value={animalFilterSearch}
                        onFocus={() => setAnimalFilterOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setAnimalFilterOpen(false), 150)
                        }
                        onChange={(e) => {
                          setAnimalFilterSearch(e.target.value);
                          setAnimalFilterOpen(true);
                        }}
                      />
                    </div>
                  )}
                  {animalFilterOpen && !selectedAnimal && (
                    <div className="absolute z-30 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                      {filteredAnimalsFilter.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-500">
                          No animals found.
                        </div>
                      )}
                      {filteredAnimalsFilter.map((a) => (
                        <button
                          key={a.animal_id}
                          onMouseDown={() => {
                            setFilters({
                              ...filters,
                              animal_id: String(a.animal_id),
                            });
                            setAnimalFilterSearch("");
                            setAnimalFilterOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 flex items-center justify-between"
                        >
                          <span className="font-mono text-teal-400">
                            #{a.tag_number}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {a.breeds?.breed_name ?? ""} ·{" "}
                            {a.gender === "F" ? "Female" : "Male"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Session">
                <div className="relative">
                  <Clock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <select
                    className={`${inputCls} pl-9 appearance-none`}
                    value={filters.session ?? ""}
                    onChange={(e) =>
                      setFilters({ ...filters, session: e.target.value })
                    }
                  >
                    <option value="">All</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>
              </Field>
              <Field label="Date From">
                <div className="relative">
                  <CalendarDays
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"
                  />
                  <input
                    className={`${inputCls} pl-9`}
                    type="date"
                    value={filters.date_from ?? ""}
                    onChange={(e) =>
                      setFilters({ ...filters, date_from: e.target.value })
                    }
                  />
                </div>
              </Field>
              <Field label="Date To">
                <div className="relative">
                  <CalendarDays
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"
                  />
                  <input
                    className={`${inputCls} pl-9`}
                    type="date"
                    value={filters.date_to ?? ""}
                    onChange={(e) =>
                      setFilters({ ...filters, date_to: e.target.value })
                    }
                  />
                </div>
              </Field>
              <Field label="Min Milk (L)">
                <div className="relative">
                  <Droplets
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    className={`${inputCls} pl-9`}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={filters.milk_min ?? ""}
                    onChange={(e) =>
                      setFilters({ ...filters, milk_min: e.target.value })
                    }
                  />
                </div>
              </Field>
              <Field label="Max Milk (L)">
                <div className="relative">
                  <Droplets
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    className={`${inputCls} pl-9`}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="∞"
                    value={filters.milk_max ?? ""}
                    onChange={(e) =>
                      setFilters({ ...filters, milk_max: e.target.value })
                    }
                  />
                </div>
              </Field>
              <button
                onClick={() => setFilters({})}
                className="col-span-2 md:col-span-2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg surface border text-sm font-medium hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={14} /> Clear Filters
              </button>
            </div>
          )}

          {/* Records table */}
          <div className="surface border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left bg-white/[0.02] border-b border-white/10">
                <tr>
                  <Th icon={Tag}>Animal</Th>
                  <Th icon={CalendarDays}>Date</Th>
                  <Th icon={Clock}>Session</Th>
                  <Th icon={Droplets}>Milk (L)</Th>
                  <Th icon={Award}>Quality</Th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-600 border-t-brand-500 rounded-full animate-spin" />
                        Loading…
                      </div>
                    </td>
                  </tr>
                )}
                {records.map((r) => (
                  <tr
                    key={r.milk_log_id}
                    className="border-t border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                          <Tag size={13} className="text-teal-400" />
                        </div>
                        <span className="font-medium text-white">
                          {animalLabel(r.animals)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">
                      {r.production_date?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <SessionBadge session={r.session} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-white">
                        <Droplets size={13} className="text-sky-400" />
                        {Number(r.milk_liters).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{gradeBadge(r.quality_grade)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(r.milk_log_id)}
                        className="inline-flex items-center gap-1.5 text-sm text-rose-400/80 hover:text-rose-400 px-2 py-1 rounded-md hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && records.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
                          <Droplets size={18} className="text-slate-500" />
                        </div>
                        <span>No milk records found.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New record modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New milk record"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={create}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check size={14} /> Create
                </>
              )}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Animal">
              <div className="space-y-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder="Search lactating animal by name or tag…"
                    value={
                      animalSearch ||
                      (form.animal_id
                        ? animalLabel(
                            animalList.find(
                              (a) => a.animal_id === Number(form.animal_id),
                            ),
                          )
                        : "")
                    }
                    onChange={(e) => {
                      setAnimalSearch(e.target.value);
                      if (form.animal_id) setForm({ ...form, animal_id: "" });
                    }}
                  />
                </div>
                {animalSearch.trim() && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
                    {filteredAnimalsModal.length > 0 ? (
                      filteredAnimalsModal.map((a) => (
                        <button
                          key={a.animal_id}
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              animal_id: String(a.animal_id),
                            });
                            setAnimalSearch("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-white/5 last:border-b-0 flex items-center gap-2 ${form.animal_id === String(a.animal_id) ? "bg-teal-500/20 text-teal-300" : "hover:bg-white/5"}`}
                        >
                          <Tag size={13} className="text-teal-400 shrink-0" />
                          {animalLabel(a)}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-400 flex items-center gap-2">
                        <Search size={13} />
                        No lactating animals found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Field>
          </div>
          <Field label="Production date">
            <div className="relative">
              <CalendarDays
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"
              />
              <input
                className={`${inputCls} pl-9`}
                type="date"
                value={form.production_date}
                onChange={(e) =>
                  setForm({ ...form, production_date: e.target.value })
                }
              />
            </div>
          </Field>
          <Field label="Session">
            <div className="relative">
              <Clock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <select
                className={`${inputCls} pl-9 appearance-none`}
                value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })}
              >
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            </div>
          </Field>
          <Field label="Milk (L)">
            <div className="relative">
              <Droplets
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                className={`${inputCls} pl-9`}
                type="number"
                step="0.01"
                min="0"
                value={form.milk_liters}
                onChange={(e) =>
                  setForm({ ...form, milk_liters: e.target.value })
                }
              />
            </div>
          </Field>
          <Field label="Quality Grade">
            <div className="relative">
              <Award
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <select
                className={`${inputCls} pl-9 appearance-none`}
                value={form.quality_grade}
                onChange={(e) =>
                  setForm({ ...form, quality_grade: e.target.value })
                }
              >
                <option value="">Not graded</option>
                <option value="A">A - Premium</option>
                <option value="B">B - Standard</option>
                <option value="C">C - Below Standard</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onError: (err) => setError(err.message),
          })
        }
        title="Delete Milk Record"
        message="Are you sure you want to delete this milk record? This action cannot be undone."
      />
      {/* Error modal */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="surface border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle size={18} className="text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-white">
                  Something went wrong
                </h3>
                <p className="text-sm text-slate-400 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Check size={14} /> Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
