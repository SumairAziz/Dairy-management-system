"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Field, inputCls } from "@/app/components/modal";
import type { Animal } from "@/types";

export function AnimalPicker({
  label,
  value,
  onChange,
  animals,
  excludeId,
}: {
  label: string;
  value: number | null;
  onChange: (id: number | null) => void;
  animals: Animal[];
  excludeId: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = animals.find((a) => a.animal_id === value);
  const filtered = animals
    .filter((a) => a.animal_id !== excludeId)
    .filter(
      (a) =>
        !query ||
        String(a.tag_number).includes(query) ||
        (a.breeds?.breed_name ?? "")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, 30);

  return (
    <Field label={label}>
      <div className="relative">
        {selected ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm">
            <Link
              href={`/animals/list/${selected.animal_id}`}
              className="text-teal-400 hover:underline flex items-center gap-1 flex-1"
              onClick={(e) => e.stopPropagation()}
            >
              #{selected.tag_number}
              {selected.breeds?.breed_name
                ? ` · ${selected.breeds.breed_name}`
                : ""}
              <ExternalLink size={11} className="opacity-60" />
            </Link>
            <button
              onClick={() => onChange(null)}
              className="text-slate-400 hover:text-rose-400 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <input
            className={inputCls}
            placeholder="Search by tag or breed…"
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
          />
        )}
        {open && !selected && (
          <div className="absolute z-30 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">
                No animals found.
              </div>
            )}
            {filtered.map((a) => (
              <button
                key={a.animal_id}
                onMouseDown={() => {
                  onChange(a.animal_id);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 flex items-center justify-between"
              >
                <span className="font-mono text-teal-400">
                  #{a.tag_number}
                </span>
                <span className="text-slate-400 text-xs">
                  {a.breeds?.breed_name ?? ""} ·{" "}
                  {a.gender === "F" ? "Female" : "Male"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}