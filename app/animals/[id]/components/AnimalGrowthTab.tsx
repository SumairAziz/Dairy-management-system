"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { LineChart } from "@/app/components/custom-charts";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { useGrowthLogs, useCreateGrowthLog } from "@/hooks";
import type { Animal } from "@/types";

interface Props {
  animal: Animal;
}

export function AnimalGrowthTab({ animal }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    recorded_date: new Date().toISOString().slice(0, 10),
    weight_kg: "",
    notes: "",
  });

  const { data: logs, isLoading } = useGrowthLogs(animal.animal_id);
  const createMutation = useCreateGrowthLog(animal.animal_id);

  function handleCreate() {
    if (!form.weight_kg) return;
    createMutation.mutate(
      {
        recorded_date: form.recorded_date,
        weight_kg: Number(form.weight_kg),
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            recorded_date: new Date().toISOString().slice(0, 10),
            weight_kg: "",
            notes: "",
          });
        },
      },
    );
  }

  const chartData = (logs ?? []).map((l) => ({
    label: l.recorded_date?.slice(5, 10) || "",
    value: Number(l.weight_kg || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="font-semibold">Growth curve</h3>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-brand-600 text-white"
        >
          <Plus size={14} /> Add log
        </button>
      </div>
      <div className="surface border rounded-2xl p-5">
        <LineChart yLabel="kg" data={chartData} />
      </div>
      <div className="surface border rounded-2xl p-5">
        <table className="w-full text-sm">
          <thead className="text-left muted">
            <tr>
              <th className="py-2">Date</th>
              <th>Weight</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr
                key={l.growth_log_id}
                className="border-t border-black/5 dark:border-white/10"
              >
                <td className="py-2">{l.recorded_date?.slice(0, 10)}</td>
                <td>{Number(l.weight_kg || 0)} kg</td>
                <td className="muted">{l.notes ?? "—"}</td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={3} className="py-4 text-center muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && logs?.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center muted">
                  No growth logs recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add growth log"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm">
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
          <Field label="Date">
            <input
              className={inputCls}
              type="date"
              value={form.recorded_date}
              onChange={(e) =>
                setForm({ ...form, recorded_date: e.target.value })
              }
            />
          </Field>
          <Field label="Weight (kg)">
            <input
              className={inputCls}
              type="number"
              step="0.1"
              value={form.weight_kg}
              onChange={(e) =>
                setForm({ ...form, weight_kg: e.target.value })
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