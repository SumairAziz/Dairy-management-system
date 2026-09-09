"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { StatCard } from "@/app/components/stat-card";
import {
  Star,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Baby,
  Check,
  AlertTriangle,
  CalendarDays,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  useCalvingRecords,
  useCreateCalving,
  useUpdateCalving,
  useDeleteCalving,
  useAnimals,
  usePregnancyRecords,
} from "@/hooks";
import type { CalvingRecord } from "@/types";
import { AnimalCombobox } from "@/app/components/animal-combobox";
import { isActivePregnancy } from "@/lib/pregnancy-status";
import { outcomeBadgeCls, calfGenderBadgeCls } from "@/lib/calving-status";

const OUTCOMES = ["Live Birth", "Stillbirth", "Twins", "Complications", "Other"];

const defaultForm = {
  mother_id: "",      // animal_id as string
  pregnancy_id: "",
  calving_date: new Date().toISOString().slice(0, 10),
  outcome: "Live Birth",
  calf_gender: "",
  calf_tag: "",
  notes: "",
};

const PAGE_SIZE = 20;

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="muted">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${outcomeBadgeCls(outcome)}`}>
      {outcome}
    </span>
  );
}

function GenderBadge({ gender }: { gender: string | null }) {
  if (!gender) return <span className="muted text-xs">Unknown</span>;
  const isFemale = gender === "F";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${calfGenderBadgeCls(gender)}`}>
      {isFemale ? "Heifer" : "Bull Calf"}
    </span>
  );
}

export default function CalvingPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<CalvingRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalvingRecord | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const { data: calvingRes, isLoading } = useCalvingRecords({ pageSize: "100" });
  const { data: animalsRes } = useAnimals({ pageSize: "500", gender: "F" });
  const { data: pregnancyRes } = usePregnancyRecords({ pageSize: "500" });

  const createMutation = useCreateCalving();
  const updateMutation = useUpdateCalving();
  const deleteMutation = useDeleteCalving();

  const records: CalvingRecord[] = calvingRes?.data ?? [];
  const femaleAnimals = animalsRes?.data ?? [];
  const pregnancies = pregnancyRes?.data ?? [];

  // Stats
  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return {
      total: records.length,
      liveBirths: records.filter((r) => r.outcome === "Live Birth").length,
      twins: records.filter((r) => r.outcome === "Twins").length,
      thisMonth: records.filter((r) => r.calving_date && new Date(r.calving_date) >= monthStart).length,
      heifers: records.filter((r) => r.calf_gender === "F").length,
      bulls: records.filter((r) => r.calf_gender === "M").length,
    };
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paged = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Active confirmed pregnancies for the selected mother
  const motherPregnancies = useMemo(() => {
    if (!form.mother_id) return [];
    const mid = Number(form.mother_id);
    return pregnancies.filter(
      (p) => p.animal_id === mid && isActivePregnancy(p),
    );
  }, [form.mother_id, pregnancies]);

  function openCreate() {
    setForm({ ...defaultForm });
    setEditRecord(null);
    setShowForm(true);
  }

  function openEdit(r: CalvingRecord) {
    setEditRecord(r);
    setForm({
      mother_id: String(r.mother_id),
      pregnancy_id: r.pregnancy_id ? String(r.pregnancy_id) : "",
      calving_date: r.calving_date?.slice(0, 10) ?? "",
      outcome: r.outcome ?? "Live Birth",
      calf_gender: r.calf_gender ?? "",
      calf_tag: r.calf_tag ?? "",
      notes: r.notes ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditRecord(null);
  }

  function handleField(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit() {
    const motherId = Number(form.mother_id);
    if (!motherId || !form.calving_date) return;

    const payload = {
      mother_id: motherId,
      pregnancy_id: form.pregnancy_id ? Number(form.pregnancy_id) : null,
      calving_date: form.calving_date,
      outcome: form.outcome || null,
      calf_gender: (form.calf_gender as "M" | "F") || null,
      calf_tag: form.calf_tag || null,
      notes: form.notes || null,
    };

    if (editRecord) {
      await updateMutation.mutateAsync({ id: editRecord.calving_id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeForm();
    setPage(1);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar title="Calving Records" subtitle="Track calving events and calf information" />

      <div className="flex-1 p-4 sm:p-6 space-y-6">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Calvings", value: stats.total, icon: <Star size={16} className="text-brand-400" />, bg: "bg-brand-500/10" },
            { label: "Live Births", value: stats.liveBirths, icon: <Check size={16} className="text-emerald-400" />, bg: "bg-emerald-500/10" },
            { label: "Twins", value: stats.twins, icon: <Users size={16} className="text-purple-400" />, bg: "bg-purple-500/10" },
            { label: "This Month", value: stats.thisMonth, icon: <CalendarDays size={16} className="text-amber-400" />, bg: "bg-amber-500/10" },
            { label: "Heifers Born", value: stats.heifers, icon: <Baby size={16} className="text-pink-400" />, bg: "bg-pink-500/10" },
            { label: "Bull Calves", value: stats.bulls, icon: <TrendingUp size={16} className="text-blue-400" />, bg: "bg-blue-500/10" },
          ].map((s) => (
            <div key={s.label} className="surface border rounded-2xl">
              <StatCard label={s.label} value={s.value} icon={s.icon} iconBg={s.bg} />
            </div>
          ))}
        </div>

        {/* ── Table card ── */}
        <div className="surface border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold text-sm">Calving Events</h2>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              <Star size={13} /> Record Calving
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center muted text-sm">Loading calving records…</div>
          ) : records.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3">
              <Star size={40} className="text-brand-500/40" />
              <p className="font-medium">No calving records yet</p>
              <p className="muted text-sm text-center max-w-xs">
                When an animal calves, record it here. The mother&apos;s pregnancy status updates automatically.
              </p>
              <button
                onClick={openCreate}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                Record First Calving
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left muted surface-2 border-b">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Mother</th>
                      <th className="px-4 py-2.5 font-medium">Calving Date</th>
                      <th className="px-4 py-2.5 font-medium">Outcome</th>
                      <th className="px-4 py-2.5 font-medium">Calf</th>
                      <th className="px-4 py-2.5 font-medium">Linked Pregnancy</th>
                      <th className="px-4 py-2.5 font-medium">Notes</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {paged.map((r) => (
                      <tr
                        key={r.calving_id}
                        className="odd:bg-black/[0.012] dark:odd:bg-white/[0.018] hover:bg-black/[0.035] dark:hover:bg-white/[0.055] transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {r.mother
                            ? `#${r.mother.tag_number}${r.mother.animal_name ? ` — ${r.mother.animal_name}` : ""}`
                            : `#${r.mother_id}`}
                        </td>
                        <td className="px-4 py-3">{formatDate(r.calving_date)}</td>
                        <td className="px-4 py-3">
                          <OutcomeBadge outcome={r.outcome} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <GenderBadge gender={r.calf_gender} />
                            {r.calf_tag && (
                              <span className="text-xs muted">Tag: {r.calf_tag}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs muted">
                          {r.pregnancy_records
                            ? `Insem. ${formatDate(r.pregnancy_records.insemination_date)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 muted text-xs max-w-[200px] truncate">
                          {r.notes ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => openEdit(r)}
                              className="p-1.5 rounded-lg hover:bg-white/10 muted hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(r)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 muted hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-xs muted">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, records.length)} of {records.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={showForm}
        title={editRecord ? "Edit Calving Record" : "Record Calving Event"}
        onClose={closeForm}
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm border hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !form.mother_id || !form.calving_date}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : editRecord ? "Update Record" : "Record Calving"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Mother animal */}
          <Field label="Mother Animal *">
            <AnimalCombobox
              animals={femaleAnimals}
              value={form.mother_id}
              onChange={(id) => setForm((f) => ({ ...f, mother_id: id, pregnancy_id: "" }))}
              placeholder="Select female animal…"
            />
          </Field>

          {/* Link to pregnancy (optional) */}
          {form.mother_id && (
            <Field label="Linked Pregnancy (optional)">
              <select
                className={inputCls}
                value={form.pregnancy_id}
                onChange={(e) => handleField("pregnancy_id", e.target.value)}
              >
                <option value="">— None —</option>
                {motherPregnancies.map((p) => (
                  <option key={p.pregnancy_id} value={String(p.pregnancy_id)}>
                    Insem. {p.insemination_date?.slice(0, 10)}
                    {p.expected_delivery_date ? ` · EDD ${p.expected_delivery_date.slice(0, 10)}` : ""}
                  </option>
                ))}
              </select>
              {motherPregnancies.length === 0 && (
                <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> No confirmed active pregnancies found for this animal.
                </p>
              )}
            </Field>
          )}

          {/* Calving date */}
          <Field label="Calving Date *">
            <input
              type="date"
              className={inputCls}
              value={form.calving_date}
              onChange={(e) => handleField("calving_date", e.target.value)}
            />
          </Field>

          {/* Outcome */}
          <Field label="Outcome">
            <select
              className={inputCls}
              value={form.outcome}
              onChange={(e) => handleField("outcome", e.target.value)}
            >
              <option value="">— Select outcome —</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          {/* Calf details */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Calf Gender">
              <select
                className={inputCls}
                value={form.calf_gender}
                onChange={(e) => handleField("calf_gender", e.target.value)}
              >
                <option value="">— Unknown —</option>
                <option value="F">Female (Heifer)</option>
                <option value="M">Male (Bull Calf)</option>
              </select>
            </Field>
            <Field label="Calf Tag Number">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. C003"
                value={form.calf_tag}
                onChange={(e) => handleField("calf_tag", e.target.value)}
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              className={inputCls}
              rows={3}
              placeholder="Any observations, complications, or additional information…"
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
            />
          </Field>

          {/* Info banner */}
          {!editRecord && (
            <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-3 text-xs text-brand-300 space-y-1">
              <p className="font-medium">What happens automatically when saved:</p>
              <ul className="space-y-0.5 ml-3 list-disc text-brand-300/80">
                <li>Mother&apos;s pregnancy status → CALVED</li>
                <li>Mother&apos;s lactation status → LACTATING (ready to milk)</li>
                {form.pregnancy_id && <li>Linked pregnancy record marked as Delivered</li>}
                <li>Staff notified via notification center</li>
                <li>Full history preserved — no records deleted</li>
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Calving Record"
        message={
          deleteTarget
            ? `Delete the calving record for ${deleteTarget.mother?.tag_number ?? `#${deleteTarget.mother_id}`} on ${formatDate(deleteTarget.calving_date)}? The mother animal's status will not be reverted automatically.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await deleteMutation.mutateAsync(deleteTarget.calving_id);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
