"use client";
import { Field, inputCls } from "@/app/components/modal";
import type { Animal, Farm, Unit } from "@/types";

interface Props {
  animal: Animal;
  onUpdate: (patch: Partial<Animal>) => void;
  farms: Farm[];
  units: Unit[];
}

export function AnimalLocationCard({ animal, onUpdate, farms, units }: Props) {
  const unitsForFarm = units.filter((u) => u.farm_id === animal.farm_id);

  return (
    <div className="surface border rounded-2xl p-5">
      <h3 className="font-semibold mb-3">Location & identity</h3>
      <div className="text-sm grid grid-cols-2 gap-2">
        <div className="muted">Farm</div>
        <div>
          <select
            className={inputCls}
            value={animal.farm_id ?? ""}
            onChange={(e) =>
              onUpdate({ farm_id: Number(e.target.value), unit_id: null })
            }
          >
            {farms.map((f) => (
              <option key={f.farm_id} value={f.farm_id}>
                {f.farm_name}
              </option>
            ))}
          </select>
        </div>
        <div className="muted">Unit</div>
        <div>
          <select
            className={inputCls}
            value={animal.unit_id ?? ""}
            onChange={(e) =>
              onUpdate({ unit_id: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">— None —</option>
            {unitsForFarm.map((u) => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.unit_name}
              </option>
            ))}
          </select>
        </div>
        <div className="muted">DOB</div>
        <div>{animal.date_of_birth?.slice(0, 10)}</div>
        <div className="muted">Breed</div>
        <div>{animal.breeds?.breed_name ?? "—"}</div>
        <div className="muted">Species</div>
        <div>{animal.breeds?.species?.species_name ?? "—"}</div>
        <div className="muted">Birth weight</div>
        <div>
          {animal.birth_weight_kg != null
            ? `${Number(animal.birth_weight_kg)} kg`
            : "—"}
        </div>
        <div className="muted">Active</div>
        <div>
          <button
            onClick={() => onUpdate({ is_active: !animal.is_active })}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              animal.is_active
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-400"
                : "bg-slate-700 border-slate-600 text-slate-400 hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:text-emerald-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${animal.is_active ? "bg-emerald-400" : "bg-slate-500"}`}
            />
            {animal.is_active ? "Active" : "Inactive"}
          </button>
        </div>
      </div>
    </div>
  );
}