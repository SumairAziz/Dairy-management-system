"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { StatusPill, healthKind } from "@/app/components/custom-charts";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { useHealthIncidents, useCreateHealthIncident, useUpdateHealthIncident } from "@/hooks";
import type { Animal } from "@/types";

interface Props {
  animal: Animal;
}

export function AnimalHealthTab({ animal }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    incident_date: new Date().toISOString().slice(0, 10),
    disease_name: "",
    severity: "",
    symptoms: "",
    treatment: "",
    status: "Active",
  });

  const { data: incidents, isLoading } = useHealthIncidents(animal.animal_id);
  const createMutation = useCreateHealthIncident(animal.animal_id);

  function handleCreate() {
    createMutation.mutate(
      {
        incident_date: form.incident_date,
        disease_name: form.disease_name || null,
        severity: form.severity || null,
        symptoms: form.symptoms || null,
        treatment: form.treatment || null,
        status: form.status,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            incident_date: new Date().toISOString().slice(0, 10),
            disease_name: "",
            severity: "",
            symptoms: "",
            treatment: "",
            status: "Active",
          });
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="font-semibold">Health incidents</h3>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-brand-600 text-white"
        >
          <Plus size={14} /> Add incident
        </button>
      </div>
      <div className="space-y-3">
        {(incidents ?? []).map((h) => (
          <HealthIncidentCard
            key={h.incident_id}
            incident={h}
            animalId={animal.animal_id}
          />
        ))}
        {isLoading && (
          <div className="muted text-sm">Loading…</div>
        )}
        {!isLoading && incidents?.length === 0 && (
          <div className="muted text-sm">No incidents recorded.</div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New health incident"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Discovery date">
            <input
              className={inputCls}
              type="date"
              value={form.incident_date}
              onChange={(e) =>
                setForm({ ...form, incident_date: e.target.value })
              }
            />
          </Field>
          <Field label="Disease name">
            <input
              className={inputCls}
              value={form.disease_name}
              onChange={(e) =>
                setForm({ ...form, disease_name: e.target.value })
              }
            />
          </Field>
          <Field label="Severity">
            <select
              className={inputCls}
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              <option value="">Select…</option>
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
              <option value="Critical">Critical</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Recovering">Recovering</option>
              <option value="Resolved">Resolved</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Symptoms">
              <textarea
                className={inputCls}
                rows={2}
                value={form.symptoms}
                onChange={(e) =>
                  setForm({ ...form, symptoms: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Treatment">
              <textarea
                className={inputCls}
                rows={2}
                value={form.treatment}
                onChange={(e) =>
                  setForm({ ...form, treatment: e.target.value })
                }
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function HealthIncidentCard({
  incident,
  animalId,
}: {
  incident: {
    incident_id: number;
    incident_date: string | null;
    disease_name: string | null;
    severity: string | null;
    symptoms: string | null;
    treatment: string | null;
    status: string | null;
  };
  animalId: number;
}) {
  const updateMutation = useUpdateHealthIncident(animalId);

  const sevMap: Record<string, number> = {
    Mild: 3,
    Moderate: 5,
    Severe: 8,
    Critical: 10,
  };
  const sev = sevMap[incident.severity ?? ""] ?? 0;
  const sevColor =
    sev >= 8 ? "#ef4444" : sev >= 5 ? "#f59e0b" : "#14b8a6";

  return (
    <div className="surface border rounded-2xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">
            {incident.disease_name || "Untitled incident"}
          </div>
          <div className="text-sm muted">
            {incident.incident_date?.slice(0, 10) ?? "—"}
            {incident.status === "Resolved" ? " · resolved" : " · unresolved"}
          </div>
          {incident.symptoms && (
            <p className="text-sm mt-1">{incident.symptoms}</p>
          )}
          {incident.treatment && (
            <p className="text-sm mt-1 muted">
              <span className="font-medium">Treatment:</span>{" "}
              {incident.treatment}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs muted">Severity</span>
          <div
            className="px-2 py-0.5 rounded font-semibold text-white text-sm"
            style={{ background: sevColor }}
          >
            {incident.severity ?? "—"}
          </div>
          <StatusPill
            status={incident.status ?? "Unknown"}
            kind={healthKind(incident.status)}
          />
          {incident.status !== "Resolved" && (
            <button
              className="text-xs text-brand-600 hover:underline"
              onClick={() =>
                updateMutation.mutate({
                  incidentId: incident.incident_id,
                  data: { status: "Resolved" },
                })
              }
            >
              Mark resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}