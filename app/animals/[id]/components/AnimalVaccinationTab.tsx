"use client";
import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { useVaccinations, useCreateVaccination } from "@/hooks";
import type { Animal } from "@/types";
import {
  getVaccinationRecordStatus,
  recordStatusStyle,
  todayDateString,
} from "@/lib/vaccination-status";

interface Props {
  animal: Animal;
}

export function AnimalVaccinationTab({ animal }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vaccination_date: new Date().toISOString().slice(0, 10),
    vaccine_name: "",
    next_due_date: "",
    administered_by: "",
    notes: "",
  });

  const { data: vaccData, isLoading } = useVaccinations({
    animal_id: String(animal.animal_id),
    pageSize: "100",
  });

  const createMutation = useCreateVaccination();

  function handleCreate() {
    if (!form.vaccine_name) return;
    createMutation.mutate(
      {
        animal_id: animal.animal_id,
        vaccination_date: form.vaccination_date,
        vaccine_name: form.vaccine_name,
        next_due_date: form.next_due_date || null,
        administered_by: form.administered_by || null,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            vaccination_date: new Date().toISOString().slice(0, 10),
            vaccine_name: "",
            next_due_date: "",
            administered_by: "",
            notes: "",
          });
        },
      },
    );
  }

  const records = vaccData?.data ?? [];
  const today = todayDateString();

  // Sort records by vaccination_date desc (latest first) so the most recent
  // dose — the one that drives the animal's status — is at the top.
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const ad = (a.vaccination_date ?? "").slice(0, 10);
      const bd = (b.vaccination_date ?? "").slice(0, 10);
      return bd.localeCompare(ad);
    });
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="font-semibold">Vaccination records</h3>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-brand-600 text-white"
        >
          <Plus size={14} /> Add record
        </button>
      </div>

      <div className="surface border rounded-2xl p-5">
        {isLoading ? (
          <div className="muted text-sm">Loading…</div>
        ) : sortedRecords.length === 0 ? (
          <div className="muted text-sm">No vaccination records.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="py-2">Vaccine</th>
                <th>Date</th>
                <th>Next due</th>
                <th>Administered by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((v) => {
                const status = getVaccinationRecordStatus(v, today);
                const style = recordStatusStyle(status);
                return (
                  <tr
                    key={v.vaccination_id}
                    className="border-t border-black/5 dark:border-white/10"
                  >
                    <td className="py-2 font-medium">
                      {v.vaccine_name ?? "—"}
                    </td>
                    <td>{v.vaccination_date?.slice(0, 10) ?? "—"}</td>
                    <td>{v.next_due_date?.slice(0, 10) ?? "—"}</td>
                    <td className="muted">{v.administered_by ?? "—"}</td>
                    <td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  );
}
