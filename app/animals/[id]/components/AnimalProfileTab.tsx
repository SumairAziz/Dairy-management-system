"use client";
import type { Animal } from "@/types";
import { Field, inputCls } from "@/app/components/modal";
import { AnimalLineageCard } from "./AnimalLineageCard";
import { AnimalLocationCard } from "./AnimalLocationCard";
import { useVaccinations } from "@/hooks";
import {
  getAnimalVaccinationStatus,
  animalStatusStyle,
} from "@/lib/vaccination-status";

function ageMonths(dob: string): number {
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30),
  );
}

/** Helper to safely read fields that may exist on the serialized animal but aren't in the strict type */
function field(animal: Animal, key: string): string | number | null {
  return (
    (animal as unknown as Record<string, string | number | null>)[key] ?? null
  );
}

function dateStr(val: unknown): string {
  return typeof val === "string" ? val.slice(0, 10) : "";
}

interface Props {
  animal: Animal;
  onUpdate: (patch: Partial<Animal>) => void;
}

interface ProfileTabProps extends Props {
  animals?: Animal[];
  farms?: import("@/types").Farm[];
  units?: import("@/types").Unit[];
}

/**
 * Small badge that displays the animal's vaccination status, computed live
 * from the latest vaccination record's `next_due_date`. No stored status
 * field is read — the value refreshes automatically whenever a new
 * vaccination is recorded or as the current date changes.
 */
function VaccinationStatusBadge({ animalId }: { animalId: number }) {
  const { data: vaccData, isLoading } = useVaccinations({
    animal_id: String(animalId),
    pageSize: "100",
  });

  const records = vaccData?.data ?? [];
  const status = getAnimalVaccinationStatus(records);
  const style = animalStatusStyle(status);

  return (
    <div className="flex items-center gap-2 h-[38px]">
      {isLoading ? (
        <span className="text-sm muted">Calculating…</span>
      ) : (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.badgeClass}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: style.dotColor }}
          />
          {style.label}
        </span>
      )}
    </div>
  );
}

export function AnimalStatusCard({ animal, onUpdate }: Props) {
  return (
    <div className="surface border rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold">Status</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Health">
          <select
            className={inputCls}
            defaultValue={String(field(animal, "health_status") ?? "")}
            onBlur={(e) =>
              onUpdate({
                lifecycle_stage: animal.lifecycle_stage,
                is_active: animal.is_active,
              } as Partial<Animal> & Record<string, string>)
            }
          >
            <option>Healthy</option>
            <option>Sick</option>
            <option>Recovering</option>
            <option>Critical</option>
          </select>
        </Field>
        <Field label="Vaccination">
          {/* Dynamically derived from the latest vaccination record's
              next_due_date — never read from a stored status field. */}
          <VaccinationStatusBadge animalId={animal.animal_id} />
        </Field>
        <Field label="Pregnancy">
          <select
            className={inputCls}
            defaultValue={String(field(animal, "pregnancy_status") ?? "")}
            disabled
          >
            <option>Not Pregnant</option>
            <option>Pregnant</option>
          </select>
        </Field>
        <Field label="Heat cycle">
          <select
            className={inputCls}
            defaultValue={String(field(animal, "heat_cycle_status") ?? "")}
            disabled
          >
            <option>Not in Heat</option>
            <option>In Heat</option>
          </select>
        </Field>
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
        <Field label="Breeding method">
          <select
            className={inputCls}
            defaultValue={String(field(animal, "breeding_method") ?? "")}
            disabled
          >
            <option>Natural</option>
            <option>AI</option>
          </select>
        </Field>
        <Field label="Current weight (kg)">
          <input
            className={inputCls}
            type="number"
            step="0.1"
            defaultValue={String(field(animal, "current_weight_kg") ?? 0)}
            readOnly
          />
        </Field>
        <Field label="Daily milk (L)">
          <input
            className={inputCls}
            type="number"
            step="0.1"
            defaultValue={String(
              field(animal, "daily_milk_production_liters") ?? 0,
            )}
            readOnly
          />
        </Field>
        <Field label="Last checkup">
          <input
            className={inputCls}
            type="date"
            defaultValue={dateStr(field(animal, "last_checkup_date"))}
            readOnly
          />
        </Field>
        <Field label="Last vaccination">
          <input
            className={inputCls}
            type="date"
            defaultValue={dateStr(field(animal, "last_vaccination_date"))}
            readOnly
          />
        </Field>
        <Field label="Last breeding">
          <input
            className={inputCls}
            type="date"
            defaultValue={dateStr(field(animal, "last_breeding_date"))}
            readOnly
          />
        </Field>
        <Field label="Expected delivery">
          <input
            className={inputCls}
            type="date"
            defaultValue={dateStr(field(animal, "expected_delivery_date"))}
            readOnly
          />
        </Field>
      </div>
    </div>
  );
}

export function AnimalProfileTab({
  animal,
  onUpdate,
  animals = [],
  farms = [],
  units = [],
}: ProfileTabProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <AnimalStatusCard animal={animal} onUpdate={onUpdate} />
      <div className="space-y-4">
        <AnimalLineageCard
          animal={animal}
          onUpdate={onUpdate}
          animals={animals}
        />
        <AnimalLocationCard
          animal={animal}
          onUpdate={onUpdate}
          farms={farms}
          units={units}
        />
      </div>
    </div>
  );
}

export { AnimalLineageCard } from "./AnimalLineageCard";
export { AnimalLocationCard } from "./AnimalLocationCard";
