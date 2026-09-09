"use client";
import { useMemo, useState, useEffect } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { StatCard } from "@/app/components/stat-card";
import {
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Heart,
  ClipboardList,
  Syringe,
  CheckCircle2,
  Hourglass,
  Percent,
  FlaskConical,
} from "lucide-react";
import {
  useBreedingRecords,
  useCreateBreedingRecord,
  useUpdateBreedingRecord,
  useDeleteBreedingRecord,
  useAnimals,
  useHeatCycles,
  useUpdateHeatCycle,
  useUrlFilters,
} from "@/hooks";
import type { BreedingRecord, Animal } from "@/types";
import { AnimalCombobox } from "@/app/components/animal-combobox";
import {
  MOCK_SEMEN_INVENTORY,
  semenBatchLabel,
} from "@/lib/mock-semen-inventory";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import { TABLE_ROW } from "@/lib/theme";
import { UniversalExportButton } from "@/components/export/UniversalExportButton";

const METHODS = [
  "Natural Mating",
  "Artificial Insemination",
  "Embryo Transfer",
] as const;
const RESULTS = ["Pending", "Success", "Failed"] as const;

const BREEDING_FILTER_KEYS = [
  "female_animal_id",
  "male_animal_id",
  "method",
  "result",
] as const;

const defaultForm = {
  female_animal_id: "",
  male_animal_id: "",
  semen_batch_id: "",
  breeding_date: new Date().toISOString().slice(0, 10),
  method: "",
  result: "Pending",
  notes: "",
};

function ResultBadge({ result }: { result: string | null | undefined }) {
  if (!result) {
    return <span className="muted">—</span>;
  }
  if (result === "Success") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Success
      </span>
    );
  }
  if (result === "Failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Failed
      </span>
    );
  }
  if (result === "Pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      {result}
    </span>
  );
}

export default function BreedingPage() {
  const [filters, setFilters] = useUrlFilters(BREEDING_FILTER_KEYS);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: "20",
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page],
  );

  const { data, isLoading } = useBreedingRecords(queryParams);
  // Dashboard metrics reflect the whole dataset, not just the current
  // filtered/paginated page.
  const { data: allRecordsRes } = useBreedingRecords({ pageSize: "1000" });
  const { data: femaleAnimals } = useAnimals({
    pageSize: "500",
    is_active: "true",
    gender: "F",
  });
  const { data: maleAnimals } = useAnimals({
    pageSize: "500",
    is_active: "true",
    gender: "M",
  });

  const dashboardStats = useMemo(() => {
    const all = allRecordsRes?.data ?? [];
    const total = all.length;
    const natural = all.filter((r) => r.method === "Natural Mating").length;
    const ai = all.filter((r) => r.method === "Artificial Insemination").length;
    const success = all.filter((r) => r.result === "Success").length;
    const failed = all.filter((r) => r.result === "Failed").length;
    const pending = all.filter(
      (r) => !r.result || r.result === "Pending",
    ).length;
    const resolved = success + failed;
    const successRate =
      resolved > 0 ? Math.round((success / resolved) * 100) : 0;
    return { total, natural, ai, success, pending, successRate };
  }, [allRecordsRes]);

  const createMutation = useCreateBreedingRecord();
  const updateMutation = useUpdateBreedingRecord();
  const deleteMutation = useDeleteBreedingRecord();
  const updateHeatCycle = useUpdateHeatCycle();

  // When creating a new breeding record, surface the selected female's
  // active (unclosed) heat cycle so it can be marked back to normal.
  const { data: heatData } = useHeatCycles(
    { animal_id: form.female_animal_id, pageSize: "5" },
    editingId === null && Boolean(form.female_animal_id),
  );
  const activeHeatCycle =
    (heatData?.data ?? []).find((h) => !h.heat_end_date) ?? null;
  const [closeHeatCycle, setCloseHeatCycle] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Pre-fill the form when navigated from another page with ?animal_id=X
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aid = params.get("animal_id");
    if (aid) {
      setForm((prev) => ({ ...prev, female_animal_id: aid }));
      setEditingId(null);
      setOpen(true);
      window.history.replaceState({}, "", "/animals/breeding");
    }
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...defaultForm });
    setOpen(true);
  }

  function openEdit(record: BreedingRecord) {
    setEditingId(record.breeding_id);
    setForm({
      female_animal_id: record.female_animal_id
        ? String(record.female_animal_id)
        : "",
      male_animal_id: record.male_animal_id
        ? String(record.male_animal_id)
        : "",
      semen_batch_id: record.semen_batch_id ?? "",
      breeding_date: record.breeding_date?.slice(0, 10) ?? "",
      method: record.method ?? "",
      result: record.result ?? "Pending",
      notes: record.notes ?? "",
    });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.female_animal_id) {
      alert("Please select a female animal.");
      return;
    }
    if (!form.breeding_date) {
      alert("Please select a breeding date.");
      return;
    }

    const isAI = form.method === "Artificial Insemination";
    const payload = {
      female_animal_id: Number(form.female_animal_id),
      male_animal_id: isAI
        ? null
        : form.male_animal_id
          ? Number(form.male_animal_id)
          : null,
      semen_batch_id: isAI ? form.semen_batch_id || null : null,
      breeding_date: form.breeding_date,
      method: form.method || null,
      result: form.result || null,
      notes: form.notes || null,
    };

    if (editingId !== null) {
      updateMutation.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            setOpen(false);
            setForm({ ...defaultForm });
            setEditingId(null);
          },
          onError: (err) => alert(err.message),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          if (closeHeatCycle && activeHeatCycle) {
            // Breeding date has no time component, so stamp it with the
            // current time-of-day (the moment this was logged) for the
            // hour-level precision some animals' heat windows need.
            const now = new Date();
            const breedingDay = new Date(form.breeding_date);
            breedingDay.setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
            );
            updateHeatCycle.mutate({
              id: activeHeatCycle.heat_cycle_id,
              data: { heat_end_date: breedingDay.toISOString() },
            });
          }
          setOpen(false);
          setForm({ ...defaultForm });
        },
        onError: (err) => alert(err.message),
      });
    }
  }

  function handleDelete(id: number) {
    setDeleteId(id);
  }

  function handleMethodChange(method: string) {
    setForm((f) => ({
      ...f,
      method,
      // Switching methods means the previous sire-selection field no
      // longer applies — clear it so a stale value can't be submitted.
      male_animal_id:
        method === "Artificial Insemination" ? "" : f.male_animal_id,
      semen_batch_id:
        method === "Artificial Insemination" ? f.semen_batch_id : "",
    }));
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Navbar
        title="Breeding Records"
        subtitle={`${data?.total ?? 0} records`}
      />
      <div className="p-6 space-y-4">
        {/* ── Compact metrics dashboard ──────────────────────────────── */}
        <div className="surface border rounded-2xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-white/10">
          <StatCard
            label="Total Records"
            value={dashboardStats.total}
            icon={<ClipboardList size={16} className="text-sky-400" />}
            iconBg="bg-sky-500/10"
            href="/animals/breeding"
            active={!filters.method && !filters.result}
            tone="breeding"
          />
          <StatCard
            label="Natural Matings"
            value={dashboardStats.natural}
            icon={<Heart size={16} className="text-rose-400" />}
            iconBg="bg-rose-500/10"
            href={buildFilterUrl("/animals/breeding", { method: "Natural Mating" })}
            active={filters.method === "Natural Mating"}
            tone="breeding"
          />
          <StatCard
            label="AI Breedings"
            value={dashboardStats.ai}
            icon={<Syringe size={16} className="text-violet-400" />}
            iconBg="bg-violet-500/10"
            href={buildFilterUrl("/animals/breeding", { method: "Artificial Insemination" })}
            active={filters.method === "Artificial Insemination"}
            tone="breeding"
          />
          <StatCard
            label="Successful"
            value={dashboardStats.success}
            icon={<CheckCircle2 size={16} className="text-emerald-400" />}
            iconBg="bg-emerald-500/10"
            href={buildFilterUrl("/animals/breeding", { result: "Success" })}
            active={filters.result === "Success"}
            tone="success"
          />
          <StatCard
            label="Pending Results"
            value={dashboardStats.pending}
            icon={<Hourglass size={16} className="text-amber-400" />}
            iconBg="bg-amber-500/10"
            href={buildFilterUrl("/animals/breeding", { result: "Pending" })}
            active={filters.result === "Pending"}
            tone="warning"
          />
          <StatCard
            label="Success Rate"
            value={`${dashboardStats.successRate}%`}
            icon={<Percent size={16} className="text-teal-400" />}
            href={buildFilterUrl("/animals/breeding", { result: "Success" })}
            iconBg="bg-teal-500/10"
            tone="success"
          />
        </div>

        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
            >
              <Filter size={14} />
              Filters
            </button>
          </div>
          <div className="flex items-center gap-2">
            <UniversalExportButton resource="breeding" filters={filters} />
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white"
            >
              <Heart size={14} />
              New Breeding Record
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Method">
              <select
                className={inputCls}
                value={filters.method ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, method: e.target.value });
                }}
              >
                <option value="">All</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Female Animal">
              <select
                className={inputCls}
                value={filters.female_animal_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, female_animal_id: e.target.value });
                }}
              >
                <option value="">All</option>
                {femaleAnimals?.data.map((a) => (
                  <option key={a.animal_id} value={a.animal_id}>
                    #{a.tag_number} - {a.animal_name || "Unnamed"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Male Animal">
              <select
                className={inputCls}
                value={filters.male_animal_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, male_animal_id: e.target.value });
                }}
              >
                <option value="">All</option>
                {maleAnimals?.data.map((a) => (
                  <option key={a.animal_id} value={a.animal_id}>
                    #{a.tag_number} - {a.animal_name || "Unnamed"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="surface border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left muted surface-2">
              <tr>
                <th className="px-3 py-2">Breeding Date</th>
                <th className="px-3 py-2">Female Animal</th>
                <th className="px-3 py-2">Sire / Semen</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center muted">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.data.map((r) => (
                <tr key={r.breeding_id} className={TABLE_ROW}>
                  <td className="px-3 py-2 font-medium">
                    {r.breeding_date?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    #
                    {r.animals_breeding_records_female_animal_idToanimals
                      ?.tag_number ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.semen_batch_id ? (
                      <span className="inline-flex items-center gap-1 text-violet-400">
                        <Syringe size={12} />
                        {r.semen_batch_id}
                      </span>
                    ) : (
                      `#${r.animals_breeding_records_male_animal_idToanimals?.tag_number ?? "—"}`
                    )}
                  </td>
                  <td className="px-3 py-2">{r.method ?? "—"}</td>
                  <td className="px-3 py-2">
                    <ResultBadge result={r.result} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.breeding_id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data && !data.data.length && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center muted">
                    No breeding records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
        }}
        title={
          editingId !== null ? "Edit Breeding Record" : "New Breeding Record"
        }
        footer={
          <>
            <button
              onClick={() => {
                setOpen(false);
                setEditingId(null);
              }}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              {isPending
                ? editingId !== null
                  ? "Saving…"
                  : "Creating…"
                : editingId !== null
                  ? "Save"
                  : "Create"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Female Animal">
            <AnimalCombobox
              animals={femaleAnimals?.data ?? []}
              value={form.female_animal_id}
              onChange={(id) => setForm({ ...form, female_animal_id: id })}
            />
          </Field>
          {form.method === "Artificial Insemination" ? (
            <Field label="Semen Batch (AI)">
              <select
                className={inputCls}
                value={form.semen_batch_id}
                onChange={(e) =>
                  setForm({ ...form, semen_batch_id: e.target.value })
                }
              >
                <option value="">Select semen batch…</option>
                {MOCK_SEMEN_INVENTORY.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {semenBatchLabel(batch)}
                  </option>
                ))}
              </select>
              <p className="text-xs muted mt-1 flex items-center gap-1">
                <FlaskConical size={12} className="shrink-0" />
                Placeholder data — will pull from the Inventory/Veterinary
                module once available.
              </p>
            </Field>
          ) : (
            <Field label="Male Animal">
              <AnimalCombobox
                animals={maleAnimals?.data ?? []}
                value={form.male_animal_id}
                onChange={(id) => setForm({ ...form, male_animal_id: id })}
                placeholder="Search sire by tag, name, breed…"
              />
            </Field>
          )}
          <Field label="Breeding Date">
            <input
              className={inputCls}
              type="date"
              value={form.breeding_date}
              onChange={(e) =>
                setForm({ ...form, breeding_date: e.target.value })
              }
            />
          </Field>
          <Field label="Method">
            <select
              className={inputCls}
              value={form.method}
              onChange={(e) => handleMethodChange(e.target.value)}
            >
              <option value="">Select…</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Result">
            <select
              className={inputCls}
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
            >
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          {editingId === null && activeHeatCycle && (
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeHeatCycle}
                  onChange={(e) => setCloseHeatCycle(e.target.checked)}
                  className="accent-amber-500"
                />
                This animal is currently marked as <strong>in heat</strong> —
                mark the heat cycle back to normal when this record is saved
              </label>
            </div>
          )}
          <Field label="Notes">
            <textarea
              className={inputCls}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onError: (err) => alert(err.message),
          })
        }
        title="Delete Breeding Record"
        message="Are you sure you want to delete this breeding record? This action cannot be undone."
      />
    </>
  );
}
