"use client";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { StatCard } from "@/app/components/stat-card";
import { AnimalCombobox } from "@/app/components/animal-combobox";
import {
  Plus,
  Trash2,
  Pencil,
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
  Award,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle2,
} from "lucide-react";
import {
  useDailyMilkLogs,
  useMilkLogs,
  useMilkStats,
  useCreateMilkLog,
  useDeleteMilkLog,
  useUpsertDailyMilkLog,
  useDeleteDailyMilkLog,
  useAnimals,
  useUrlFilters,
} from "@/hooks";
import type { Animal, DailyMilkRecord } from "@/types";
import { milkGradeStyle } from "@/lib/milk-quality";
import { TABLE_ROW } from "@/lib/theme";
import { UniversalExportButton } from "@/components/export/UniversalExportButton";

const SESSIONS = ["Morning", "Afternoon", "Evening"] as const;
type Session = (typeof SESSIONS)[number];

function animalLabel(a: Animal | undefined): string {
  if (!a) return "—";
  return a.animal_name ? `${a.animal_name} (${a.tag_number})` : `#${a.tag_number}`;
}

function dailyRecordLabel(r: { tag_number: string; animal_name: string | null }): string {
  return r.animal_name ? `${r.animal_name} (${r.tag_number})` : `#${r.tag_number}`;
}

const sessionMeta: Record<Session, { icon: typeof Sunrise; cls: string }> = {
  Morning: { icon: Sunrise, cls: "text-amber-400" },
  Afternoon: { icon: Sun, cls: "text-orange-400" },
  Evening: { icon: Moon, cls: "text-indigo-400" },
};

function gradeBadge(grade: string | null) {
  const style = milkGradeStyle(grade);
  const Icon = style.icon;
  const textSize = grade ? "text-xs" : "text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${textSize} font-medium border ${style.cls}`}>
      <Icon size={11} /> {style.label}
    </span>
  );
}

function sessionCell(value: number | null) {
  if (value == null) return <span className="muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Droplets size={12} className="text-sky-400" />
      {value.toFixed(2)}
    </span>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}>
      {children}
    </th>
  );
}

type EditTarget = { animal_id: number; production_date: string; label: string };
type DeleteTarget = DailyMilkRecord;

/* ------------------------------------------------------------------ */
/* Edit Day modal — one form for Morning/Afternoon/Evening/Quality/Notes */
/* ------------------------------------------------------------------ */

function EditDayModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: EditTarget | null;
}) {
  const enabled = open && !!target;
  const { data, isLoading } = useDailyMilkLogs(
    target ? { animal_id: String(target.animal_id), date_from: target.production_date, date_to: target.production_date } : {},
    { enabled },
  );
  const record = data?.data?.[0];
  const upsertMutation = useUpsertDailyMilkLog();
  const [form, setForm] = useState({ morning: "", afternoon: "", evening: "", quality_grade: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      morning: record?.morning != null ? String(record.morning) : "",
      afternoon: record?.afternoon != null ? String(record.afternoon) : "",
      evening: record?.evening != null ? String(record.evening) : "",
      quality_grade: record?.quality_grade ?? "",
      notes: record?.notes ?? "",
    });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.animal_id, record?.production_date, record?.morning, record?.afternoon, record?.evening]);

  if (!open || !target) return null;

  function save() {
    if (!target) return;
    upsertMutation.mutate(
      {
        animal_id: target.animal_id,
        production_date: target.production_date,
        morning: form.morning === "" ? null : Number(form.morning),
        afternoon: form.afternoon === "" ? null : Number(form.afternoon),
        evening: form.evening === "" ? null : Number(form.evening),
        quality_grade: form.quality_grade || null,
        notes: form.notes || null,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Daily Record — ${target.label}`}
      footer={
        <>
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
            <X size={14} /> Cancel
          </button>
          <button
            onClick={save}
            disabled={upsertMutation.isPending || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {upsertMutation.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check size={14} /> Save
              </>
            )}
          </button>
        </>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm muted">Loading…</div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs muted">Production date: {target.production_date}</p>
          <div className="grid grid-cols-3 gap-3">
            {SESSIONS.map((s) => {
              const Icon = sessionMeta[s].icon;
              return (
                <Field key={s} label={s}>
                  <div className="relative">
                    <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${sessionMeta[s].cls}`} />
                    <input
                      className={`${inputCls} pl-9`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="—"
                      value={form[s.toLowerCase() as "morning" | "afternoon" | "evening"]}
                      onChange={(e) => setForm({ ...form, [s.toLowerCase()]: e.target.value })}
                    />
                  </div>
                </Field>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quality Grade">
              <div className="relative">
                <Award size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <select
                  className={`${inputCls} pl-9 appearance-none`}
                  value={form.quality_grade}
                  onChange={(e) => setForm({ ...form, quality_grade: e.target.value })}
                >
                  <option value="">Not graded</option>
                  <option value="A">A - Premium</option>
                  <option value="B">B - Standard</option>
                  <option value="C">C - Below Standard</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </Field>
            <Field label="Notes">
              <input
                className={inputCls}
                placeholder="Optional notes…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <p className="text-xs muted">Clear a session's field to remove that session's record entirely.</p>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Delete modal — delete one session, or the whole day                */
/* ------------------------------------------------------------------ */

function DeleteDayModal({ open, onClose, record }: { open: boolean; onClose: () => void; record: DeleteTarget | null }) {
  const deleteSessionMutation = useDeleteMilkLog();
  const deleteDayMutation = useDeleteDailyMilkLog();
  const [error, setError] = useState<string | null>(null);

  if (!open || !record) return null;

  const sessions: Array<{ key: Session; value: number | null; id: number | null }> = [
    { key: "Morning", value: record.morning, id: record.morning_id },
    { key: "Afternoon", value: record.afternoon, id: record.afternoon_id },
    { key: "Evening", value: record.evening, id: record.evening_id },
  ];
  const busy = deleteSessionMutation.isPending || deleteDayMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Milk Record"
      footer={
        <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
          <X size={14} /> Close
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm">
          <span className="font-medium">{dailyRecordLabel(record)}</span> · {record.production_date}
        </p>

        <div className="space-y-2">
          {sessions.map((s) => {
            const Icon = sessionMeta[s.key].icon;
            return (
              <div key={s.key} className="flex items-center justify-between p-3 rounded-lg surface border">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Icon size={14} className={sessionMeta[s.key].cls} />
                  {s.key}: {s.value != null ? `${s.value.toFixed(2)} L` : "not recorded"}
                </span>
                {s.id != null && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      deleteSessionMutation.mutate(s.id!, {
                        onSuccess: onClose,
                        onError: (err) => setError(err.message),
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-xs text-rose-400/80 hover:text-rose-400 px-2 py-1 rounded-md hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete {s.key}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          disabled={busy}
          onClick={() =>
            deleteDayMutation.mutate(
              { animal_id: record.animal_id, production_date: record.production_date },
              { onSuccess: onClose, onError: (err) => setError(err.message) },
            )
          }
          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          <Trash2 size={14} /> Delete entire day (all sessions)
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

const MILK_FILTER_KEYS = ["animal_id", "farm_id", "date_from", "date_to", "search"] as const;

export default function MilkProductionPage() {
  const today = new Date().toISOString().split("T")[0];

  const [filters, setFilters] = useUrlFilters(MILK_FILTER_KEYS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ session: string; animal_id: number; production_date: string } | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [form, setForm] = useState({ animal_id: "", production_date: today, session: "Morning" as Session, milk_liters: "", quality_grade: "" });

  const { data: animalsRes } = useAnimals({ pageSize: "1000" });
  const { data: lactatingRes } = useAnimals({
    pageSize: "1000",
    gender: "F",
    production_status: "lactating",
    is_active: "true",
  });
  const { data: dryRes } = useAnimals({
    pageSize: "1000",
    gender: "F",
    production_status: "dry",
    is_active: "true",
  });
  const animalList: Animal[] = animalsRes?.data ?? [];
  const lactatingAnimals: Animal[] = lactatingRes?.data ?? [];
  const dryAnimals: Animal[] = dryRes?.data ?? [];

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: "20" };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    return p;
  }, [filters, page]);

  const { data, isLoading } = useDailyMilkLogs(queryParams);
  const { data: stats, isLoading: statsLoading } = useMilkStats();
  const records: DailyMilkRecord[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Which sessions already exist for the animal+date currently picked in the form.
  const sessionCheckEnabled = !!form.animal_id && !!form.production_date;
  const { data: sessionCheckData } = useMilkLogs(
    { animal_id: form.animal_id, date_from: form.production_date, date_to: form.production_date },
    { enabled: sessionCheckEnabled },
  );
  const existingSessions = useMemo(() => new Set((sessionCheckData?.data ?? []).map((r) => r.session)), [sessionCheckData]);

  // If the selected session becomes unavailable (already recorded), jump to the next free one.
  useEffect(() => {
    if (existingSessions.size === 0) return;
    if (!existingSessions.has(form.session)) return;
    const next = SESSIONS.find((s) => !existingSessions.has(s));
    if (next) setForm((f) => ({ ...f, session: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSessions]);

  const createMutation = useCreateMilkLog();
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function resetForm() {
    setForm({ animal_id: "", production_date: today, session: "Morning", milk_liters: "", quality_grade: "" });
  }

  function create() {
    if (!form.animal_id) return setError("Please select an animal.");
    if (!form.production_date) return setError("Please select a production date.");
    if (!form.milk_liters) return setError("Please enter milk liters.");
    if (existingSessions.has(form.session)) {
      setDuplicateInfo({ session: form.session, animal_id: Number(form.animal_id), production_date: form.production_date });
      return;
    }

    createMutation.mutate(
      {
        animal_id: Number(form.animal_id),
        production_date: form.production_date,
        session: form.session,
        milk_liters: Number(form.milk_liters),
        quality_grade: form.quality_grade || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
        onError: (err) => {
          if (err.message.toLowerCase().includes("already exists")) {
            setDuplicateInfo({ session: form.session, animal_id: Number(form.animal_id), production_date: form.production_date });
          } else {
            setError(err.message);
          }
        },
      },
    );
  }

  function openEditFor(animal_id: number, production_date: string, label: string) {
    setDuplicateInfo(null);
    setOpen(false);
    setEditTarget({ animal_id, production_date, label });
  }

  return (
    <>
      <Navbar title="Milk Production" subtitle="Daily milk register — one row per animal per day" />
      <div className="p-6 space-y-6">
        {/* Primary stats */}
        <div className="surface border rounded-2xl grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          <StatCard label="Today Milk" value={statsLoading ? "…" : `${stats?.todayProduction ?? 0} L`} icon={<Droplets size={16} className="text-sky-400" />} iconBg="bg-sky-500/10" />
          <StatCard label="Animals (today)" value={statsLoading ? "…" : String(stats?.animalsMilkedToday ?? 0)} icon={<Users size={16} className="text-emerald-400" />} iconBg="bg-emerald-500/10" />
          <StatCard label="Avg Yield (today)" value={statsLoading ? "…" : `${stats?.avgYieldPerAnimal ?? 0} L`} icon={<TrendingUp size={16} className="text-violet-400" />} iconBg="bg-violet-500/10" />
          <StatCard label="This Month Total" value={statsLoading ? "…" : `${stats?.monthlyProduction ?? 0} L`} icon={<CalendarDays size={16} className="text-amber-400" />} iconBg="bg-amber-500/10" />
        </div>

        {/* Secondary stats */}
        <div className="surface border rounded-2xl grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          <StatCard label="Top Prod" value={stats?.topProducerLabel ?? "—"} icon={<Crown size={16} className="text-yellow-400" />} iconBg="bg-yellow-500/10" />
          <StatCard label="Morning (today)" value={statsLoading ? "…" : `${stats?.sessions?.Morning ?? 0} L`} icon={<Sunrise size={16} className="text-amber-400" />} iconBg="bg-amber-500/10" />
          <StatCard label="Afternoon (today)" value={statsLoading ? "…" : `${stats?.sessions?.Afternoon ?? 0} L`} icon={<Sun size={16} className="text-orange-400" />} iconBg="bg-orange-500/10" />
          <StatCard label="Evening (today)" value={statsLoading ? "…" : `${stats?.sessions?.Evening ?? 0} L`} icon={<Moon size={16} className="text-indigo-400" />} iconBg="bg-indigo-500/10" />
        </div>

        <div className="space-y-4">
          {dryAnimals.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm">
              <span className="text-amber-300">
                {dryAnimals.length} dry {dryAnimals.length === 1 ? "animal" : "animals"} excluded from new milk entry
              </span>
              <a
                href="/animals/list?production_status=dry"
                className="text-amber-400 hover:underline shrink-0"
              >
                View dry animals
              </a>
            </div>
          )}

          {/* Action bar */}
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg surface border text-sm font-medium transition-colors hover:bg-white/5 ${showFilters ? "ring-1 ring-brand-500/40" : ""}`}
            >
              <Filter size={14} /> Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <UniversalExportButton resource="milk" filters={filters} />
              <button
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shadow-sm shadow-brand-600/20 transition-colors"
              >
                <Plus size={14} /> New record
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Animal">
                <AnimalCombobox
                  animals={animalList}
                  value={filters.animal_id ?? ""}
                  onChange={(id) => {
                    setPage(1);
                    setFilters({ ...filters, animal_id: id });
                  }}
                />
              </Field>
              <Field label="Search tag / name">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder="Search…"
                    value={filters.search ?? ""}
                    onChange={(e) => {
                      setPage(1);
                      setFilters({ ...filters, search: e.target.value });
                    }}
                  />
                </div>
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
              <button
                onClick={() => {
                  setPage(1);
                  setFilters({});
                }}
                className="col-span-2 md:col-span-4 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg surface border text-sm font-medium hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={14} /> Clear Filters
              </button>
            </div>
          )}

          {/* Records table */}
          <div className="surface border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left surface-2 border-b border-white/10">
                <tr>
                  <Th>Animal</Th>
                  <Th>Date</Th>
                  <Th>Morning (L)</Th>
                  <Th>Afternoon (L)</Th>
                  <Th>Evening (L)</Th>
                  <Th>Total Milk</Th>
                  <Th>Quality</Th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-600 border-t-brand-500 rounded-full animate-spin" />
                        Loading…
                      </div>
                    </td>
                  </tr>
                )}
                {records.map((r) => (
                  <tr key={`${r.animal_id}-${r.production_date}`} className={TABLE_ROW}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                          <Tag size={13} className="text-teal-400" />
                        </div>
                        <span className="font-medium">{dailyRecordLabel(r)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 muted tabular-nums">{r.production_date}</td>
                    <td className="px-4 py-3">{sessionCell(r.morning)}</td>
                    <td className="px-4 py-3">{sessionCell(r.afternoon)}</td>
                    <td className="px-4 py-3">{sessionCell(r.evening)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                        <Droplets size={13} className="text-sky-400" />
                        {r.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{gradeBadge(r.quality_grade)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditFor(r.animal_id, r.production_date, dailyRecordLabel(r))}
                        className="inline-flex items-center gap-1.5 text-sm text-brand-400/90 hover:text-brand-400 px-2 py-1 rounded-md hover:bg-brand-500/10 transition-colors"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="inline-flex items-center gap-1.5 text-sm text-rose-400/80 hover:text-rose-400 px-2 py-1 rounded-md hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
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
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-slate-400">
                <span>
                  Page {page} of {totalPages} · {total} record{total !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-md surface border hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-md surface border hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
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
            <button onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
              <X size={14} /> Cancel
            </button>
            <button
              onClick={create}
              disabled={createMutation.isPending || existingSessions.size === 3}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check size={14} /> Save
                </>
              )}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Animal (lactating only)">
              <AnimalCombobox
                animals={lactatingAnimals}
                value={form.animal_id}
                onChange={(id) => setForm({ ...form, animal_id: id })}
                placeholder="Search lactating animal by name or tag…"
              />
            </Field>
          </div>
          <Field label="Production date">
            <input className={inputCls} type="date" value={form.production_date} onChange={(e) => setForm({ ...form, production_date: e.target.value })} />
          </Field>
          <Field label="Session">
            <select className={`${inputCls} appearance-none`} value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value as Session })}>
              {SESSIONS.map((s) => (
                <option key={s} value={s} disabled={existingSessions.has(s)}>
                  {s} {existingSessions.has(s) ? "(already recorded)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Milk (L)">
            <input className={inputCls} type="number" step="0.01" min="0" value={form.milk_liters} onChange={(e) => setForm({ ...form, milk_liters: e.target.value })} />
          </Field>
          <Field label="Quality Grade">
            <select className={`${inputCls} appearance-none`} value={form.quality_grade} onChange={(e) => setForm({ ...form, quality_grade: e.target.value })}>
              <option value="">Not graded</option>
              <option value="A">A - Premium</option>
              <option value="B">B - Standard</option>
              <option value="C">C - Below Standard</option>
              <option value="Rejected">Rejected</option>
            </select>
          </Field>

          {sessionCheckEnabled && (
            <div className="col-span-2 flex flex-wrap items-center gap-3 p-3 rounded-lg surface border text-xs">
              {SESSIONS.map((s) => {
                const recorded = existingSessions.has(s);
                return (
                  <span key={s} className={`inline-flex items-center gap-1.5 ${recorded ? "text-emerald-400" : "muted"}`}>
                    {recorded ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    {s} {recorded ? "Recorded" : "Available"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Duplicate-session prompt */}
      {duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="surface border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Session already recorded</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {duplicateInfo.session} milk record already exists for this animal today. Would you like to edit it instead?
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDuplicateInfo(null)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg surface border text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const animal = animalList.find((a) => a.animal_id === duplicateInfo.animal_id);
                  openEditFor(duplicateInfo.animal_id, duplicateInfo.production_date, animalLabel(animal));
                  setDuplicateInfo(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                <Pencil size={13} /> Edit it instead
              </button>
            </div>
          </div>
        </div>
      )}

      <EditDayModal open={!!editTarget} onClose={() => setEditTarget(null)} target={editTarget} />
      <DeleteDayModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} record={deleteTarget} />

      {/* Error modal */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="surface border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle size={18} className="text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Something went wrong</h3>
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
