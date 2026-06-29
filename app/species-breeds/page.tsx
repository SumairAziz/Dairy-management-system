"use client";
import { useState, useEffect } from "react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useSpecies, useBreeds, useCreateSpecies, useDeleteSpecies, useCreateBreed, useDeleteBreed } from "@/hooks";

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
            <AlertTriangle size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function SpeciesBreedsPage() {
  const { data: species, isLoading: spLoading } = useSpecies();
  const { data: breeds, isLoading: brLoading } = useBreeds();

  const [spOpen, setSpOpen] = useState(false);
  const [brOpen, setBrOpen] = useState(false);
  const [sp, setSp] = useState({ species_name: "", scientific_name: "" });
  const [br, setBr] = useState({ breed_name: "", species_id: "" });
  const [selectedSpecies, setSelectedSpecies] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const createSpeciesMutation = useCreateSpecies();
  const deleteSpeciesMutation = useDeleteSpecies();
  const createBreedMutation = useCreateBreed();
  const deleteBreedMutation = useDeleteBreed();

  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirm({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirm((c) => ({ ...c, open: false }));

  useEffect(() => {
    if (species?.length && selectedSpecies === null) {
      setSelectedSpecies(species[0].species_id);
    }
  }, [species]);

  const filteredBreeds = selectedSpecies
    ? breeds?.filter((b) => b.species_id === selectedSpecies)
    : [];

  const selectedSpeciesName = species?.find(
    (s) => s.species_id === selectedSpecies,
  )?.species_name;

  return (
    <>
      <Navbar title="Species & Breeds" subtitle="Reference data" />
      <div className="p-6 grid lg:grid-cols-2 gap-6">
        <div className="surface border rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Species</h3>
            <button onClick={() => setSpOpen(true)}
              className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-brand-600 text-white">
              <Plus size={14} /> Add
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr><th className="py-2">Name</th><th>Scientific name</th><th></th></tr>
            </thead>
            <tbody>
              {spLoading && <tr><td colSpan={3} className="py-4 text-center muted">Loading…</td></tr>}
              {species?.map((s) => (
                <tr key={s.species_id} onClick={() => setSelectedSpecies(s.species_id)}
                  className={`border-t border-black/5 dark:border-white/10 cursor-pointer transition-colors ${
                    selectedSpecies === s.species_id ? "bg-teal-500/10" : "hover:bg-white/5"
                  }`}>
                  <td className="py-2 font-medium flex items-center gap-2">
                    {selectedSpecies === s.species_id && <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400" />}
                    {s.species_name}
                  </td>
                  <td>{s.scientific_name ?? "—"}</td>
                  <td>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      askConfirm("Delete species", `Are you sure you want to delete "${s.species_name}"?`, () => {
                        deleteSpeciesMutation.mutate(s.species_id, {
                          onSuccess: () => { if (selectedSpecies === s.species_id) setSelectedSpecies(null); closeConfirm(); },
                        });
                      });
                    }} className="text-rose-500 hover:text-rose-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!species?.length && !spLoading && (
                <tr><td colSpan={3} className="py-4 text-center muted text-xs">No species added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="surface border rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold">Breeds</h3>
              {selectedSpeciesName && <p className="text-xs muted mt-0.5">Showing breeds for <span className="text-teal-400">{selectedSpeciesName}</span></p>}
            </div>
            <button onClick={() => {
              setBr({ breed_name: "", species_id: selectedSpecies ? String(selectedSpecies) : "" });
              setBrOpen(true);
            }} className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-brand-600 text-white">
              <Plus size={14} /> Add
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr><th className="py-2">Breed</th><th>Species</th><th></th></tr>
            </thead>
            <tbody>
              {selectedSpecies ? (
                <>
                  {brLoading && <tr><td colSpan={3} className="py-4 text-center muted">Loading…</td></tr>}
                  {filteredBreeds?.map((b) => (
                    <tr key={b.breed_id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-2 font-medium">{b.breed_name}</td>
                      <td>{species?.find((s) => s.species_id === b.species_id)?.species_name ?? "—"}</td>
                      <td>
                        <button onClick={() => askConfirm("Delete breed", `Are you sure you want to delete "${b.breed_name}"?`, () => {
                          deleteBreedMutation.mutate(b.breed_id, { onSuccess: () => closeConfirm() });
                        })} className="text-rose-500 hover:text-rose-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!brLoading && filteredBreeds?.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center muted text-xs">No breeds for {selectedSpeciesName} yet.</td></tr>
                  )}
                </>
              ) : (
                <tr><td colSpan={3} className="py-8 text-center muted text-xs">Select a species to view its breeds.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={spOpen} onClose={() => setSpOpen(false)} title="New species" footer={
        <>
          <button onClick={() => setSpOpen(false)} className="px-3 py-2 text-sm">Cancel</button>
          <button onClick={() => {
            createSpeciesMutation.mutate({ species_name: sp.species_name, scientific_name: sp.scientific_name || null, is_active: true }, {
              onSuccess: () => { setSpOpen(false); setSp({ species_name: "", scientific_name: "" }); },
            });
          }} disabled={createSpeciesMutation.isPending} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm">
            {createSpeciesMutation.isPending ? "Creating…" : "Create"}
          </button>
        </>
      }>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Species name">
            <input className={inputCls} value={sp.species_name} onChange={(e) => setSp({ ...sp, species_name: e.target.value })} />
          </Field>
          <Field label="Scientific name">
            <input className={inputCls} value={sp.scientific_name} onChange={(e) => setSp({ ...sp, scientific_name: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={brOpen} onClose={() => setBrOpen(false)} title="New breed" footer={
        <>
          <button onClick={() => setBrOpen(false)} className="px-3 py-2 text-sm">Cancel</button>
          <button onClick={() => {
            createBreedMutation.mutate({ breed_name: br.breed_name, species_id: Number(br.species_id), is_active: true }, {
              onSuccess: () => { setBrOpen(false); setBr({ breed_name: "", species_id: "" }); },
            });
          }} disabled={createBreedMutation.isPending} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm">
            {createBreedMutation.isPending ? "Creating…" : "Create"}
          </button>
        </>
      }>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Species">
            <select className={inputCls} value={br.species_id} onChange={(e) => setBr({ ...br, species_id: e.target.value })}>
              <option value="">Select…</option>
              {species?.map((s) => <option key={s.species_id} value={s.species_id}>{s.species_name}</option>)}
            </select>
          </Field>
          <Field label="Breed name">
            <input className={inputCls} value={br.breed_name} onChange={(e) => setBr({ ...br, breed_name: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={closeConfirm} />
    </>
  );
}