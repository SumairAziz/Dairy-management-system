"use client";
import { useState, useMemo, useEffect } from "react";
import { Navbar } from "@/app/components/navbar";
import {
  MetricCard,
  CapacityGauge,
  PieChart,
  StatusPill,
  healthKind,
} from "@/app/components/custom-charts";
import { Modal, ConfirmModal, Field, inputCls } from "@/app/components/modal";
import { Plus, Trash2, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import {
  useUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useFarms,
  useUnit,
} from "@/hooks";
import type { Animal } from "@/types";
import type { UpdateUnitInput } from "@/validators/units.validator";
import { isCompletedPregnancy } from "@/lib/pregnancy-status";

// ─── Filter state shape ───────────────────────────────────────────────────────
const HEALTH_OPTIONS = ["Open", "In Progress", "Resolved", "Critical"];
const VACCINATION_OPTIONS = [
  "Up to date",
  "Due soon",
  "Overdue",
  "None on record",
];
const PREGNANCY_OPTIONS = ["Pregnant", "Not Pregnant"];
const HEAT_OPTIONS = ["In Heat", "Not in Heat"];
const LIFECYCLE_OPTIONS = [
  "Calf",
  "Heifer",
  "Pregnant Heifer",
  "Lactating",
  "Dry",
  "Bull",
  "Breeding Bull",
  "Retired",
  "Sold",
  "Deceased",
];

const emptyFilters = () => ({
  search: "",
  health: "",
  vaccination: "",
  pregnancy: "",
  heatCycle: "",
  lifecycle: "",
  minWeight: "",
  maxWeight: "",
  lastCheckupFrom: "",
  lastCheckupTo: "",
  lastVaccinationFrom: "",
  lastVaccinationTo: "",
});

// ─── Small helpers ─────────────────────────────────────────────────────────────
function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest muted font-semibold">
        {label}
      </label>
      <select
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberRange({
  label,
  min,
  max,
  onMin,
  onMax,
  unit,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest muted font-semibold">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => onMax(e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  );
}

function DateRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest muted font-semibold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className={inputCls}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function UnitsPage() {
  const { data: units, isLoading: unitsLoading } = useUnits();
  const { data: farms } = useFarms();

  // Default to first farm / first unit (restored from original behavior)
  const [selectedFarm, setSelectedFarm] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

  useEffect(() => {
    if (farms?.length && selectedFarm === null) {
      setSelectedFarm(farms[0].farm_id);
    }
  }, [farms, selectedFarm]);

  const farmUnits = useMemo(
    () => units?.filter((u) => u.farm_id === selectedFarm) ?? [],
    [units, selectedFarm],
  );

  useEffect(() => {
    if (farmUnits.length) setSelectedUnit(farmUnits[0].unit_id);
    else setSelectedUnit(null);
  }, [farmUnits]);

  const { data: detail, isLoading: detailLoading } = useUnit(selectedUnit ?? 0);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    unit_name: "",
    unit_type: "Barn",
    capacity: "50",
    description: "",
    notes: "",
    farm_id: "",
  });

  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const deleteMutation = useDeleteUnit();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyFilters());

  const set = (k: keyof ReturnType<typeof emptyFilters>) => (v: string) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const resetFilters = () => setFilters(emptyFilters());

  // Derived per-animal status helpers (schema is now relational, so we
  // compute the same "latest status" snapshot the original flat columns used
  // to provide directly).
  function latestHealth(a: Animal) {
    return a.health_incidents?.[0]?.status ?? null;
  }
  function latestWeight(a: Animal) {
    return a.growth_logs?.[0]?.weight_kg ?? a.birth_weight_kg ?? null;
  }
  function lastVaccinationDate(a: Animal) {
    return a.vaccination_records?.[0]?.vaccination_date ?? null;
  }
  function vaccinationStatus(a: Animal) {
    const rec = a.vaccination_records?.[0];
    if (!rec) return "None on record";
    if (!rec.next_due_date) return "Up to date";
    const due = new Date(rec.next_due_date).getTime();
    const now = Date.now();
    const soon = 7 * 24 * 60 * 60 * 1000;
    if (due < now) return "Overdue";
    if (due - now < soon) return "Due soon";
    return "Up to date";
  }
  function pregnancyStatus(a: Animal) {
    const rec = a.pregnancy_records?.[0];
    if (!rec) return "Not Pregnant";
    return isCompletedPregnancy(rec.status) ? "Not Pregnant" : "Pregnant";
  }
  function heatStatus(a: Animal) {
    const rec = a.heat_cycle_records?.[0];
    if (!rec || rec.heat_end_date) return "Not in Heat";
    return "In Heat";
  }
  function lastCheckupDate(a: Animal) {
    return a.health_incidents?.[0]?.incident_date ?? null;
  }
  function dailyMilk(a: Animal) {
    return a.milk_logs?.[0]?.milk_liters ?? null;
  }

  const animals: Animal[] = useMemo(() => {
    const list: Animal[] = detail?.animals ?? [];
    return list.filter((a) => {
      const q = filters.search.toLowerCase();
      if (q && !JSON.stringify(a).toLowerCase().includes(q)) return false;
      if (filters.health && latestHealth(a) !== filters.health) return false;
      if (filters.vaccination && vaccinationStatus(a) !== filters.vaccination)
        return false;
      if (filters.pregnancy && pregnancyStatus(a) !== filters.pregnancy)
        return false;
      if (filters.heatCycle && heatStatus(a) !== filters.heatCycle)
        return false;
      if (filters.lifecycle && a.lifecycle_stage !== filters.lifecycle)
        return false;
      const w = latestWeight(a);
      if (filters.minWeight && Number(w ?? 0) < Number(filters.minWeight))
        return false;
      if (filters.maxWeight && Number(w ?? 0) > Number(filters.maxWeight))
        return false;
      const checkup = lastCheckupDate(a);
      if (
        filters.lastCheckupFrom &&
        (!checkup || checkup < filters.lastCheckupFrom)
      )
        return false;
      if (
        filters.lastCheckupTo &&
        (!checkup || checkup > filters.lastCheckupTo)
      )
        return false;
      const vacc = lastVaccinationDate(a);
      if (
        filters.lastVaccinationFrom &&
        (!vacc || vacc < filters.lastVaccinationFrom)
      )
        return false;
      if (
        filters.lastVaccinationTo &&
        (!vacc || vacc > filters.lastVaccinationTo)
      )
        return false;
      return true;
    });
  }, [detail?.animals, filters]);

  function create() {
    if (!form.farm_id) {
      setError("Please select a farm.");
      return;
    }
    if (!form.unit_name) {
      setError("Please enter a unit name.");
      return;
    }
    createMutation.mutate(
      {
        farm_id: Number(form.farm_id),
        unit_name: form.unit_name,
        unit_type: form.unit_type,
        capacity: form.capacity ? Number(form.capacity) : 0,
        description: form.description || null,
        notes: form.notes || null,
        is_active: true,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            unit_name: "",
            unit_type: "Barn",
            capacity: "50",
            description: "",
            notes: "",
            farm_id: "",
          });
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function remove(id: number) {
    setDeleteId(id);
  }

  function update(patch: UpdateUnitInput) {
    if (!selectedUnit) return;
    updateMutation.mutate(
      { id: selectedUnit, data: patch },
      { onError: (err) => setError(err.message) },
    );
  }

  return (
    <>
      <Navbar title="Units" subtitle="Barns, sheds & enclosures" />

      <div className="p-6 space-y-5">
        {/* ── Farm selector bar (restored farm-overview grid) ──────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest muted font-semibold">
              Farms
            </h2>
            <button
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  farm_id: selectedFarm ? String(selectedFarm) : "",
                }));
                setOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              <Plus size={13} /> New unit
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {farms?.map((farm) => {
              const farmUnitList =
                units?.filter((u) => u.farm_id === farm.farm_id) ?? [];
              const totalAnimals = farmUnitList.reduce(
                (s, u) => s + (u._count?.animals ?? 0),
                0,
              );
              const totalCap = farmUnitList.reduce(
                (s, u) => s + (u.capacity ?? 0),
                0,
              );
              const isActive = selectedFarm === farm.farm_id;
              return (
                <button
                  key={farm.farm_id}
                  onClick={() => setSelectedFarm(farm.farm_id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    isActive
                      ? "bg-brand-500/15 border-brand-500 ring-1 ring-brand-500/40"
                      : "surface hover:border-slate-500"
                  }`}
                >
                  <div className="font-semibold text-sm truncate">
                    {farm.farm_name}
                  </div>
                  <div className="text-xs muted mt-1">
                    {farmUnitList.length} units
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-slate-700/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{
                        width: totalCap
                          ? `${Math.min(100, (totalAnimals / totalCap) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <div className="text-[11px] muted mt-1">
                    {totalAnimals}/{totalCap} animals
                  </div>
                </button>
              );
            })}
            {!farms?.length && (
              <span className="muted text-sm">No farms yet.</span>
            )}
          </div>
        </section>

        {/* ── Unit tabs ─────────────────────────────────────────── */}
        {selectedFarm && (
          <section>
            <h2 className="text-xs uppercase tracking-widest muted font-semibold mb-3">
              Units
            </h2>
            <div className="flex flex-wrap gap-2">
              {farmUnits.length === 0 && (
                <p className="text-sm muted py-2">
                  No units for this farm yet.
                </p>
              )}
              {farmUnits.map((u) => (
                <button
                  key={u.unit_id}
                  onClick={() => setSelectedUnit(u.unit_id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-all ${
                    selectedUnit === u.unit_id
                      ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300"
                      : "surface hover:border-slate-500"
                  }`}
                >
                  <span className="font-medium">{u.unit_name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-md ${
                      selectedUnit === u.unit_id
                        ? "bg-brand-500/20 text-brand-600"
                        : "bg-slate-700/30 muted"
                    }`}
                  >
                    {u._count?.animals ?? 0}/{u.capacity ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Unit detail ───────────────────────────────────────── */}
        {detailLoading && <div className="p-6 muted">Loading unit…</div>}
        {detail?.unit && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{detail.unit.unit_name}</h2>
                <p className="text-sm muted">
                  {detail.unit.unit_type} · {detail.unit.farms?.farm_name}
                </p>
              </div>
              <button
                onClick={() => remove(detail.unit.unit_id)}
                className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-400 text-sm transition-colors"
              >
                <Trash2 size={14} /> Delete unit
              </button>
            </div>

            {/* Editable fields (kept from improved version) */}
            <div className="surface border rounded-2xl p-5 grid md:grid-cols-2 gap-4">
              <Field label="Unit name">
                <input
                  className={inputCls}
                  defaultValue={detail.unit.unit_name}
                  onBlur={(e) => update({ unit_name: e.target.value })}
                />
              </Field>
              <Field label="Unit type">
                <input
                  className={inputCls}
                  defaultValue={detail.unit.unit_type}
                  onBlur={(e) => update({ unit_type: e.target.value })}
                />
              </Field>
              <Field label="Capacity">
                <input
                  className={inputCls}
                  type="number"
                  defaultValue={detail.unit.capacity ?? 0}
                  onBlur={(e) => update({ capacity: Number(e.target.value) })}
                />
              </Field>
              <Field label="Feed schedule / description">
                <input
                  className={inputCls}
                  defaultValue={detail.unit.description ?? ""}
                  onBlur={(e) =>
                    update({ description: e.target.value || null })
                  }
                />
              </Field>
              <div className="col-span-2">
                <Field label="Notes">
                  <textarea
                    className={inputCls}
                    rows={3}
                    defaultValue={detail.unit.notes ?? ""}
                    placeholder="Location details, management instructions, or other remarks…"
                    onBlur={(e) => update({ notes: e.target.value || null })}
                  />
                </Field>
              </div>
            </div>

            {/* Stats row (restored capacity gauge + lifecycle pie + daily milk) */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="surface border rounded-2xl p-5 md:col-span-2">
                <h3 className="font-semibold mb-3">Capacity</h3>
                <CapacityGauge
                  value={detail.stats.occupancy}
                  max={detail.stats.maxCapacity}
                />
                <div className="grid grid-cols-2 mt-4 gap-3 text-sm">
                  <div>
                    <div className="muted text-xs uppercase tracking-wider">
                      Daily milk
                    </div>
                    <div className="text-xl font-bold mt-0.5">
                      {detail.stats.dailyMilk.toFixed(1)} L
                    </div>
                  </div>
                  <div>
                    <div className="muted text-xs uppercase tracking-wider">
                      Feed schedule
                    </div>
                    <div className="mt-0.5">
                      {detail.unit.description || "—"}
                    </div>
                  </div>
                  {detail.unit.notes && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-black/5 dark:border-white/10">
                      <div className="muted text-xs uppercase tracking-wider mb-0.5">Notes</div>
                      <div className="text-sm whitespace-pre-wrap">{detail.unit.notes}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="surface border rounded-2xl p-5">
                <h3 className="font-semibold mb-3">Lifecycle stages</h3>
                <PieChart
                  data={detail.stats.lifecycle.map((g) => ({
                    label: g.lifecycle_stage || "Unknown",
                    value: g._count,
                  }))}
                  size={170}
                />
              </div>
            </div>

            {/* Animals table with full filter panel (restored) */}
            <div className="surface border rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-black/5 dark:border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 muted"
                    />
                    <input
                      type="text"
                      placeholder="Search by tag, breed, species…"
                      value={filters.search}
                      onChange={(e) => set("search")(e.target.value)}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  <button
                    onClick={() => setShowFilters((f) => !f)}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
                      showFilters
                        ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300"
                        : "surface hover:border-slate-500"
                    }`}
                  >
                    <SlidersHorizontal size={14} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-brand-500 text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1 text-sm muted hover:opacity-80 transition-colors"
                    >
                      <X size={13} /> Clear
                    </button>
                  )}
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
                    <SelectFilter
                      label="Health"
                      value={filters.health}
                      onChange={set("health")}
                      options={HEALTH_OPTIONS}
                    />
                    <SelectFilter
                      label="Vaccination"
                      value={filters.vaccination}
                      onChange={set("vaccination")}
                      options={VACCINATION_OPTIONS}
                    />
                    <SelectFilter
                      label="Pregnancy"
                      value={filters.pregnancy}
                      onChange={set("pregnancy")}
                      options={PREGNANCY_OPTIONS}
                    />
                    <SelectFilter
                      label="Heat Cycle"
                      value={filters.heatCycle}
                      onChange={set("heatCycle")}
                      options={HEAT_OPTIONS}
                    />
                    <SelectFilter
                      label="Lifecycle"
                      value={filters.lifecycle}
                      onChange={set("lifecycle")}
                      options={LIFECYCLE_OPTIONS}
                    />
                    <NumberRange
                      label="Weight (kg)"
                      min={filters.minWeight}
                      max={filters.maxWeight}
                      onMin={set("minWeight")}
                      onMax={set("maxWeight")}
                    />
                    <DateRange
                      label="Last Checkup"
                      from={filters.lastCheckupFrom}
                      to={filters.lastCheckupTo}
                      onFrom={set("lastCheckupFrom")}
                      onTo={set("lastCheckupTo")}
                    />
                    <DateRange
                      label="Last Vaccination"
                      from={filters.lastVaccinationFrom}
                      to={filters.lastVaccinationTo}
                      onFrom={set("lastVaccinationFrom")}
                      onTo={set("lastVaccinationTo")}
                    />
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest muted border-b border-black/5 dark:border-white/10">
                      <th className="text-left px-4 py-3">Tag</th>
                      <th className="text-left px-4 py-3">Species / Breed</th>
                      <th className="text-left px-4 py-3">Lifecycle</th>
                      <th className="text-left px-4 py-3">Health</th>
                      <th className="text-left px-4 py-3">Vaccination</th>
                      <th className="text-left px-4 py-3">Pregnancy</th>
                      <th className="text-left px-4 py-3">Heat Cycle</th>
                      <th className="text-right px-4 py-3">Weight (kg)</th>
                      <th className="text-right px-4 py-3">Milk/day (L)</th>
                      <th className="text-left px-4 py-3">Last Checkup</th>
                      <th className="text-left px-4 py-3">Last Vaccination</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {animals.map((a) => (
                      <tr
                        key={a.animal_id}
                        className="border-t border-black/5 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-brand-600">
                          #{a.tag_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {a.breeds?.breed_name ?? "—"}
                          </div>
                          <div className="text-xs muted">
                            {a.breeds?.species?.species_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {a.lifecycle_stage ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            status={latestHealth(a) ?? "Unknown"}
                            kind={healthKind(latestHealth(a))}
                          />
                        </td>
                        <td className="px-4 py-3">{vaccinationStatus(a)}</td>
                        <td className="px-4 py-3">{pregnancyStatus(a)}</td>
                        <td className="px-4 py-3">{heatStatus(a)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {latestWeight(a) ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {dailyMilk(a) ?? "—"}
                        </td>
                        <td className="px-4 py-3 muted text-xs">
                          {lastCheckupDate(a)
                            ? new Date(lastCheckupDate(a)!).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 muted text-xs">
                          {lastVaccinationDate(a)
                            ? new Date(
                                lastVaccinationDate(a)!,
                              ).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/animals/${a.animal_id}`}
                            className="text-brand-600 hover:underline text-xs font-medium transition-colors"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {animals.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-12 text-center muted">
                          {detail.animals?.length
                            ? "No animals match the current filters."
                            : "No animals housed in this unit."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-black/5 dark:border-white/10 text-xs muted">
                Showing {animals.length} of {detail.animals?.length ?? 0}{" "}
                animals
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── New unit modal ──────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New unit"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm transition-colors"
            >
              {createMutation.isPending ? "Creating…" : "Create unit"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Farm">
            <select
              className={inputCls}
              value={form.farm_id}
              onChange={(e) => setForm({ ...form, farm_id: e.target.value })}
            >
              <option value="">Select…</option>
              {farms?.map((f) => (
                <option key={f.farm_id} value={f.farm_id}>
                  {f.farm_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit name">
            <input
              className={inputCls}
              value={form.unit_name}
              onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputCls}
              value={form.unit_type}
              onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
            >
              <option value="Barn">Barn</option>
              <option value="Pasture">Pasture</option>
              <option value="Stall">Stall</option>
              <option value="Pen">Pen</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Max capacity">
            <input
              className={inputCls}
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Feed schedule">
              <textarea
                className={inputCls}
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea
                className={inputCls}
                rows={2}
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
            onSuccess: () => { if (selectedUnit === deleteId) setSelectedUnit(null); },
            onError: (err) => setError(err.message),
          })
        }
        title="Delete Unit"
        message="Are you sure you want to delete this unit? This action cannot be undone."
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
            <button
              onClick={() => setError(null)}
              className="mt-4 w-full px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
