"use client";
import { useState, useRef, useEffect, useId } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import type { Animal } from "@/types";

interface Props {
  animals: Animal[];
  value: string; // animal_id as string, "" = none
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function matchAnimal(a: Animal, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    a.tag_number.toLowerCase().includes(lower) ||
    (a.animal_name ?? "").toLowerCase().includes(lower) ||
    String(a.animal_id).includes(lower) ||
    (a.breeds?.breed_name ?? "").toLowerCase().includes(lower)
  );
}

function animalLabel(a: Animal): string {
  return `#${a.tag_number}${a.animal_name ? ` – ${a.animal_name}` : ""}`;
}

function animalSub(a: Animal): string {
  const parts: string[] = [];
  if (a.breeds?.breed_name) parts.push(a.breeds.breed_name);
  if (a.breeds?.species?.species_name) parts.push(a.breeds.species.species_name);
  return parts.join(" · ");
}

export function AnimalCombobox({
  animals,
  value,
  onChange,
  placeholder = "Search by tag, name, breed…",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = value ? animals.find((a) => String(a.animal_id) === value) : null;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? animals.filter((a) => matchAnimal(a, query))
    : animals;

  function openDropdown() {
    if (!disabled) {
      setOpen(true);
      setHighlightIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function select(a: Animal) {
    onChange(String(a.animal_id));
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        openDropdown();
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlightIdx((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (filtered[highlightIdx]) select(filtered[highlightIdx]);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKey}>
      {/* Trigger button — shows selected animal or placeholder */}
      <button
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={[
          "w-full surface border rounded-lg px-3 py-2 text-sm text-left",
          "focus:outline-none focus:ring-2 focus:ring-brand-500",
          "flex items-center gap-2",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span className={`flex-1 truncate ${selected ? "" : "muted"}`}>
          {selected ? animalLabel(selected) : <span className="muted">Select animal…</span>}
        </span>
        {selected ? (
          <X
            size={14}
            className="shrink-0 muted hover:text-red-400 transition-colors"
            onClick={clear}
            aria-label="Clear selection"
          />
        ) : (
          <ChevronDown size={14} className="shrink-0 muted" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id={listId}
          role="listbox"
          className={[
            "absolute z-50 w-full mt-1 rounded-xl border shadow-2xl",
            "surface overflow-hidden",
            "border-black/10 dark:border-white/10",
          ].join(" ")}
          style={{ maxHeight: "320px", display: "flex", flexDirection: "column" }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-black/5 dark:border-white/10 shrink-0">
            <Search size={14} className="muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIdx(0);
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setHighlightIdx(0); }}
                className="muted hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Results list */}
          <div className="overflow-y-auto" style={{ maxHeight: "260px" }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center muted">
                No animals match "{query}"
              </div>
            ) : (
              filtered.map((a, idx) => {
                const isSelected = String(a.animal_id) === value;
                const isHighlighted = idx === highlightIdx;
                const sub = animalSub(a);
                return (
                  <button
                    key={a.animal_id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(a)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    className={[
                      "w-full text-left px-3 py-2 flex items-center justify-between gap-3 text-sm transition-colors",
                      isHighlighted ? "bg-brand-500/10" : "",
                      isSelected ? "text-brand-400" : "",
                    ].join(" ")}
                  >
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium truncate">{animalLabel(a)}</span>
                      {sub && <span className="text-xs muted truncate">{sub}</span>}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
