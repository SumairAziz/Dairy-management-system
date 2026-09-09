"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { Field, inputCls, Modal } from "@/app/components/modal";
import { useExportToast } from "@/components/export/ExportToastProvider";
import {
  useAnimals,
  useFarms,
  useUnits,
  useGroupTreatmentPreview,
  useExecuteGroupTreatment,
  useGroupTreatmentProducts,
} from "@/hooks";
import { routes } from "@/lib/routes";
import {
  filterProductsBySearch,
  inventoryCategoriesForType,
} from "@/lib/group-treatment";
import { GroupTreatmentProductSelector } from "./components/GroupTreatmentProductSelector";
import type { GroupTreatmentInput } from "@/validators/group-treatment.validator";
import type { GroupTreatmentPreviewResult, GroupTreatmentResult } from "@/hooks/use-group-treatment";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Users,
  Syringe,
  Pill,
} from "lucide-react";

const STEPS = ["Location", "Animals", "Treatment", "Review"] as const;

type TreatmentType = "vaccination" | "medicine";

export default function GroupTreatmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [farmId, setFarmId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [treatmentType, setTreatmentType] = useState<TreatmentType>("vaccination");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dosage, setDosage] = useState("");
  const [treatmentDate, setTreatmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextDueDate, setNextDueDate] = useState("");
  const [administeredBy, setAdministeredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<GroupTreatmentPreviewResult | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [successResult, setSuccessResult] = useState<GroupTreatmentResult | null>(null);

  const { showToast } = useExportToast();

  const { data: farms } = useFarms();
  const { data: units } = useUnits(farmId ? Number(farmId) : undefined);
  const { data: animalsRes, isLoading: loadingAnimals } = useAnimals(
    farmId && unitId
      ? {
          farm_id: farmId,
          unit_id: unitId,
          is_active: "true",
          pageSize: "500",
        }
      : { pageSize: "0" },
  );

  const inventoryCategory = inventoryCategoriesForType(treatmentType)[0];
  const { data: treatmentProducts = [], isLoading: loadingProducts } =
    useGroupTreatmentProducts({
      farm_id: farmId,
      treatment_type: treatmentType,
      enabled: Boolean(farmId),
    });

  const filteredProducts = useMemo(
    () => filterProductsBySearch(treatmentProducts, productSearch),
    [treatmentProducts, productSearch],
  );

  const previewMutation = useGroupTreatmentPreview();
  const executeMutation = useExecuteGroupTreatment();

  const unitAnimals = animalsRes?.data ?? [];
  const selectedItem = treatmentProducts.find(
    (i) => i.item_id === Number(inventoryItemId),
  );

  useEffect(() => {
    setInventoryItemId("");
    setProductSearch("");
    setDosage("");
  }, [treatmentType]);

  useEffect(() => {
    if (
      inventoryItemId &&
      !treatmentProducts.some((item) => item.item_id === Number(inventoryItemId))
    ) {
      setInventoryItemId("");
    }
  }, [treatmentProducts, inventoryItemId]);

  useEffect(() => {
    setUnitId("");
    setSelectedIds([]);
  }, [farmId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [unitId]);

  useEffect(() => {
    setPreview(null);
    setAllowDuplicates(false);
  }, [
    farmId,
    unitId,
    treatmentType,
    selectedIds,
    inventoryItemId,
    dosage,
    treatmentDate,
  ]);

  const payload = useMemo((): GroupTreatmentInput | null => {
    if (!farmId || !unitId || !inventoryItemId || !dosage || selectedIds.length === 0) {
      return null;
    }
    return {
      farm_id: Number(farmId),
      unit_id: Number(unitId),
      treatment_type: treatmentType,
      inventory_item_id: Number(inventoryItemId),
      treatment_date: treatmentDate,
      dosage_per_animal: Number(dosage),
      animal_ids: selectedIds,
      administered_by: administeredBy || null,
      notes: notes || null,
      next_due_date: treatmentType === "vaccination" && nextDueDate ? nextDueDate : null,
      allow_duplicates: allowDuplicates,
    };
  }, [
    farmId,
    unitId,
    treatmentType,
    inventoryItemId,
    dosage,
    treatmentDate,
    selectedIds,
    administeredBy,
    notes,
    nextDueDate,
    allowDuplicates,
  ]);

  const localRequired =
    selectedIds.length > 0 && dosage
      ? Number((selectedIds.length * Number(dosage || 0)).toFixed(2))
      : 0;
  const localAvailable = selectedItem?.quantity ?? 0;
  const localUnit = selectedItem?.unit ?? "units";
  const selectedOutOfStock = Boolean(selectedItem && selectedItem.quantity <= 0);
  const stockInsufficient = localRequired > localAvailable;
  const canProceedToReview =
    Boolean(payload) &&
    !selectedOutOfStock &&
    !stockInsufficient &&
    Boolean(inventoryItemId);

  function toggleAnimal(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAll() {
    setSelectedIds(unitAnimals.map((a) => a.animal_id));
  }

  function clearAll() {
    setSelectedIds([]);
  }

  async function loadPreview() {
    if (!payload) return;
    const result = await previewMutation.mutateAsync(payload);
    setPreview(result);
    setStep(3);
  }

  async function confirmTreatment() {
    if (!payload || executeMutation.isPending) return;
    try {
      const result = await executeMutation.mutateAsync(payload);
      setSuccessResult(result);
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Batch treatment failed.",
        "error",
      );
    }
  }

  function closeSuccessAndExit() {
    setSuccessResult(null);
    router.push(routes.vaccinations);
  }

  return (
    <>
      <Navbar
        title="Group Treatment"
        subtitle="Vaccinate or treat an entire unit in one batch"
      />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link
          href={routes.vaccinations}
          className="inline-flex items-center gap-2 text-sm muted hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to vaccinations
        </Link>

        <div className="flex gap-2 flex-wrap">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                i === step
                  ? "bg-brand-600 text-white border-brand-600"
                  : i < step
                    ? "bg-brand-500/10 text-brand-400 border-brand-500/30"
                    : "surface border"
              }`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="surface border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold">Select location & treatment type</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Farm">
                <select
                  className={inputCls}
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                >
                  <option value="">Select farm…</option>
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
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={!farmId}
                >
                  <option value="">Select unit…</option>
                  {units?.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.unit_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Treatment type">
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTreatmentType("vaccination")}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left ${
                    treatmentType === "vaccination"
                      ? "border-brand-500 bg-brand-500/10"
                      : "surface"
                  }`}
                >
                  <Syringe size={18} className="text-brand-400" />
                  <div>
                    <div className="font-medium text-sm">Vaccination</div>
                    <div className="text-xs muted">Creates vaccination records</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTreatmentType("medicine")}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left ${
                    treatmentType === "medicine"
                      ? "border-amber-500 bg-amber-500/10"
                      : "surface"
                  }`}
                >
                  <Pill size={18} className="text-amber-400" />
                  <div>
                    <div className="font-medium text-sm">Medicine</div>
                    <div className="text-xs muted">Creates health + treatment records</div>
                  </div>
                </button>
              </div>
            </Field>
            <button
              disabled={!farmId || !unitId}
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50"
            >
              Next <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="surface border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Users size={16} /> Select animals
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-sm muted min-w-0">
                Selected: <strong>{selectedIds.length}</strong> of {unitAnimals.length} animals
              </p>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button onClick={selectAll} className="text-sm px-3 py-1.5 rounded-lg border">
                  Select all ({unitAnimals.length})
                </button>
                <button onClick={clearAll} className="text-sm px-3 py-1.5 rounded-lg border">
                  Clear
                </button>
              </div>
            </div>
            {loadingAnimals ? (
              <p className="text-sm muted">Loading animals…</p>
            ) : unitAnimals.length === 0 ? (
              <p className="text-sm muted">No active animals in this unit.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto border rounded-xl divide-y divide-black/5 dark:divide-white/10">
                {unitAnimals.map((a) => (
                  <label
                    key={a.animal_id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a.animal_id)}
                      onChange={() => toggleAnimal(a.animal_id)}
                    />
                    <span className="font-medium text-sm">{a.tag_number}</span>
                    <span className="text-sm muted">{a.animal_name ?? "—"}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(0)} className="px-4 py-2 rounded-lg border text-sm">
                Back
              </button>
              <button
                disabled={selectedIds.length === 0}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="surface border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold">Treatment details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <GroupTreatmentProductSelector
                label={`Product (${inventoryCategory})`}
                products={filteredProducts}
                selectedId={inventoryItemId}
                search={productSearch}
                loading={loadingProducts}
                onSearchChange={setProductSearch}
                onSelect={(itemId) => setInventoryItemId(String(itemId))}
              />
              <Field label={`Dosage per animal (${selectedItem?.unit ?? "unit"})`}>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                />
              </Field>
              <Field label="Treatment date">
                <input
                  type="date"
                  className={inputCls}
                  value={treatmentDate}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                />
              </Field>
              {treatmentType === "vaccination" && (
                <Field label="Next due date (optional)">
                  <input
                    type="date"
                    className={inputCls}
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Administered by">
                <input
                  className={inputCls}
                  value={administeredBy}
                  onChange={(e) => setAdministeredBy(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {selectedItem && dosage && selectedIds.length > 0 && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  stockInsufficient || selectedOutOfStock
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
                }`}
              >
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>Selected animals: <strong>{selectedIds.length}</strong></div>
                  <div>
                    Dosage: <strong>{dosage} {localUnit}</strong>/animal
                  </div>
                  <div>
                    Total required: <strong>{localRequired} {localUnit}</strong>
                  </div>
                  <div>
                    Available stock: <strong>{localAvailable} {localUnit}</strong>
                  </div>
                  <div>
                    Remaining after:{" "}
                    <strong>{Number((localAvailable - localRequired).toFixed(2))} {localUnit}</strong>
                  </div>
                </div>
                {selectedOutOfStock && (
                  <p className="text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Selected product has no available stock. Choose a different product.
                  </p>
                )}
                {!selectedOutOfStock && stockInsufficient && (
                  <p className="text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Shortfall: {Number((localRequired - localAvailable).toFixed(2))} {localUnit}
                  </p>
                )}
              </div>
            )}

            {!inventoryItemId && !loadingProducts && treatmentProducts.length > 0 && (
              <p className="text-sm muted">Select a product from the list above to continue.</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border text-sm">
                Back
              </button>
              <button
                disabled={!canProceedToReview || previewMutation.isPending}
                onClick={loadPreview}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50"
              >
                {previewMutation.isPending ? "Checking…" : "Review summary"}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="surface border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" /> Confirm batch treatment
            </h2>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted uppercase">Animals</div>
                <div className="text-xl font-semibold">{preview.summary.selected_count}</div>
              </div>
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted uppercase">Product</div>
                <div className="font-semibold">{preview.inventory.item_name}</div>
              </div>
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted uppercase">Dosage / animal</div>
                <div className="font-semibold">
                  {preview.summary.dosage_per_animal} {preview.inventory.unit}
                </div>
              </div>
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted uppercase">Total required</div>
                <div className="font-semibold">
                  {preview.summary.required_quantity} {preview.inventory.unit}
                </div>
              </div>
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted uppercase">Current stock</div>
                <div className="font-semibold">
                  {preview.summary.available_stock} {preview.inventory.unit}
                </div>
              </div>
              <div className="rounded-xl border surface p-3">
                <div className="text-xs muted uppercase">Remaining after</div>
                <div className="font-semibold text-emerald-400">
                  {preview.summary.remaining_after} {preview.inventory.unit}
                </div>
              </div>
            </div>

            {preview.duplicates.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2 text-amber-300">
                  <AlertTriangle size={14} />
                  {preview.duplicates.length} animal(s) already treated on this date
                </p>
                <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {preview.duplicates.map((d) => (
                    <li key={d.animal_id} className="muted">
                      {d.tag_number} {d.animal_name ? `· ${d.animal_name}` : ""} — {d.reason}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowDuplicates}
                    onChange={(e) => setAllowDuplicates(e.target.checked)}
                  />
                  Skip duplicate animals and treat the rest only
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border text-sm">
                Back
              </button>
              <button
                disabled={
                  !preview.summary.sufficient ||
                  executeMutation.isPending ||
                  (preview.duplicates.length > 0 &&
                    !allowDuplicates &&
                    preview.duplicates.length >= preview.summary.selected_count)
                }
                onClick={confirmTreatment}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
              >
                {executeMutation.isPending ? "Processing…" : "Confirm treatment"}
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={successResult != null}
        onClose={closeSuccessAndExit}
        title="Batch Treatment Completed"
        footer={
          <>
            <Link
              href={routes.vaccinations}
              onClick={() => setSuccessResult(null)}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-black/5 dark:hover:bg-white/10"
            >
              View vaccinations
            </Link>
            <button
              onClick={closeSuccessAndExit}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              Done
            </button>
          </>
        }
      >
        {successResult && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-medium">
                  Batch #{successResult.batch_id} was completed successfully.
                </p>
                {successResult.skipped_duplicates > 0 && (
                  <p className="text-sm muted mt-1">
                    {successResult.skipped_duplicates} duplicate animal(s) were skipped.
                  </p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between sm:block gap-4">
                <dt className="muted">Animals treated</dt>
                <dd className="font-semibold sm:mt-0.5">{successResult.records_created}</dd>
              </div>
              <div className="flex justify-between sm:block gap-4">
                <dt className="muted">Records created</dt>
                <dd className="font-semibold sm:mt-0.5">{successResult.records_created}</dd>
              </div>
              <div className="flex justify-between sm:block gap-4">
                <dt className="muted">Doses used</dt>
                <dd className="font-semibold sm:mt-0.5">
                  {successResult.total_quantity_used} {successResult.inventory_unit}
                </dd>
              </div>
              <div className="flex justify-between sm:block gap-4">
                <dt className="muted">Product</dt>
                <dd className="font-semibold sm:mt-0.5">{successResult.product_name}</dd>
              </div>
              <div className="flex justify-between sm:block gap-4 sm:col-span-2">
                <dt className="muted">Remaining stock</dt>
                <dd className="font-semibold text-emerald-400 sm:mt-0.5">
                  {successResult.remaining_stock} {successResult.inventory_unit}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </>
  );
}
