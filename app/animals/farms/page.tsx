"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { MetricCard, PieChart, BarChart } from "@/app/components/custom-charts";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { Plus, Trash2 } from "lucide-react";
import { useFarms, useFarm, useCreateFarm, useUpdateFarm, useDeleteFarm } from "@/hooks";
import type { Farm, FarmDetail } from "@/types";
import type { UpdateFarmInput } from "@/validators/farm.validator";

const defaultForm = {
  farm_name: "",
  owner_name: "",
  contact_number: "",
  address: "",
  city: "",
  province: "",
  country: "",
  total_area_acres: "",
  notes: "",
  is_active: true,
};

export default function FarmsPage() {
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (selected === null && farms && farms.length > 0) {
      setSelected(farms[0].farm_id);
    }
  }, [farms, selected]);

  const { data: detail, isLoading: detailLoading } = useFarm(selected ?? 0);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const createMutation = useCreateFarm();
  const updateMutation = useUpdateFarm();
  const deleteMutation = useDeleteFarm();

  function create() {
    if (!form.farm_name) { setError("Please enter a farm name."); return; }
    createMutation.mutate(
      {
        ...form,
        total_area_acres: form.total_area_acres ? Number(form.total_area_acres) : null,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ ...defaultForm });
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function remove(id: number) {
    setDeleteId(id);
  }

  function update(patch: UpdateFarmInput) {
    if (!selected) return;
    updateMutation.mutate({ id: selected, data: patch }, {
      onError: (err) => setError(err.message),
    });
  }

  if (farmsLoading) return <div className="p-6 muted">Loading…</div>;

  return (
    <>
      <Navbar title="Farms" subtitle="Browse and manage farms" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {farms?.map((f) => (
              <button
                key={f.farm_id}
                onClick={() => setSelected(f.farm_id)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  selected === f.farm_id
                    ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300"
                    : "surface"
                }`}
              >
                {f.farm_name}
                <span className="ml-2 text-xs muted">
                  {f._count?.animals ?? 0} animals
                </span>
              </button>
            ))}
            {!farms?.length && (
              <span className="muted text-sm">No farms yet.</span>
            )}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <Plus size={14} /> New farm
          </button>
        </div>

        {selected && detailLoading && <div className="muted">Loading farm details…</div>}

        {selected && detail?.farm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{detail.farm.farm_name}</h2>
                <p className="muted text-sm">
                  {detail.farm.city ?? "—"} · {detail.farm.total_area_acres ?? "?"} acres
                </p>
              </div>
              <button
                onClick={() => remove(detail.farm.farm_id)}
                className="text-rose-500 inline-flex items-center gap-1 text-sm"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Animals" value={detail.stats.animalCount} />
              <MetricCard label="Units" value={detail.stats.unitCount} />
              <MetricCard label="Daily milk" value={`${detail.stats.dailyMilk.toFixed(1)} L`} />
              <MetricCard
                label="Health incidents"
                value={detail.stats.health.reduce(
                  (s: number, h: { _count: number }) => s + h._count,
                  0,
                )}
              />
            </div>

            <div className="surface border rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Farm details</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Farm name">
                  <input className={inputCls} defaultValue={detail.farm.farm_name ?? ""}
                    onBlur={(e) => update({ farm_name: e.target.value })} />
                </Field>
                <Field label="Owner name">
                  <input className={inputCls} defaultValue={detail.farm.owner_name ?? ""}
                    onBlur={(e) => update({ owner_name: e.target.value })} />
                </Field>
                <Field label="Contact number">
                  <input className={inputCls} defaultValue={detail.farm.contact_number ?? ""}
                    onBlur={(e) => update({ contact_number: e.target.value })} />
                </Field>
                <Field label="Address">
                  <input className={inputCls} defaultValue={detail.farm.address ?? ""}
                    onBlur={(e) => update({ address: e.target.value })} />
                </Field>
                <Field label="City">
                  <input className={inputCls} defaultValue={detail.farm.city ?? ""}
                    onBlur={(e) => update({ city: e.target.value })} />
                </Field>
                <Field label="Province">
                  <input className={inputCls} defaultValue={detail.farm.province ?? ""}
                    onBlur={(e) => update({ province: e.target.value })} />
                </Field>
                <Field label="Country">
                  <input className={inputCls} defaultValue={detail.farm.country ?? ""}
                    onBlur={(e) => update({ country: e.target.value })} />
                </Field>
                <Field label="Total area (acres)">
                  <input className={inputCls} type="number" step="0.1"
                    defaultValue={detail.farm.total_area_acres ?? 0}
                    onBlur={(e) => update({ total_area_acres: Number(e.target.value) })} />
                </Field>
                <Field label="Active">
                  <button
                    onClick={() => update({ is_active: !detail.farm.is_active })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      detail.farm.is_active
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-400"
                        : "bg-slate-700 border-slate-600 text-slate-400 hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:text-emerald-400"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${detail.farm.is_active ? "bg-emerald-400" : "bg-slate-500"}`} />
                    {detail.farm.is_active ? "Active" : "Inactive"}
                  </button>
                </Field>
                <Field label="Created">
                  <div className="text-sm muted px-1 py-2">{detail.farm.created_at?.slice(0, 10) ?? "—"}</div>
                </Field>
                <Field label="Last updated">
                  <div className="text-sm muted px-1 py-2">{detail.farm.updated_at?.slice(0, 10) ?? "—"}</div>
                </Field>
                <div className="col-span-2">
                  <Field label="Notes">
                    <textarea
                      className={inputCls}
                      rows={3}
                      defaultValue={detail.farm.notes ?? ""}
                      placeholder="Location details, management instructions, or other remarks…"
                      onBlur={(e) => update({ notes: e.target.value || null })}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="surface border rounded-2xl p-5">
                <h3 className="font-semibold mb-3">Species distribution</h3>
                <PieChart data={detail.stats.species.filter((d: { value: number }) => d.value > 0)} />
              </div>
              <div className="surface border rounded-2xl p-5">
                <h3 className="font-semibold mb-3">Units capacity</h3>
                <BarChart
                  data={(detail.farm.units ?? []).map((u: { unit_name: string; capacity: number | null }) => ({
                    label: u.unit_name,
                    value: u.capacity || 0,
                  }))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New farm"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm">Cancel</button>
            <button onClick={create} disabled={createMutation.isPending}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm">
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Farm name">
            <input className={inputCls} value={String(form.farm_name)}
              onChange={(e) => setForm({ ...form, farm_name: e.target.value })} />
          </Field>
          <Field label="Owner name">
            <input className={inputCls} value={String(form.owner_name)}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          </Field>
          <Field label="Contact number">
            <input className={inputCls} value={String(form.contact_number)}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </Field>
          <Field label="Address">
            <input className={inputCls} value={String(form.address)}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="City">
            <input className={inputCls} value={String(form.city)}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Province">
            <input className={inputCls} value={String(form.province)}
              onChange={(e) => setForm({ ...form, province: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputCls} value={String(form.country)}
              onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Total area (acres)">
            <input className={inputCls} type="number" step="0.1" value={String(form.total_area_acres)}
              onChange={(e) => setForm({ ...form, total_area_acres: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea
                className={inputCls}
                rows={3}
                value={form.notes}
                placeholder="Location details, management instructions, or other remarks…"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onSuccess: () => { if (selected === deleteId) setSelected(null); },
            onError: (err) => setError(err.message),
          })
        }
        title="Delete Farm"
        message="Are you sure you want to delete this farm and all its data? This action cannot be undone."
      />
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="surface border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-rose-500/15 flex items-center justify-center">
                <span className="text-rose-400 font-bold">!</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Something went wrong</h3>
                <p className="text-sm muted mt-1">{error}</p>
              </div>
            </div>
            <button onClick={() => setError(null)}
              className="mt-4 w-full px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}