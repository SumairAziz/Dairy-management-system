"use client";
import type { Animal, Farm, Unit } from "@/types";
import { AnimalStatusCard } from "./AnimalStatusCard";
import { AnimalLineageCard } from "./AnimalLineageCard";
import { AnimalLocationCard } from "./AnimalLocationCard";

interface Props {
  animal: Animal;
  onUpdate: (patch: Partial<Animal>) => void;
}

interface ProfileTabProps extends Props {
  animals?: Animal[];
  farms?: Farm[];
  units?: Unit[];
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
        <AnimalLineageCard animal={animal} onUpdate={onUpdate} animals={animals} />
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

// Re-exports so that any existing import from this barrel keeps working.
export { AnimalStatusCard } from "./AnimalStatusCard";
export { AnimalLineageCard } from "./AnimalLineageCard";
export { AnimalLocationCard } from "./AnimalLocationCard";
