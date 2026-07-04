"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Syringe,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Users,
  ShieldOff,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { useVaccinations, useCreateVaccination, useAnimals } from "@/hooks";
import type { Animal } from "@/types";
import {
  getVaccinationRecordStatus,
  recordStatusStyle,
  todayDateString,
  type VaccinationRecordStatus,
} from "@/lib/vaccination-status";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface VaccinationRecord {
  vaccination_id: number;
  animal_id: number | null;
  vaccine_name: string | null;
  vaccination_date: string | null;
  next_due_date: string | null;
  administered_by: string | null;
  notes: string | null;
  source: string | null;
  pregnancy_id: number | null;
}

type FilterKey =
  | "all"
  | "due_today"
  | "due_soon"
  | "overdue"
  | "completed"
  | "upcoming"
  | "auto_generated";

interface FilterDef {
  key: FilterKey;
  label: string;
  optional?: boolean;
}

const FILTERS: FilterDef[] = [
  { key: "all", label: "All Records" },
  { key: "due_today", label: "Due Today" },
  { key: "due_soon", label: "Due in Next 7 Days" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "upcoming", label: "Upcoming", optional: true },
  { key: "auto_generated", label: "Auto Generated" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const defaultForm = {
  animal_id: "",
  vaccine_name: "",
  vaccination_date: new Date().toISOString().slice(0, 10),
  next_due_date: "",
  administered_by: "",
  notes: "",
};

/* ------------------------------------------------------------------ */
/* Dashboard stat tile                                                 */
/* ------------------------------------------------------------------ */

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const clickable = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors w-full ${
        active
          ? "border-brand-500 bg-brand-500/5"
          : clickable
            ? "surface border hover:bg-black/5 dark:hover:bg-white/5"
            : "surface border cursor-default"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${tone}`}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight">
          {value}
        </span>
        <span className="block text-[11px] muted leading-tight truncate">
          {label}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function VaccinationsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [animalSearch, setAnimalSearch] = useState("");
  const [vaccineSearch, setVaccineSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  // Existing hooks — pageSize capped at the API max of 100.
  const { data: vaccData, isLoading } = useVaccinations({
    pageSize: "100",
  });
  const { data: animalsRes } = useAnimals({ pageSize: "100" });

  const createMutation = useCreateVaccination();

  const allRecords: VaccinationRecord[] = (vaccData?.data ??
    []) as VaccinationRecord[];
  const animals: Animal[] = animalsRes?.data ?? [];
  const totalRecordsInDb = vaccData?.total ?? allRecords.length;
  const totalAnimalsInDb = animalsRes?.total ?? animals.length;
  const today = todayDateString();
  const partialData = totalRecordsInDb > allRecords.length;

  // animal_id → animal lookup (for tag/name display + search).
  const animalMap = useMemo(() => {
    const m = new Map<number, Animal>();
    for (const a of animals) m.set(a.animal_id, a);
    return m;
  }, [animals]);

  // Enrich each record with its computed status + owning animal.
  const enriched = useMemo(() => {
    return allRecords.map((r) => ({
      record: r,
      status: getVaccinationRecordStatus(r, today),
      animal: r.animal_id ? (animalMap.get(r.animal_id) ?? null) : null,
    }));
  }, [allRecords, animalMap, today]);

  // Per-status counts (drive both the dashboard tiles and filter badges).
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: enriched.length,
      due_today: 0,
      due_soon: 0,
      overdue: 0,
      completed: 0,
      upcoming: 0,
      auto_generated: 0,
    };
    for (const e of enriched) {
      c[e.status] += 1;
      if (e.record.source === "pregnancy_workflow") c.auto_generated += 1;
    }
    return c;
  }, [enriched]);

  // Vaccinated vs non-vaccinated animals (animal-level, not record-level).
  const animalStats = useMemo(() => {
    const vaccinatedIds = new Set<number>();
    for (const r of allRecords) {
      if (r.animal_id != null) vaccinatedIds.add(r.animal_id);
    }
    const vaccinated = vaccinatedIds.size;
    const nonVaccinated = Math.max(0, totalAnimalsInDb - vaccinated);
    return { vaccinated, nonVaccinated, total: totalAnimalsInDb };
  }, [allRecords, totalAnimalsInDb]);

  // Apply active status filter + animal search + vaccine search.
  const filtered = useMemo(() => {
    const q = animalSearch.trim().toLowerCase();
    const vq = vaccineSearch.trim().toLowerCase();
    return enriched
      .filter((e) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "auto_generated")
          return e.record.source === "pregnancy_workflow";
        return e.status === activeFilter;
      })
      .filter((e) => {
        if (!q) return true;
        const a = e.animal;
        if (!a) return false;
        const tag = String(a.tag_number ?? "").toLowerCase();
        const name = String(
          (a as unknown as { animal_name?: string | null }).animal_name ?? "",
        ).toLowerCase();
        const breed = String(a.breeds?.breed_name ?? "").toLowerCase();
        return tag.includes(q) || name.includes(q) || breed.includes(q);
      })
      .filter((e) => {
        if (!vq) return true;
        return String(e.record.vaccine_name ?? "")
          .toLowerCase()
          .includes(vq);
      });
  }, [enriched, activeFilter, animalSearch, vaccineSearch]);

  // Sort: actionable items first (overdue → due today → due soon → upcoming → completed).
  const statusOrder: Record<VaccinationRecordStatus, number> = {
    overdue: 0,
    due_today: 1,
    due_soon: 2,
    upcoming: 3,
    completed: 4,
  };
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status];
      if (so !== 0) return so;
      const ad = a.record.next_due_date ?? "";
      const bd = b.record.next_due_date ?? "";
      return ad.localeCompare(bd);
    });
  }, [filtered]);

  // Reset to page 1 whenever the filter, searches, or page size change.
  useEffect(() => {
    setPage(1);
  }, [activeFilter, animalSearch, vaccineSearch, pageSize]);

  // Client-side pagination of the filtered + sorted list.
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function handleCreate() {
    if (!form.animal_id) {
      alert("Please select an animal.");
      return;
    }
    if (!form.vaccine_name) {
      alert("Please enter a vaccine name.");
      return;
    }
    createMutation.mutate(
      {
        animal_id: Number(form.animal_id),
        vaccine_name: form.vaccine_name,
        vaccination_date: form.vaccination_date || null,
        next_due_date: form.next_due_date || null,
        administered_by: form.administered_by || null,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ ...defaultForm });
        },
        onError: (err) => alert(err.message),
      },
    );
  }

  return (
    <>
      <Navbar title="Vaccinations" subtitle="Vaccination record management" />
      <div className="p-6 space-y-4">
        {/* ── Compact dashboard ─────────────────────────────────── */}
        <div className="surface border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-sm">Vaccination Overview</h3>
            <span className="text-[11px] muted">
              {partialData
                ? `Showing first ${allRecords.length} of ${totalRecordsInDb} records`
                : `Based on ${allRecords.length} records · ${today}`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <StatTile
              icon={Users}
              label="Total Animals"
              value={animalStats.total}
              tone="bg-slate-500/15 text-slate-500 dark:text-slate-300"
            />
            <StatTile
              icon={Syringe}
              label="Vaccinated"
              value={animalStats.vaccinated}
              tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            />
            <StatTile
              icon={ShieldOff}
              label="Non-Vaccinated"
              value={animalStats.nonVaccinated}
              tone="bg-slate-500/15 text-slate-500 dark:text-slate-400"
            />
            <StatTile
              icon={AlertTriangle}
              label="Overdue"
              value={counts.overdue}
              tone="bg-rose-500/15 text-rose-500 dark:text-rose-400"
              onClick={() => setActiveFilter("overdue")}
              active={activeFilter === "overdue"}
            />
            <StatTile
              icon={CalendarCheck}
              label="Due Today"
              value={counts.due_today}
              tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
              onClick={() => setActiveFilter("due_today")}
              active={activeFilter === "due_today"}
            />
            <StatTile
              icon={CalendarClock}
              label="Due in 7 Days"
              value={counts.due_soon}
              tone="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
              onClick={() => setActiveFilter("due_soon")}
              active={activeFilter === "due_soon"}
            />
            <StatTile
              icon={CalendarDays}
              label="Upcoming"
              value={counts.upcoming}
              tone="bg-sky-500/15 text-sky-600 dark:text-sky-400"
              onClick={() => setActiveFilter("upcoming")}
              active={activeFilter === "upcoming"}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatTile
              icon={CheckCircle2}
              label="Completed"
              value={counts.completed}
              tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              onClick={() => setActiveFilter("completed")}
              active={activeFilter === "completed"}
            />
            <StatTile
              icon={Syringe}
              label="All Records"
              value={counts.all}
              tone="bg-brand-500/15 text-brand-600 dark:text-brand-400"
              onClick={() => setActiveFilter("all")}
              active={activeFilter === "all"}
            />
            <StatTile
              icon={Zap}
              label="Auto Generated"
              value={counts.auto_generated}
              tone="bg-purple-500/15 text-purple-600 dark:text-purple-400"
              onClick={() => setActiveFilter("auto_generated")}
              active={activeFilter === "auto_generated"}
            />
          </div>
        </div>

        {/* ── Search + add ──────────────────────────────────────── */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 muted"
              />
              <input
                placeholder="Search animal tag / name…"
                className={`${inputCls} pl-8 max-w-[240px]`}
                value={animalSearch}
                onChange={(e) => setAnimalSearch(e.target.value)}
              />
              {animalSearch && (
                <button
                  onClick={() => setAnimalSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <input
              placeholder="Vaccine name…"
              className={`${inputCls} max-w-[180px]`}
              value={vaccineSearch}
              onChange={(e) => setVaccineSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white"
          >
            <Plus size={14} />
            New vaccination record
          </button>
        </div>

        {/* ── Status filter tabs ────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  active
                    ? "bg-brand-600 text-white border-brand-600"
                    : "surface border hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <span>
                  {f.label}
                  {f.optional && (
                    <span className="ml-1 text-[10px] uppercase opacity-70">
                      optional
                    </span>
                  )}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    active ? "bg-white/20" : "bg-black/5 dark:bg-white/10 muted"
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Records table ─────────────────────────────────────── */}
        <div className="surface border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left muted">
                <tr>
                  <th className="px-3 py-2">Animal</th>
                  <th className="px-3 py-2">Vaccine</th>
                  <th className="px-3 py-2">Date Administered</th>
                  <th className="px-3 py-2">Scheduled / Next Due</th>
                  <th className="px-3 py-2">Administered by</th>
                  <th className="px-3 py-2">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center muted">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center muted">
                      No vaccination records match these filters.
                    </td>
                  </tr>
                )}
                {paged.map(({ record, status, animal }) => {
                  const style = recordStatusStyle(status);
                  return (
                    <tr
                      key={record.vaccination_id}
                      className="border-t border-black/5 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/5"
                    >
                      <td className="px-3 py-2 font-medium">
                        {animal ? (
                          <Link
                            href={`/animals/${animal.animal_id}`}
                            className="text-brand-600 hover:underline"
                          >
                            #{animal.tag_number}
                            {(
                              animal as unknown as {
                                animal_name?: string | null;
                              }
                            ).animal_name
                              ? ` · ${
                                  (
                                    animal as unknown as {
                                      animal_name?: string | null;
                                    }
                                  ).animal_name
                                }`
                              : ""}
                          </Link>
                        ) : record.animal_id ? (
                          <span className="muted">#{record.animal_id}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{record.vaccine_name ?? "—"}</span>
                          {record.source === "pregnancy_workflow" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20 shrink-0">
                              <Zap size={9} /> Auto Generated
                            </span>
                          )}
                        </div>
                        {record.source === "pregnancy_workflow" && (
                          <Link
                            href="/pregnancy"
                            className="mt-0.5 text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink size={10} />
                            Pregnancy Workflow
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {record.vaccination_date
                          ? record.vaccination_date.slice(0, 10)
                          : record.source === "pregnancy_workflow"
                            ? <span className="muted italic text-xs">Not yet administered</span>
                            : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {record.next_due_date?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="px-3 py-2 muted">
                        {record.administered_by ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: style.dotColor }}
                          />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {animal && (
                          <Link
                            className="text-brand-600 hover:underline text-xs"
                            href={`/animals/${animal.animal_id}`}
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ────────────────────────────────────────── */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-3">
            <span className="muted">
              Page {currentPage} of {totalPages} · {sorted.length} records
            </span>
            <label className="flex items-center gap-2 muted">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="surface border rounded px-2 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-2 rounded surface border disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-2 rounded surface border disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Create modal ─────────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New vaccination record"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Animal">
              <AnimalSearchSelect
                animals={animals}
                value={form.animal_id}
                onChange={(id) => setForm({ ...form, animal_id: id })}
              />
            </Field>
          </div>
          <Field label="Vaccine name">
            <input
              className={inputCls}
              value={form.vaccine_name}
              onChange={(e) =>
                setForm({ ...form, vaccine_name: e.target.value })
              }
            />
          </Field>
          <Field label="Vaccination date">
            <input
              className={inputCls}
              type="date"
              value={form.vaccination_date}
              onChange={(e) =>
                setForm({ ...form, vaccination_date: e.target.value })
              }
            />
          </Field>
          <Field label="Next due date">
            <input
              className={inputCls}
              type="date"
              value={form.next_due_date}
              onChange={(e) =>
                setForm({ ...form, next_due_date: e.target.value })
              }
            />
          </Field>
          <Field label="Administered by">
            <input
              className={inputCls}
              value={form.administered_by}
              onChange={(e) =>
                setForm({ ...form, administered_by: e.target.value })
              }
            />
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea
                className={inputCls}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Animal search select (used in the create-record modal)              */
/* ------------------------------------------------------------------ */

function AnimalSearchSelect({
  animals,
  value,
  onChange,
}: {
  animals: Animal[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = animals.find((a) => String(a.animal_id) === value);

  const filtered = animals
    .filter((a) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const tag = String(a.tag_number).toLowerCase();
      const name = String(
        (a as unknown as { animal_name?: string | null }).animal_name ?? "",
      ).toLowerCase();
      const breed = String(a.breeds?.breed_name ?? "").toLowerCase();
      return tag.includes(q) || name.includes(q) || breed.includes(q);
    })
    .slice(0, 30);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 surface border rounded-lg text-sm">
          <Link
            href={`/animals/${selected.animal_id}`}
            className="text-brand-600 hover:underline flex items-center gap-1 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            #{selected.tag_number}
            {(selected as unknown as { animal_name?: string | null })
              .animal_name
              ? ` · ${
                  (selected as unknown as { animal_name?: string | null })
                    .animal_name
                }`
              : ""}
          </Link>
          <button
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="muted hover:text-rose-500"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <input
          className={inputCls}
          placeholder="Search by tag, name or breed…"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      )}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full surface border rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs muted">No animals found.</div>
          )}
          {filtered.map((a) => (
            <button
              key={a.animal_id}
              onMouseDown={() => {
                onChange(String(a.animal_id));
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between"
            >
              <span className="font-medium">#{a.tag_number}</span>
              <span className="muted text-xs">
                {(a as unknown as { animal_name?: string | null }).animal_name
                  ? `${
                      (a as unknown as { animal_name?: string | null })
                        .animal_name
                    } · `
                  : ""}
                {a.breeds?.breed_name ?? ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
