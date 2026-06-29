"use client";
import { useMemo, useState, useEffect } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import {
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Baby,
  CheckCircle2,
  Clock,
  CalendarClock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  usePregnancyRecords,
  useCreatePregnancyRecord,
  useUpdatePregnancyRecord,
  useDeletePregnancyRecord,
  useAnimals,
  useBreedingRecords,
} from "@/hooks";
import type { PregnancyRecord, Animal } from "@/types";

const STATUS_OPTIONS = [
  "Pending",
  "Confirmed",
  "In Progress",
  "Delivered",
  "Failed",
];

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-500/15 text-amber-400",
  Confirmed: "bg-blue-500/15 text-blue-400",
  "In Progress": "bg-purple-500/15 text-purple-400",
  Delivered: "bg-emerald-500/15 text-emerald-400",
  Failed: "bg-red-500/15 text-red-400",
};

const STATUS_DOT: Record<string, string> = {
  Pending: "bg-amber-400",
  Confirmed: "bg-blue-400",
  "In Progress": "bg-purple-400",
  Delivered: "bg-emerald-400",
  Failed: "bg-red-400",
};

const defaultForm = {
  animal_id: "",
  insemination_date: "",
  pregnancy_confirmed: false,
  confirmation_date: "",
  expected_delivery_date: "",
  actual_delivery_date: "",
  status: "Pending",
};

export default function PregnancyPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({
    ...defaultForm,
  });

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: "20",
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page],
  );

  const { data, isLoading } = usePregnancyRecords(queryParams);
  const { data: animalsData } = useAnimals({
    pageSize: "500",
    is_active: "true",
    gender: "F",
  });

  const createMutation = useCreatePregnancyRecord();
  const updateMutation = useUpdatePregnancyRecord();
  const deleteMutation = useDeletePregnancyRecord();

  const animals = animalsData?.data ?? [];

  // When creating a new record, auto-fill insemination date from the
  // selected animal's most recent breeding record.
  const { data: lastBreeding } = useBreedingRecords(
    { female_animal_id: String(form.animal_id || ""), pageSize: "1" },
    editId === null && Boolean(form.animal_id),
  );

  useEffect(() => {
    if (editId !== null) return; // never overwrite an existing record's date
    if (!form.animal_id) return;
    const latest = lastBreeding?.data?.[0];
    if (latest?.breeding_date) {
      setForm((f) =>
        f.animal_id === String(form.animal_id) && !f.insemination_date
          ? { ...f, insemination_date: latest.breeding_date!.slice(0, 10) }
          : f,
      );
    }
  }, [lastBreeding, editId, form.animal_id]);

  function openCreate() {
    setEditId(null);
    setForm({ ...defaultForm });
    setOpen(true);
  }

  function openEdit(r: PregnancyRecord) {
    setEditId(r.pregnancy_id);
    setForm({
      animal_id: String(r.animal_id),
      insemination_date: r.insemination_date?.slice(0, 10) ?? "",
      pregnancy_confirmed: r.pregnancy_confirmed === true,
      confirmation_date: r.confirmation_date?.slice(0, 10) ?? "",
      expected_delivery_date: r.expected_delivery_date?.slice(0, 10) ?? "",
      actual_delivery_date: r.actual_delivery_date?.slice(0, 10) ?? "",
      status: r.status ?? "Pending",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.animal_id) {
      alert("Please select an animal.");
      return;
    }
    if (!form.insemination_date) {
      alert("Please enter an insemination date.");
      return;
    }

    const payload = {
      animal_id: Number(form.animal_id),
      insemination_date: String(form.insemination_date),
      pregnancy_confirmed: form.pregnancy_confirmed ? true : null,
      confirmation_date: (form.confirmation_date as string) || null,
      expected_delivery_date: (form.expected_delivery_date as string) || null,
      actual_delivery_date: (form.actual_delivery_date as string) || null,
      status: (form.status as string) || "Pending",
    };

    if (editId !== null) {
      updateMutation.mutate(
        { id: editId, data: payload },
        {
          onSuccess: () => {
            setOpen(false);
            setForm({ ...defaultForm });
            setEditId(null);
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
    if (
      !window.confirm("Are you sure you want to delete this pregnancy record?")
    )
      return;
    deleteMutation.mutate(id, {
      onError: (err) => alert(err.message),
    });
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  const isPending = createMutation.isPending || updateMutation.isPending;

  function daysFromExpected(
    expected: string | null,
    status: string | null,
  ): { text: string; cls: string } | null {
    if (!expected || status === "Delivered") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expectedDate = new Date(expected);
    expectedDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff > 0) {
      return { text: `${diff}d remaining`, cls: "text-amber-500" };
    } else if (diff === 0) {
      return { text: "Due today", cls: "text-orange-500 font-medium" };
    } else {
      return { text: `${Math.abs(diff)}d overdue`, cls: "text-red-500" };
    }
  }

  return (
    <>
      <Navbar
        title="Pregnancy Records"
        subtitle={`${data?.total ?? 0} records`}
      />
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
            <Baby size={14} />
            New Pregnancy Record
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
                {animals.map((a) => (
                  <option key={a.animal_id} value={a.animal_id}>
                    #{a.tag_number} - {a.animal_name || "Unnamed"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={filters.status ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, status: e.target.value });
                }}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="surface border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left muted">
                <tr>
                  <th className="px-3 py-2">Animal</th>
                  <th className="px-3 py-2">Insemination Date</th>
                  <th className="px-3 py-2">Confirmed</th>
                  <th className="px-3 py-2">Confirmation Date</th>
                  <th className="px-3 py-2">Expected Delivery</th>
                  <th className="px-3 py-2">Actual Delivery</th>
                  <th className="px-3 py-2">Days</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center muted">
                      Loading…
                    </td>
                  </tr>
                )}
                {data?.data.map((r) => {
                  const daysInfo = daysFromExpected(
                    r.expected_delivery_date,
                    r.status,
                  );
                  return (
                    <tr
                      key={r.pregnancy_id}
                      className="border-t border-black/5 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/5"
                    >
                      <td className="px-3 py-2 font-medium">
                        <div>#{r.animals?.tag_number ?? "—"}</div>
                        <div className="text-xs muted">
                          {r.animals?.animal_name || "Unnamed"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.insemination_date?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.pregnancy_confirmed === true ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Yes
                          </span>
                        ) : r.pregnancy_confirmed === false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            No
                          </span>
                        ) : (
                          <span className="muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.confirmation_date?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.expected_delivery_date?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.actual_delivery_date?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {daysInfo ? (
                          <span
                            className={`text-xs font-medium ${daysInfo.cls}`}
                          >
                            {daysInfo.text}
                          </span>
                        ) : (
                          <span className="muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${metrics.dynamicStatusStyle}`}>

                            className={`w-1.5 h-1.5 rounded-full ${
                              metrics.dynamicStatusDot
                            }`}
                          />
                          {metrics.dynamicStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                            title="Edit"
                          >
                            <Pencil size={14} className="muted" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.pregnancy_id)}
                            className="p-1.5 rounded hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data && !data.data.length && !isLoading && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center muted">
                      No pregnancy records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
          setEditId(null);
        }}
        title={
          editId !== null ? "Edit pregnancy record" : "New pregnancy record"
        }
        footer={
          <>
            <button
              onClick={() => {
                setOpen(false);
                setEditId(null);
              }}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={isPending}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              {isPending ? "Saving…" : editId !== null ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Animal *">
            <select
              className={inputCls}
              value={String(form.animal_id)}
              onChange={(e) =>
                setForm((f) =>
                  editId === null
                    ? { ...f, animal_id: e.target.value, insemination_date: "" }
                    : { ...f, animal_id: e.target.value },
                )
              }
            >
              <option value="">Select…</option>
              {animals.map((a) => (
                <option key={a.animal_id} value={a.animal_id}>
                  #{a.tag_number} - {a.animal_name || "Unnamed"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Insemination Date *">
            <input
              className={inputCls}
              type="date"
              value={String(form.insemination_date)}
              onChange={(e) =>
                setForm({ ...form, insemination_date: e.target.value })
              }
            />
            {editId === null && lastBreeding?.data?.[0]?.breeding_date && (
              <p className="text-xs muted mt-1">
                Auto-filled from this animal's last breeding record on{" "}
                {lastBreeding.data[0].breeding_date.slice(0, 10)} — adjust if
                needed.
              </p>
            )}
          </Field>
          <Field label="Status">
            <select
              className={inputCls}
              value={String(form.status)}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pregnancy Confirmed">
            <div className="flex items-center h-[38px]">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pregnancy_confirmed === true}
                  onChange={(e) =>
                    setForm({ ...form, pregnancy_confirmed: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full peer bg-slate-600 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <span className="ml-2 text-sm">
                {form.pregnancy_confirmed ? "Yes" : "No"}
              </span>
            </div>
          </Field>
          <Field label="Confirmation Date">
            <input
              className={inputCls}
              type="date"
              value={String(form.confirmation_date)}
              onChange={(e) =>
                setForm({ ...form, confirmation_date: e.target.value })
              }
            />
          </Field>
          <Field label="Expected Delivery Date">
            <input
              className={inputCls}
              type="date"
              value={String(form.expected_delivery_date)}
              onChange={(e) =>
                setForm({ ...form, expected_delivery_date: e.target.value })
              }
            />
          </Field>
          <Field label="Actual Delivery Date">
            <input
              className={inputCls}
              type="date"
              value={String(form.actual_delivery_date)}
              onChange={(e) =>
                setForm({ ...form, actual_delivery_date: e.target.value })
              }
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
