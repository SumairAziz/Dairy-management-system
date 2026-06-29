"use client";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AnimalPicker } from "./AnimalPicker";
import { Field, inputCls } from "@/app/components/modal";
import type { Animal } from "@/types";

interface Props {
  animal: Animal;
  onUpdate: (patch: Partial<Animal>) => void;
  animals: Animal[];
}

export function AnimalLineageCard({ animal, onUpdate, animals }: Props) {
  const offspring = [
    ...(animal.other_animals_animals_mother_idToanimals ?? []),
    ...(animal.other_animals_animals_father_idToanimals ?? []),
  ];

  return (
    <div className="surface border rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold">Lineage</h3>
      <AnimalPicker
        label="Mother"
        value={animal.mother_id ?? null}
        onChange={(id) => onUpdate({ mother_id: id })}
        animals={animals.filter((a) => a.gender === "F")}
        excludeId={animal.animal_id}
      />
      <AnimalPicker
        label="Father"
        value={animal.father_id ?? null}
        onChange={(id) => onUpdate({ father_id: id })}
        animals={animals.filter((a) => a.gender === "M")}
        excludeId={animal.animal_id}
      />
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
          Offspring ({offspring.length})
        </p>
        {offspring.length === 0 ? (
          <p className="text-xs text-slate-500">No offspring recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {offspring.map((c) => (
              <Link
                key={c.animal_id}
                href={`/animals/${c.animal_id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-teal-400 hover:border-teal-500 transition-colors"
              >
                #{c.tag_number}
                <ExternalLink size={10} className="opacity-60" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}