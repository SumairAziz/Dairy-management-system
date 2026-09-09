"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { Plus, Filter, ChevronLeft, ChevronRight, Baby } from "lucide-react";
import Link from "next/link";
import {
  useAnimals,
  useCreateAnimal,
  useSpecies,
  useBreeds,
  useFarms,
  useUnits,
  useBreedingRecords,
  useUrlFilters,
} from "@/hooks";
import { AnimalCombobox } from "@/app/components/animal-combobox";
import { AnimalsDashboard, CHIP_FILTER_KEYS } from "@/app/animals/components/AnimalsDashboard";
import { lifecycleStageBadge, genderBadge, activeBadge, productionStatusBadge } from "@/lib/animal-status";
import { PRODUCTION_STATUS_LABELS } from "@/lib/production-status";
import { TABLE_ROW } from "@/lib/theme";
import { UniversalExportButton } from "@/components/export/UniversalExportButton";
import { usePermissions } from "@/hooks/use-permissions";

const LIFECYCLE_STAGES = [
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

const ANIMAL_FILTER_KEYS = [
  "farm_id",
  "unit_id",
  "breed_id",
  "species_id",
  "gender",
  "lifecycle_stage",
  "tag_number",
  "is_active",
  "pregnancy_status",
  "in_heat",
  "vaccination_due",
  "breeding_eligible",
  "has_health_issue",
  "stage_bucket",
  "production_status",
] as const;

const defaultForm = {
  tag_number: "",
  animal_name: "",
  gender: "F",
  date_of_birth: "",
  farm_id: "",
  unit_id: "",
  species_id: "",
  breed_id: "",
  birth_weight_kg: "",
  lifecycle_stage: "Calf",
  mother_id: "",
  father_id: "",
  father_mode: "existing",
  father_text: "",
};

export default function AnimalsPage() {
  const [filters, setFilters] = useUrlFilters(ANIMAL_FILTER_KEYS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("animal_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });

  const queryParams = useMemo(
    () => ({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [filters, page, pageSize, sortBy, sortDir],
  );

  const { data, isLoading } = useAnimals(queryParams);
  const { data: species } = useSpecies();
  const { data: breeds } = useBreeds();
  const { data: farms } = useFarms();
  const { data: units } = useUnits();

  const createMutation = useCreateAnimal();
  const { can } = usePermissions();
  const canCreateAnimal = can("animals.create");

  const [newbornMotherId, setNewbornMotherId] = useState("");
  const newbornPrefillApplied = useRef(false);

  const { data: femaleAnimals } = useAnimals({
    pageSize: "500",
    gender: "F",
    is_active: "true",
  });
  const { data: maleAnimals } = useAnimals({
    pageSize: "500",
    gender: "M",
    is_active: "true",
  });
  const { data: newbornBreeding } = useBreedingRecords(
    { female_animal_id: newbornMotherId, pageSize: "1" },
    Boolean(newbornMotherId),
  );

  useEffect(() => {
    if (open && species && species.length > 0 && !form.species_id) {
      setForm((f) => ({ ...f, species_id: String(species[0].species_id) }));
    }
  }, [open, species, form.species_id]);

  useEffect(() => {
    if (form.species_id && breeds) {
      const breedsForSpecies = breeds.filter(
        (b) => b.species_id === Number(form.species_id),
      );
      if (breedsForSpecies.length > 0 && !form.breed_id) {
        setForm((f) => ({
          ...f,
          breed_id: String(breedsForSpecies[0].breed_id),
        }));
      }
    }
  }, [form.species_id, breeds, form.breed_id]);

  // Read URL params written by the "Add Newborn" button on the Pregnancy page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newborn") !== "1") return;
    const motherId = params.get("mother_id") ?? "";
    const birthDate = params.get("birth_date") ?? "";
    if (motherId) setNewbornMotherId(motherId);
    setForm((f) => ({
      ...f,
      mother_id: motherId,
      date_of_birth: birthDate || f.date_of_birth,
      lifecycle_stage: "Calf",
    }));
    setOpen(true);
    window.history.replaceState({}, "", "/animals/list");
  }, []);

  // Once the mother's last breeding record loads, pre-fill the father field.
  useEffect(() => {
    if (newbornPrefillApplied.current) return;
    if (!newbornMotherId || !newbornBreeding?.data?.length) return;
    newbornPrefillApplied.current = true;
    const breeding = newbornBreeding.data[0];
    if (breeding.method === "Artificial Insemination") {
      setForm((f) => ({
        ...f,
        father_mode: "external",
        father_text: breeding.semen_batch_id
          ? `Semen batch: ${breeding.semen_batch_id}`
          : "AI insemination",
      }));
    } else if (breeding.male_animal_id) {
      setForm((f) => ({
        ...f,
        father_mode: "existing",
        father_id: String(breeding.male_animal_id),
      }));
    }
  }, [newbornBreeding, newbornMotherId]);

  function create() {
    if (!form.farm_id) {
      alert("Please select a farm.");
      return;
    }
    if (!form.breed_id) {
      alert("Please select a breed.");
      return;
    }
    if (!form.tag_number) {
      alert("Please enter a tag number.");
      return;
    }

    const payload = {
      tag_number: String(form.tag_number),
      animal_name: form.animal_name || null,
      gender: form.gender as "M" | "F",
      farm_id: Number(form.farm_id),
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      breed_id: Number(form.breed_id),
      date_of_birth: form.date_of_birth,
      birth_weight_kg: form.birth_weight_kg
        ? Number(form.birth_weight_kg)
        : null,
      lifecycle_stage: form.lifecycle_stage,
      is_active: true,
      mother_id: form.mother_id ? Number(form.mother_id) : null,
      father_id:
        form.father_mode === "existing" && form.father_id
          ? Number(form.father_id)
          : null,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        setForm({ ...defaultForm });
        setNewbornMotherId("");
        newbornPrefillApplied.current = false;
      },
      onError: (err) => {
        alert(err.message);
      },
    });
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  function applyQuickFilter(chipFilters: Record<string, string>) {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev };
      for (const k of CHIP_FILTER_KEYS) delete next[k];
      return { ...next, ...chipFilters };
    });
  }

  const breedsForSpecies = form.species_id
    ? (breeds?.filter((b) => b.species_id === Number(form.species_id)) ?? [])
    : [];

  return (
    <>
      <Navbar title="Animals" subtitle={`${data?.total ?? 0} records`} />
      <div className="p-6 space-y-4">
        <AnimalsDashboard filters={filters} onQuickFilter={applyQuickFilter} />

        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
            >
              <Filter size={14} />
              Filters
            </button>
            <input
              placeholder="Tag #"
              className={`${inputCls} max-w-[120px]`}
              value={filters.tag_number ?? ""}
              onChange={(e) => {
                setPage(1);
                setFilters({ ...filters, tag_number: e.target.value });
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <UniversalExportButton
              resource="animals"
              filters={filters}
              extraParams={{ sortBy, sortDir }}
            />
            {canCreateAnimal && (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white"
              >
                <Plus size={14} />
                New animal
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="surface border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Species">
              <select
                className={inputCls}
                value={filters.species_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, species_id: e.target.value });
                }}
              >
                <option value="">All</option>
                {species?.map((s) => (
                  <option key={s.species_id} value={s.species_id}>
                    {s.species_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Breed">
              <select
                className={inputCls}
                value={filters.breed_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, breed_id: e.target.value });
                }}
              >
                <option value="">All</option>
                {breeds?.map((b) => (
                  <option key={b.breed_id} value={b.breed_id}>
                    {b.breed_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Farm">
              <select
                className={inputCls}
                value={filters.farm_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({
                    ...filters,
                    farm_id: e.target.value,
                    unit_id: "",
                  });
                }}
              >
                <option value="">All</option>
                {farms?.map((f) => (
                  <option key={f.farm_id} value={f.farm_id}>
                    {f.farm_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select
                className={inputCls}
                value={filters.unit_id ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, unit_id: e.target.value });
                }}
              >
                <option value="">All</option>
                {units
                  ?.filter(
                    (u) =>
                      !filters.farm_id || u.farm_id === Number(filters.farm_id),
                  )
                  .map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.unit_name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Gender">
              <select
                className={inputCls}
                value={filters.gender ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, gender: e.target.value });
                }}
              >
                <option value="">All</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </Field>
            <Field label="Production Status">
              <select
                className={inputCls}
                value={filters.production_status ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, production_status: e.target.value });
                }}
              >
                <option value="">All</option>
                <option value="lactating">Lactating</option>
                <option value="dry">Dry</option>
                <option value="never_lactated">Never Lactated</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
            </Field>
            <Field label="Lifecycle">
              <select
                className={inputCls}
                value={filters.lifecycle_stage ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, lifecycle_stage: e.target.value });
                }}
              >
                <option value="">All</option>
                {LIFECYCLE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Active">
              <select
                className={inputCls}
                value={filters.is_active ?? ""}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, is_active: e.target.value });
                }}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
        )}

        <div className="surface border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left muted surface-2">
              <tr>
                {(
                  [
                    ["tag_number", "Tag"],
                    ["gender", "Sex"],
                    ["lifecycle_stage", "Stage"],
                    ["date_of_birth", "Birth date"],
                  ] as const
                ).map(([k, l]) => (
                  <th
                    key={k}
                    className="px-3 py-2 cursor-pointer"
                    onClick={() => {
                      setSortBy(k);
                      setSortDir(
                        sortBy === k && sortDir === "asc" ? "desc" : "asc",
                      );
                    }}
                  >
                    {l} {sortBy === k && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                ))}
                <th>Breed</th>
                <th>Production</th>
                <th>Farm</th>
                <th>Unit</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="py-6 text-center muted">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.data.map((a) => (
                <tr key={a.animal_id} className={TABLE_ROW}>
                  <td className="px-3 py-2 font-medium">#{a.tag_number}</td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${genderBadge(a.gender).cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${genderBadge(a.gender).dot}`} />
                      {a.gender}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${lifecycleStageBadge(a.lifecycle_stage).cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${lifecycleStageBadge(a.lifecycle_stage).dot}`} />
                      {a.lifecycle_stage}
                    </span>
                  </td>
                  <td>{a.date_of_birth?.slice(0, 10) ?? "—"}</td>
                  <td>{a.breeds?.breed_name ?? "—"}</td>
                  <td>
                    {a.production_status ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${productionStatusBadge(a.production_status).cls}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${productionStatusBadge(a.production_status).dot}`} />
                        {PRODUCTION_STATUS_LABELS[a.production_status as keyof typeof PRODUCTION_STATUS_LABELS] ?? a.production_status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{a.farms?.farm_name ?? "—"}</td>
                  <td>{a.units?.unit_name ?? "—"}</td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${activeBadge(a.is_active).cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeBadge(a.is_active).dot}`} />
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="text-brand-600 hover:underline"
                      href={`/animals/list/${a.animal_id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {data && !data.data.length && !isLoading && (
                <tr>
                  <td colSpan={11} className="py-6 text-center muted">
                    No animals match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-3">
            <span className="muted">
              Page {page} of {totalPages}
            </span>
            <label className="flex items-center gap-2 muted">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="surface border rounded px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded surface border disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded surface border disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setForm({ ...defaultForm });
          setNewbornMotherId("");
          newbornPrefillApplied.current = false;
        }}
        title="New animal"
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
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tag number">
            <input
              className={inputCls}
              type="text"
              value={form.tag_number}
              onChange={(e) => setForm({ ...form, tag_number: e.target.value })}
            />
          </Field>
          <Field label="Name (optional)">
            <input
              className={inputCls}
              type="text"
              value={form.animal_name}
              onChange={(e) =>
                setForm({ ...form, animal_name: e.target.value })
              }
            />
          </Field>
          <Field label="Gender">
            <select
              className={inputCls}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </Field>
          <Field label="Species">
            <select
              className={inputCls}
              value={form.species_id}
              onChange={(e) =>
                setForm({ ...form, species_id: e.target.value, breed_id: "" })
              }
            >
              <option value="">Select…</option>
              {species?.map((s) => (
                <option key={s.species_id} value={s.species_id}>
                  {s.species_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Breed">
            <select
              className={inputCls}
              value={form.breed_id}
              onChange={(e) => setForm({ ...form, breed_id: e.target.value })}
            >
              <option value="">Select…</option>
              {breedsForSpecies.map((b) => (
                <option key={b.breed_id} value={b.breed_id}>
                  {b.breed_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of birth">
            <input
              className={inputCls}
              type="date"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value })
              }
            />
          </Field>

          {/* ── Lineage ───────────────────────────────────────────────── */}
          {newbornMotherId && (
            <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm">
              <Baby size={14} className="text-emerald-400 shrink-0" />
              <span>Pre-filling from delivery record — review and complete all required fields.</span>
            </div>
          )}
          <Field label="Mother (optional)">
            <AnimalCombobox
              animals={femaleAnimals?.data ?? []}
              value={form.mother_id}
              onChange={(id) => setForm({ ...form, mother_id: id })}
              placeholder="Search dam by tag, name, breed…"
            />
          </Field>
          <div>
            <div className="text-xs uppercase tracking-wider muted mb-1">
              Father (optional)
            </div>
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, father_mode: "existing", father_text: "" })
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  form.father_mode === "existing"
                    ? "bg-brand-500/15 border-brand-500/40 text-brand-400"
                    : "surface border muted"
                }`}
              >
                Farm Bull
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, father_mode: "external", father_id: "" })
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  form.father_mode === "external"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                    : "surface border muted"
                }`}
              >
                AI / External
              </button>
            </div>
            {form.father_mode === "existing" ? (
              <AnimalCombobox
                animals={maleAnimals?.data ?? []}
                value={form.father_id}
                onChange={(id) => setForm({ ...form, father_id: id })}
                placeholder="Search sire by tag, name, breed…"
              />
            ) : (
              <div>
                <input
                  className={inputCls}
                  placeholder="e.g. Semen batch AI-2024-001 or sire name…"
                  value={form.father_text}
                  onChange={(e) =>
                    setForm({ ...form, father_text: e.target.value })
                  }
                />
                <p className="mt-1 text-xs muted">
                  Informational only — no farm animal record will be linked.
                </p>
              </div>
            )}
          </div>

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
          <Field label="Unit">
            <select
              className={inputCls}
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
            >
              <option value="">None</option>
              {units
                ?.filter(
                  (u) => !form.farm_id || u.farm_id === Number(form.farm_id),
                )
                .map((u) => (
                  <option key={u.unit_id} value={u.unit_id}>
                    {u.unit_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Lifecycle stage">
            <select
              className={inputCls}
              value={form.lifecycle_stage}
              onChange={(e) =>
                setForm({ ...form, lifecycle_stage: e.target.value })
              }
            >
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Birth weight (kg)">
            <input
              className={inputCls}
              type="number"
              step="0.1"
              value={form.birth_weight_kg}
              onChange={(e) =>
                setForm({ ...form, birth_weight_kg: e.target.value })
              }
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
