"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { StatCard } from "@/app/components/stat-card";
import { CollapsibleDashboard } from "@/app/components/collapsible-dashboard";
import { PaginationControls } from "@/app/components/pagination";
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Baby,
  Heart,
  Clock,
  CalendarClock,
  AlertTriangle,
  Gauge,
  X,
  Info,
} from "lucide-react";
import {
  usePregnancyRecords,
  usePregnancyStats,
  useCreatePregnancyRecord,
  useUpdatePregnancyRecord,
  useDeletePregnancyRecord,
  useAnimals,
  useBreedingRecords,
  useUrlFilters,
} from "@/hooks";
import { useNow } from "@/lib/use-now";
import {
  GESTATION_DAYS,
  getGestationProgress,
  getPregnancyStatus,
  PREGNANCY_STATUS_FILTERS,
} from "@/lib/pregnancy-status";
import type { PregnancyRecord } from "@/types";
import { AnimalCombobox } from "@/app/components/animal-combobox";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import { TABLE_ROW } from "@/lib/theme";
import { UniversalExportButton } from "@/components/export/UniversalExportButton";

const STATUS_OPTIONS = [
  "Pending",
  "Confirmed",
  "In Progress",
  "Delivered",
  "Failed",
];

const defaultForm = {
  animal_id: "",
  insemination_date: "",
  pregnancy_confirmed: false,
  confirmation_date: new Date().toISOString().slice(0, 10),
  expected_delivery_date: "",
  actual_delivery_date: "",
  status: "Pending",
};

const PAGE_SIZE = 20;

const PREGNANCY_FILTER_KEYS = ["status", "confirmed", "animal_id", "within_days"] as const;

/** Add 283 days to a YYYY-MM-DD string and return a new YYYY-MM-DD string. */
function addGestationDays(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + GESTATION_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Format a YYYY-MM-DD string for display e.g. "14 March 2025". */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PregnancyPage() {
  const router = useRouter();
  const [filters, setFilters] = useUrlFilters(PREGNANCY_FILTER_KEYS, { status: "all" });
  const statusFilter = (filters.status ??
    "all") as (typeof PREGNANCY_STATUS_FILTERS)[number]["key"];
  const confirmedFilter = filters.confirmed ?? ""; // "" | "yes" | "no"
  const animalFilter = filters.animal_id ?? "";
  const withinDaysFilter = filters.within_days
    ? Number(filters.within_days)
    : null;
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({
    ...defaultForm,
  });

  // Tracks whether the expected_delivery_date was auto-computed so we can
  // show the farmer the explanatory note (and clear it if they override manually).
  const [deliveryDateNote, setDeliveryDateNote] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: statsData } = usePregnancyStats();

  const serverParams = useMemo(
    () => ({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      ...(animalFilter ? { animal_id: animalFilter } : {}),
      ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(confirmedFilter && confirmedFilter !== "all" ? { confirmed: confirmedFilter } : {}),
    }),
    [page, animalFilter, statusFilter, confirmedFilter],
  );
  const { data, isLoading } = usePregnancyRecords(serverParams);
  const { data: animalsData } = useAnimals({
    pageSize: "500",
    is_active: "true",
    gender: "F",
  });

  const createMutation = useCreatePregnancyRecord();
  const updateMutation = useUpdatePregnancyRecord();
  const deleteMutation = useDeletePregnancyRecord();

  const animals = animalsData?.data ?? [];

  const now = useNow();

  const allRecords = data?.data ?? [];

  const pageItems = useMemo(
    () =>
      allRecords.map((r) => ({
        record: r,
        progress: getGestationProgress(r, now),
        status: getPregnancyStatus(r, now),
      })),
    [allRecords, now],
  );

  const totalPages = data?.total ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const dashboard = useMemo(() => {
    return {
      total: statsData?.total ?? 0,
      confirmed: statsData?.confirmed ?? 0,
      pendingConfirmation: statsData?.pendingConfirmation ?? 0,
      dueThisMonth: statsData?.dueThisMonth ?? 0,
      overdue: statsData?.overdue ?? 0,
      avgGestationPercent: 0,
    };
  }, [statsData]);

  // ── Auto-fill insemination date + expected delivery from last breeding ──
  // Only active when creating a new record (editId === null) and an animal
  // has been selected. The hook is always called (rules of hooks) but the
  // enabled flag keeps it from firing unnecessarily.
  const { data: lastBreeding } = useBreedingRecords(
    { female_animal_id: String(form.animal_id || ""), pageSize: "1" },
    editId === null && Boolean(form.animal_id),
  );

  useEffect(() => {
    if (editId !== null) return; // never overwrite an existing record's dates
    if (!form.animal_id) return;

    const latest = lastBreeding?.data?.[0];

    if (!latest?.breeding_date) {
      // Animal has no breeding history — clear both dates and note
      setForm((f) => ({
        ...f,
        insemination_date: "",
        expected_delivery_date: "",
      }));
      setDeliveryDateNote(null);
      return;
    }

    const inseminationDate = latest.breeding_date.slice(0, 10);
    const expectedDeliveryDate = addGestationDays(inseminationDate);

    setForm((f) => {
      // Guard: only apply if this is still the animal we fetched for
      if (f.animal_id !== String(form.animal_id)) return f;
      return {
        ...f,
        insemination_date: inseminationDate,
        expected_delivery_date: expectedDeliveryDate,
      };
    });

    setDeliveryDateNote(
      `Auto-set to ${formatDate(expectedDeliveryDate)} — ` +
        `based on last breeding on ${formatDate(inseminationDate)} ` +
        `+ ${GESTATION_DAYS} days standard dairy cow gestation. ` +
        `You can adjust this date if needed.`,
    );
  }, [lastBreeding, editId, form.animal_id]);

  function changeStatusFilter(
    key: (typeof PREGNANCY_STATUS_FILTERS)[number]["key"],
  ) {
    setFilters({ ...filters, status: key });
    setPage(1);
  }

  function openCreate() {
    setEditId(null);
    setForm({ ...defaultForm });
    setDeliveryDateNote(null);
    setOpen(true);
  }

  function openEdit(r: PregnancyRecord) {
    setEditId(r.pregnancy_id);
    setDeliveryDateNote(null);
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
            setDeliveryDateNote(null);
          },
          onError: (err) => alert(err.message),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setOpen(false);
          setForm({ ...defaultForm });
          setDeliveryDateNote(null);
        },
        onError: (err) => alert(err.message),
      });
    }
  }

  function handleDelete(id: number) {
    setDeleteId(id);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (confirmedFilter ? 1 : 0) +
    (animalFilter ? 1 : 0);

  return (
    <>
      <Navbar
        title="Pregnancy Records"
        subtitle={`${dashboard.total} records`}
      />
      <div className="p-6 space-y-5">
        {/* ── Dashboard: six summary cards ─────────────────────────── */}
        <CollapsibleDashboard storageKey="terradairy:dashboard:pregnancy">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="surface border rounded-2xl">
              <StatCard
                label="Total Pregnancies"
                value={String(dashboard.total)}
                icon={<Baby size={16} className="text-sky-400" />}
                iconBg="bg-sky-500/10"
                href="/animals/pregnancy"
                active={statusFilter === "all"}
                tone="pregnancy"
              />
            </div>
            <div className="surface border rounded-2xl">
              <StatCard
                label="Confirmed"
                value={String(dashboard.confirmed)}
                icon={<Heart size={16} className="text-violet-400" />}
                iconBg="bg-violet-500/10"
                href={buildFilterUrl("/animals/pregnancy", { status: "confirmed" })}
                active={statusFilter === "confirmed"}
                tone="pregnancy"
              />
            </div>
            <div className="surface border rounded-2xl">
              <StatCard
                label="Pending Confirmation"
                value={String(dashboard.pendingConfirmation)}
                icon={<Clock size={16} className="text-amber-400" />}
                iconBg="bg-amber-500/10"
                href={buildFilterUrl("/animals/pregnancy", { status: "pending" })}
                active={statusFilter === "pending"}
                tone="warning"
              />
            </div>
            <div className="surface border rounded-2xl">
              <StatCard
                label="Due This Month"
                value={String(dashboard.dueThisMonth)}
                icon={<CalendarClock size={16} className="text-violet-400" />}
                iconBg="bg-violet-500/10"
                href={buildFilterUrl("/animals/pregnancy", { status: "due_soon" })}
                active={statusFilter === "due_soon"}
                tone="warning"
              />
            </div>
            <div className="surface border rounded-2xl">
              <StatCard
                label="Overdue Deliveries"
                value={String(dashboard.overdue)}
                icon={<AlertTriangle size={16} className="text-red-400" />}
                iconBg="bg-red-500/10"
                href={buildFilterUrl("/animals/pregnancy", { status: "overdue" })}
                active={statusFilter === "overdue"}
                tone="danger"
              />
            </div>
            <div className="surface border rounded-2xl">
              <StatCard
                label="Avg Gestation Progress"
                value={`${dashboard.avgGestationPercent}%`}
                icon={<Gauge size={16} className="text-emerald-400" />}
                iconBg="bg-emerald-500/10"
                href={buildFilterUrl("/animals/pregnancy", { status: "confirmed" })}
                tone="success"
              />
            </div>
          </div>
        </CollapsibleDashboard>

        {/* ── Status quick-filter tabs ─────────────────────────────── */}
        <div className="flex flex-wrap gap-2 border-b border-black/5 dark:border-white/10 pb-px">
          {PREGNANCY_STATUS_FILTERS.map((s) => {
            const getStatusTabCount = (key: string) => {
              if (!statsData) return 0;
              switch (key) {
                case "all": return statsData.total;
                case "confirmed": return statsData.confirmed;
                case "pending": return statsData.pendingConfirmation;
                case "due_soon": return statsData.dueThisMonth;
                case "overdue": return statsData.overdue;
                case "delivered": return statsData.delivered;
                case "failed": return statsData.failed;
                default: return 0;
              }
            };
            const count = getStatusTabCount(s.key);
            return (
              <button
                key={s.key}
                onClick={() => changeStatusFilter(s.key)}
                className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
                  statusFilter === s.key
                    ? "border-purple-600 text-purple-700 dark:text-purple-300"
                    : "border-transparent muted hover:text-current"
                }`}
              >
                {s.label}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] ${
                    statusFilter === s.key
                      ? "bg-purple-500/15 text-purple-600"
                      : "bg-slate-700/15 muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <UniversalExportButton resource="pregnancy" filters={filters} />
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              <Baby size={14} />
              New Pregnancy Record
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Animal">
              <select
                className={inputCls}
                value={animalFilter}
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
                value={statusFilter}
                onChange={(e) =>
                  changeStatusFilter(
                    e.target
                      .value as (typeof PREGNANCY_STATUS_FILTERS)[number]["key"],
                  )
                }
              >
                {PREGNANCY_STATUS_FILTERS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pregnancy Confirmed">
              <select
                className={inputCls}
                value={confirmedFilter}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, confirmed: e.target.value });
                }}
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({});
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg surface border text-sm hover:bg-white/5 transition-colors"
              >
                <X size={13} /> Clear
              </button>
            </div>
          </div>
        )}

        <div className="surface border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left muted surface-2">
                <tr>
                  <th className="px-3 py-2">Animal</th>
                  <th className="px-3 py-2">Insemination Date</th>
                  <th className="px-3 py-2">Confirmed</th>
                  <th className="px-3 py-2">Confirmation Date</th>
                  <th className="px-3 py-2">Expected Delivery</th>
                  <th className="px-3 py-2">Actual Delivery</th>
                  <th className="px-3 py-2">Gestation Progress</th>
                  <th className="px-3 py-2">Days Remaining</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center muted">
                      Loading…
                    </td>
                  </tr>
                )}
                {pageItems.map(({ record: r, progress, status }) => (
                  <tr key={r.pregnancy_id} className={TABLE_ROW}>
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
                    <td className="px-3 py-2 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-700/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress.isOverdue
                                ? "bg-red-500"
                                : progress.isDueSoon
                                  ? "bg-orange-500"
                                  : progress.isDelivered
                                    ? "bg-emerald-500"
                                    : "bg-purple-500"
                            }`}
                            style={{ width: `${progress.gestationPercent}%` }}
                          />
                        </div>
                        <span className="text-xs muted whitespace-nowrap tabular-nums">
                          {progress.daysPregnant}/{GESTATION_DAYS}d
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {progress.isDelivered ? (
                        <span className="muted text-xs">—</span>
                      ) : (
                        <span
                          className={`text-xs font-medium ${
                            progress.isOverdue
                              ? "text-red-500"
                              : progress.isDueSoon
                                ? "text-orange-500"
                                : "text-purple-500"
                          }`}
                        >
                          {progress.isOverdue
                            ? `${Math.abs(progress.daysRemaining)}d overdue`
                            : progress.daysRemaining === 0
                              ? "Due today"
                              : `${progress.daysRemaining}d remaining`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                        />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {r.actual_delivery_date && (
                          <button
                            onClick={() =>
                              router.push(
                                `/animals/list?newborn=1&mother_id=${r.animal_id}&birth_date=${r.actual_delivery_date!.slice(0, 10)}`,
                              )
                            }
                            className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400"
                            title="Register newborn animal"
                          >
                            <Baby size={14} />
                          </button>
                        )}
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
                ))}
                {!isLoading && pageItems.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center muted">
                      No pregnancy records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalRecords={data?.total}
          pageSize={data?.pageSize}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditId(null);
          setDeliveryDateNote(null);
        }}
        title={
          editId !== null ? "Edit pregnancy record" : "New pregnancy record"
        }
        footer={
          <>
            {editId !== null && form.actual_delivery_date && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setEditId(null);
                  setDeliveryDateNote(null);
                  router.push(
                    `/animals/list?newborn=1&mother_id=${form.animal_id}&birth_date=${String(form.actual_delivery_date)}`,
                  );
                }}
                className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm transition-colors"
              >
                <Baby size={14} />
                Register Newborn
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                setEditId(null);
                setDeliveryDateNote(null);
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
            <AnimalCombobox
              animals={animals}
              value={String(form.animal_id)}
              onChange={(id) => {
                setDeliveryDateNote(null);
                setForm((f) =>
                  editId === null
                    ? {
                        ...f,
                        animal_id: id,
                        insemination_date: "",
                        expected_delivery_date: "",
                      }
                    : { ...f, animal_id: id },
                );
              }}
            />
          </Field>

          <Field label="Insemination Date *">
            <input
              className={inputCls}
              type="date"
              value={String(form.insemination_date)}
              onChange={(e) => {
                const newDate = e.target.value;
                // Recompute expected delivery whenever the farmer manually
                // changes the insemination date, and update the note.
                const newExpected = newDate ? addGestationDays(newDate) : "";
                setForm((f) => ({
                  ...f,
                  insemination_date: newDate,
                  expected_delivery_date: newExpected,
                }));
                if (newDate && newExpected) {
                  setDeliveryDateNote(
                    `Auto-set to ${formatDate(newExpected)} — ` +
                      `based on insemination date ${formatDate(newDate)} ` +
                      `+ ${GESTATION_DAYS} days standard dairy cow gestation. ` +
                      `You can adjust this date if needed.`,
                  );
                } else {
                  setDeliveryDateNote(null);
                }
              }}
            />
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

          {/* Expected Delivery Date spans full width so the note has room */}
          <div className="col-span-2">
            <Field label="Expected Delivery Date">
              <input
                className={inputCls}
                type="date"
                value={String(form.expected_delivery_date)}
                onChange={(e) => {
                  // If the farmer manually overrides, keep their value but
                  // update the note to reflect it's been changed.
                  setForm({ ...form, expected_delivery_date: e.target.value });
                  setDeliveryDateNote(
                    form.insemination_date
                      ? `Manually adjusted. Originally auto-set from insemination ` +
                          `date ${formatDate(String(form.insemination_date))} ` +
                          `+ ${GESTATION_DAYS} days standard dairy cow gestation.`
                      : null,
                  );
                }}
              />
              {deliveryDateNote && (
                <p className="mt-1.5 text-xs text-sky-400 flex items-start gap-1.5 leading-relaxed">
                  <Info size={12} className="mt-px shrink-0" />
                  {deliveryDateNote}
                </p>
              )}
            </Field>
          </div>

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
      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onError: (err) => alert(err.message),
          })
        }
        title="Delete Pregnancy Record"
        message="Are you sure you want to delete this pregnancy record? This action cannot be undone."
      />
    </>
  );
}
