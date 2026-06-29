"use client";
import { useMemo, useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { Plus, Filter, ChevronLeft, ChevronRight, Trash2, Pencil, Flame } from "lucide-react";
import { useHeatCycles, useCreateHeatCycle, useUpdateHeatCycle, useDeleteHeatCycle, useAnimals } from "@/hooks";
import type { HeatCycleRecord, Animal } from "@/types";

const DETECTION_METHODS = [
  "Visual Observation",
  "Heat Detector",
  "Vasectomized Bull",
  "Progesterone Testing",
];

const defaultForm = {
  animal_id: "",
  heat_start_date: "",
  heat_end_date: "",
  detection_method: "",
  confidence_score: "",
  notes: "",
};

export default function HeatCyclesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HeatCycleRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: "20",
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page],
  );

  const { data, isLoading } = useHeatCycles(queryParams);
  const { data: animals } = useAnimals({
    pageSize: "500",
    is_active: "true",
    gender: "F",
  });

  const createMutation = useCreateHeatCycle();
  const updateMutation = useUpdateHeatCycle();
  const deleteMutation = useDeleteHeatCycle();

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
      confidence_score: record.confidence_score != null ? String(record.confidence_score) : "",
      notes: record.notes ?? "",
    });
    setOpen(true);
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

    if (editing) {
      updateMutation.mutate(
        { id: editing.heat_cycle_id, data: payload },
        {
          onSuccess: () => {
            setOpen(false);
            setEditing(null);
            setForm({ ...defaultForm });
          },
          onError: (err) => alert(err.message),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setOpen(false);
          setForm({ ...defaultForm });
        },
        onError: (err) => alert(err.message),
      });
    }
  }

  function handleDelete(id: number) {
    if (!window.confirm("Are you sure you want to delete this heat cycle record?")) return;
    deleteMutation.mutate(id, {
      onError: (err) => alert(err.message),
    });
  }

  function calcDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return "—";
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return `${days} day${days !== 1 ? "s" : ""}`;
  }

  function confidenceBadge(score: number | null) {
    if (score == null) return "—";
    const color =
      score >= 5
        ? "bg-emerald-500/15 text-emerald-400"
        : score >= 3
          ? "bg-amber-500/15 text-amber-400"
          : "bg-red-500/15 text-red-400";
    const dotColor =
      score >= 5
        ? "bg-emerald-400"
        : score >= 3
          ? "bg-amber-400"
          : "bg-red-400";
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {score}
      </span>
    );
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Navbar title="Heat Cycles" subtitle={`${data?.total ?? 0} records`} />
      <div className="p-6 space-y-4">
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
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white"
          >
            <Flame size={14} />
            New Heat Cycle
          </button>
        </div>

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

        <div className="surface border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="px-3 py-2">Animal</th>
                <th className="px-3 py-2">Start Date</th>
                <th className="px-3 py-2">End Date</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Detection Method</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2"></th>
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
              {data?.data.map((r) => (
                <tr
                  key={r.heat_cycle_id}
                  className="border-t border-black/5 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/5"
                >
                  <td className="px-3 py-2 font-medium">
                    #{r.animals?.tag_number ?? "—"}{" "}
                    {r.animals?.animal_name
                      ? `- ${r.animals.animal_name}`
                      : ""}
                  </td>
                  <td className="px-3 py-2">
                    {r.heat_start_date?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.heat_end_date?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {calcDuration(r.heat_start_date, r.heat_end_date)}
                  </td>
                  <td className="px-3 py-2">
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
                      <button
                        onClick={() => handleDelete(r.heat_cycle_id)}
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
                  <td colSpan={7} className="py-6 text-center muted">
                    No heat cycle records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="muted">Page {page} of {totalPages}</span>
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
          setEditing(null);
          setForm({ ...defaultForm });
        }}
        title={editing ? "Edit Heat Cycle" : "New Heat Cycle"}
        footer={
          <>
            <button
              onClick={() => {
                setOpen(false);
                setEditing(null);
                setForm({ ...defaultForm });
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
              onChange={(e) => setForm({ ...form, detection_method: e.target.value })}
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
              onChange={(e) => setForm({ ...form, heat_start_date: e.target.value })}
            />
          </Field>
          <Field label="Heat End Date">
            <input
              className={inputCls}
              type="date"
              value={form.heat_end_date}
              onChange={(e) => setForm({ ...form, heat_end_date: e.target.value })}
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
              onChange={(e) => setForm({ ...form, confidence_score: e.target.value })}
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
    </>
  );
}