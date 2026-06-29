"use client";
import { useState, use } from "react";
import { Navbar } from "@/app/components/navbar";
import { MetricCard } from "@/app/components/custom-charts";
import { useAnimal, useAnimals, useUpdateAnimal, useFarms, useUnits } from "@/hooks";
import { AnimalPicker } from "./components/AnimalPicker";
import { AnimalProfileTab, AnimalStatusCard } from "./components/AnimalProfileTab";
import { AnimalLineageCard } from "./components/AnimalLineageCard";
import { AnimalLocationCard } from "./components/AnimalLocationCard";
import { AnimalGrowthTab } from "./components/AnimalGrowthTab";
import { AnimalHealthTab } from "./components/AnimalHealthTab";
import { AnimalMilkTab } from "./components/AnimalMilkTab";
import { AnimalBreedingTab } from "./components/AnimalBreedingTab";
import { AnimalVaccinationTab } from "./components/AnimalVaccinationTab";
import type { Animal, Farm, Unit } from "@/types";
import type { UpdateAnimalInput } from "@/validators/animal.validator";

const TABS = ["profile", "growth", "health", "milk", "breeding", "vaccination"] as const;
type Tab = (typeof TABS)[number];

export default function AnimalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const animalId = Number(id);
  const [tab, setTab] = useState<Tab>("profile");

  const { data: animal, isLoading: animalLoading } = useAnimal(animalId);
  const { data: allAnimalsRes } = useAnimals();
  const { data: farmsList } = useFarms();
  const { data: unitsList } = useUnits();

  const updateMutation = useUpdateAnimal();

  if (animalLoading) return <div className="p-6 muted">Loading…</div>;
  if (!animal) return <div className="p-6 text-rose-500">Animal not found.</div>;

  const animals: Animal[] = allAnimalsRes?.data ?? [];
  const farms: Farm[] = farmsList ?? [];
  const units: Unit[] = unitsList ?? [];

  function update(patch: Partial<Animal>) {
    updateMutation.mutate({ id: animalId, data: patch as unknown as UpdateAnimalInput });
  }

  const ageMonths = Math.floor(
    (Date.now() - new Date(animal.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 30),
  );

  const currentWeight = Number(
    (animal as unknown as Record<string, number | null>).current_weight_kg || 0,
  );
  const dailyMilk = Number(
    (animal as unknown as Record<string, number | null>).daily_milk_production_liters || 0,
  );

  return (
    <>
      <Navbar
        title={`Animal #${animal.tag_number}`}
        subtitle={`${animal.breeds?.species?.species_name ?? ""} · ${animal.breeds?.breed_name ?? ""}`}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Gender" value={animal.gender === "F" ? "Female" : "Male"} />
          <MetricCard label="Age" value={`${ageMonths} mo`} />
          <MetricCard label="Weight" value={`${currentWeight.toFixed(1)} kg`} />
          <MetricCard label="Milk/day" value={`${dailyMilk.toFixed(1)} L`} />
        </div>

        <div className="flex gap-2 border-b overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px whitespace-nowrap ${
                tab === t
                  ? "border-brand-600 text-brand-700 dark:text-brand-300 font-medium"
                  : "border-transparent muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <AnimalStatusCard animal={animal} onUpdate={update} />
            <div className="space-y-4">
              <AnimalLineageCard
                animal={animal}
                onUpdate={update}
                animals={animals}
              />
              <AnimalLocationCard
                animal={animal}
                onUpdate={update}
                farms={farms}
                units={units}
              />
            </div>
          </div>
        )}
        {tab === "growth" && <AnimalGrowthTab animal={animal} />}
        {tab === "health" && <AnimalHealthTab animal={animal} />}
        {tab === "milk" && <AnimalMilkTab animal={animal} />}
        {tab === "breeding" && <AnimalBreedingTab animal={animal} />}
        {tab === "vaccination" && <AnimalVaccinationTab animal={animal} />}
      </div>
    </>
  );
}