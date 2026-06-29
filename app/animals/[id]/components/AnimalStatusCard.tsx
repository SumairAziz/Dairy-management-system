"use client";
import type { Animal } from "@/types";
import { Field, inputCls } from "@/app/components/modal";
import {
  useVaccinations,
  usePregnancyRecords,
  useBreedingRecords,
  useHeatCycles,
  useGrowthLogs,
  useMilkLogs,
} from "@/hooks";
import {
  getAnimalVaccinationStatus,
  animalStatusStyle,
} from "@/lib/vaccination-status";
import { getPregnancyStatus } from "@/lib/pregnancy-status";
import { useNow } from "@/lib/use-now";

interface Props {
  animal: Animal;
  onUpdate: (patch: Partial<Animal>) => void;
}

// ─── Per-module data hooks ────────────────────────────────────────────────────
// React Query deduplicates identical queryKeys, so calling the same hook in
// both this card and the parent page costs only one network request.

function useAnimalVaccination(animalId: number) {
  const { data, isLoading } = useVaccinations({
    animal_id: String(animalId),
    pageSize: "100",
  });
  const records = data?.data ?? [];
  const sorted = [...records].sort((a, b) =>
    (b.vaccination_date ?? "").localeCompare(a.vaccination_date ?? ""),
  );
  return {
    isLoading,
    style: animalStatusStyle(getAnimalVaccinationStatus(records)),
    lastDate: sorted[0]?.vaccination_date?.slice(0, 10) ?? null,
  };
}

function useAnimalPregnancy(animalId: number, now: Date) {
  const { data, isLoading } = usePregnancyRecords({
    animal_id: String(animalId),
    pageSize: "100",
  });
  const records = data?.data ?? [];
  const byDate = [...records].sort(
    (a, b) =>
      new Date(b.insemination_date).getTime() -
      new Date(a.insemination_date).getTime(),
  );
  const latest = byDate[0] ?? null;
  // Active = not yet delivered and not failed
  const active =
    byDate.find((p) => !p.actual_delivery_date && p.status !== "Failed") ??
    null;
  const lastDelivered =
    [...records]
      .filter((p) => Boolean(p.actual_delivery_date))
      .sort(
        (a, b) =>
          new Date(b.actual_delivery_date!).getTime() -
          new Date(a.actual_delivery_date!).getTime(),
      )[0] ?? null;
  return {
    isLoading,
    status: latest ? getPregnancyStatus(latest, now) : null,
    expectedDelivery: active?.expected_delivery_date?.slice(0, 10) ?? null,
    lastDelivery: lastDelivered?.actual_delivery_date?.slice(0, 10) ?? null,
  };
}

function useAnimalHeatCycle(animalId: number) {
  const { data, isLoading } = useHeatCycles({
    animal_id: String(animalId),
    pageSize: "100",
  });
  const sorted = [...(data?.data ?? [])].sort((a, b) =>
    (b.heat_start_date ?? "").localeCompare(a.heat_start_date ?? ""),
  );
  const latest = sorted[0] ?? null;
  return {
    isLoading,
    inHeat: Boolean(latest?.heat_start_date && !latest?.heat_end_date),
    hasRecords: Boolean(latest),
  };
}

function useAnimalBreeding(animalId: number) {
  const { data, isLoading } = useBreedingRecords({
    female_animal_id: String(animalId),
    pageSize: "100",
  });
  const sorted = [...(data?.data ?? [])].sort((a, b) =>
    (b.breeding_date ?? "").localeCompare(a.breeding_date ?? ""),
  );
  const latest = sorted[0] ?? null;
  return {
    isLoading,
    method: latest?.method ?? null,
    lastBreedingDate: latest?.breeding_date?.slice(0, 10) ?? null,
  };
}

export function useLatestWeight(animalId: number) {
  const { data, isLoading } = useGrowthLogs(animalId);
  const sorted = [...(data ?? [])].sort((a, b) =>
    b.recorded_date.localeCompare(a.recorded_date),
  );
  return { isLoading, weight: sorted[0] ? Number(sorted[0].weight_kg) : null };
}

export function useDailyMilk(animalId: number) {
  const { data, isLoading } = useMilkLogs({
    animal_id: String(animalId),
    pageSize: "100",
  });
  const logs = data?.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(
    (l) => l.production_date.slice(0, 10) === today,
  );
  if (todayLogs.length > 0) {
    return {
      isLoading,
      liters: todayLogs.reduce((s, l) => s + Number(l.milk_liters), 0),
    };
  }
  // Fall back to most recent day's total
  const byDate = new Map<string, number>();
  for (const l of logs) {
    const d = l.production_date.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + Number(l.milk_liters));
  }
  const dates = [...byDate.keys()].sort().reverse();
  return {
    isLoading,
    liters: dates.length > 0 ? (byDate.get(dates[0]) ?? null) : null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnimalStatusCard({ animal, onUpdate }: Props) {
  const now = useNow();
  const vacc = useAnimalVaccination(animal.animal_id);
  const preg = useAnimalPregnancy(animal.animal_id, now);
  const heat = useAnimalHeatCycle(animal.animal_id);
  const br = useAnimalBreeding(animal.animal_id);
  const { isLoading: weightLoading, weight } = useLatestWeight(animal.animal_id);
  const { isLoading: milkLoading, liters } = useDailyMilk(animal.animal_id);

  const heatCls = heat.inHeat
    ? "bg-orange-500/15 text-orange-400"
    : "bg-slate-500/15 text-slate-400";
  const heatDot = heat.inHeat ? "bg-orange-400" : "bg-slate-400";
  const heatLabel = !heat.hasRecords
    ? "No records"
    : heat.inHeat
      ? "In Heat"
      : "Not in Heat";

  return (
    <div className="surface border rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold">Status</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Health — user-editable */}
        <Field label="Health">
          <select
            className={inputCls}
            defaultValue={String(
              (animal as unknown as Record<string, unknown>)["health_status"] ??
                "",
            )}
            onBlur={() =>
              onUpdate({
                lifecycle_stage: animal.lifecycle_stage,
                is_active: animal.is_active,
              } as Partial<Animal>)
            }
          >
            <option>Healthy</option>
            <option>Sick</option>
            <option>Recovering</option>
            <option>Critical</option>
          </select>
        </Field>

        {/* Vaccination badge — live from vaccination_records */}
        <Field label="Vaccination">
          <div className="flex items-center h-[38px]">
            {vacc.isLoading ? (
              <span className="text-sm muted">Loading…</span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${vacc.style.badgeClass}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: vacc.style.dotColor }}
                />
                {vacc.style.label}
              </span>
            )}
          </div>
        </Field>

        {/* Pregnancy — live from pregnancy_records, computed by getPregnancyStatus */}
        <Field label="Pregnancy">
          <div className="flex items-center h-[38px]">
            {preg.isLoading ? (
              <span className="text-sm muted">Loading…</span>
            ) : preg.status ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${preg.status.cls}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${preg.status.dot}`} />
                {preg.status.label}
              </span>
            ) : (
              <span className="text-sm muted">No records</span>
            )}
          </div>
        </Field>

        {/* Heat cycle — live from heat_cycle_records */}
        <Field label="Heat cycle">
          <div className="flex items-center h-[38px]">
            {heat.isLoading ? (
              <span className="text-sm muted">Loading…</span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${heatCls}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${heatDot}`} />
                {heatLabel}
              </span>
            )}
          </div>
        </Field>

        {/* Lifecycle Stage — user-editable */}
        <Field label="Lifecycle Stage">
          <select
            className={inputCls}
            defaultValue={animal.lifecycle_stage ?? ""}
            onBlur={(e) =>
              onUpdate({ lifecycle_stage: e.target.value } as Partial<Animal>)
            }
          >
            <option value="Calf">Calf</option>
            <option value="Heifer">Heifer</option>
            <option value="Pregnant Heifer">Pregnant Heifer</option>
            <option value="Lactating">Lactating</option>
            <option value="Dry">Dry</option>
            <option value="Bull">Bull</option>
            <option value="Breeding Bull">Breeding Bull</option>
            <option value="Retired">Retired</option>
            <option value="Sold">Sold</option>
            <option value="Deceased">Deceased</option>
          </select>
        </Field>

        {/* Breeding method — live from breeding_records */}
        <Field label="Breeding method">
          <select className={inputCls} disabled>
            <option>{br.isLoading ? "Loading…" : br.method || "—"}</option>
          </select>
        </Field>

        {/* Last breeding — live from breeding_records */}
        <Field label="Last breeding">
          <input
            className={inputCls}
            type="date"
            value={br.isLoading ? "" : (br.lastBreedingDate ?? "")}
            readOnly
          />
        </Field>

        {/* Last delivery — live from pregnancy_records */}
        <Field label="Last delivery">
          <input
            className={inputCls}
            type="date"
            value={preg.isLoading ? "" : (preg.lastDelivery ?? "")}
            readOnly
          />
        </Field>

        {/* Current weight — live from growth_logs (latest recorded_date) */}
        <Field label="Current weight (kg)">
          <input
            className={inputCls}
            type="number"
            step="0.1"
            value={weightLoading ? "" : (weight ?? 0)}
            readOnly
          />
        </Field>

        {/* Daily milk — live from milk_logs (today's total, or most recent day) */}
        <Field label="Daily milk (L)">
          <input
            className={inputCls}
            type="number"
            step="0.1"
            value={milkLoading ? "" : (liters ?? 0)}
            readOnly
          />
        </Field>

        {/* Last checkup — from health_incidents module (stored on animal for now) */}
        <Field label="Last checkup">
          <input
            className={inputCls}
            type="date"
            defaultValue={
              typeof (animal as unknown as Record<string, unknown>)[
                "last_checkup_date"
              ] === "string"
                ? (
                    (animal as unknown as Record<string, unknown>)[
                      "last_checkup_date"
                    ] as string
                  ).slice(0, 10)
                : ""
            }
            readOnly
          />
        </Field>

        {/* Last vaccination — live from vaccination_records */}
        <Field label="Last vaccination">
          <input
            className={inputCls}
            type="date"
            value={vacc.isLoading ? "" : (vacc.lastDate ?? "")}
            readOnly
          />
        </Field>

        {/* Expected delivery — live from the active pregnancy record */}
        <Field label="Expected delivery">
          <input
            className={inputCls}
            type="date"
            value={preg.isLoading ? "" : (preg.expectedDelivery ?? "")}
            readOnly
          />
        </Field>
      </div>
    </div>
  );
}
