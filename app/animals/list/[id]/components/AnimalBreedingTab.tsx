"use client";
import Link from "next/link";
import {
  useBreedingRecords,
  usePregnancyRecords,
  useHeatCycles,
  useUpdateHeatCycle,
} from "@/hooks";
import { StatusPill } from "@/app/components/custom-charts";
import type { Animal } from "@/types";

interface Props {
  animal: Animal;
}

export function AnimalBreedingTab({ animal }: Props) {
  const { data: breedingData, isLoading: bLoading } = useBreedingRecords({
    female_animal_id: String(animal.animal_id),
    pageSize: "100",
  });

  const { data: pregnancyData, isLoading: pLoading } = usePregnancyRecords({
    animal_id: String(animal.animal_id),
    pageSize: "100",
  });

  const { data: heatData, isLoading: hLoading } = useHeatCycles({
    animal_id: String(animal.animal_id),
    pageSize: "100",
  });

  const updateHeatCycle = useUpdateHeatCycle();

  const breedings = breedingData?.data ?? [];
  const pregnancies = pregnancyData?.data ?? [];
  const heatCycles = heatData?.data ?? [];
  const activeHeatCycle = heatCycles.find((h) => !h.heat_end_date);

  function endHeatCycle(id: number) {
    updateHeatCycle.mutate({
      id,
      data: { heat_end_date: new Date().toISOString().slice(0, 10) },
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="surface border rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Breeding records</h3>
        {bLoading ? (
          <div className="muted text-sm">Loading…</div>
        ) : breedings.length === 0 ? (
          <div className="muted text-sm">No breeding records.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="py-2">Date</th>
                <th>Method</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {breedings.map((b) => (
                <tr
                  key={b.breeding_id}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="py-2">
                    {b.breeding_date?.slice(0, 10) ?? "—"}
                  </td>
                  <td>{b.method ?? "—"}</td>
                  <td>
                    <StatusPill
                      status={b.result ?? "Pending"}
                      kind={
                        b.result === "Successful"
                          ? "good"
                          : b.result === "Failed"
                            ? "bad"
                            : "neutral"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="surface border rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Pregnancy records</h3>
        {pLoading ? (
          <div className="muted text-sm">Loading…</div>
        ) : pregnancies.length === 0 ? (
          <div className="muted text-sm">No pregnancy records.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left muted">
              <tr>
                <th className="py-2">Insemination</th>
                <th>Status</th>
                <th>Expected</th>
                <th>Delivered</th>
              </tr>
            </thead>
            <tbody>
              {pregnancies.map((p) => (
                <tr
                  key={p.pregnancy_id}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="py-2">
                    {p.insemination_date?.slice(0, 10) ?? "—"}
                  </td>
                  <td>
                    <StatusPill
                      status={p.status ?? "Pending"}
                      kind={
                        p.status === "Pregnant"
                          ? "good"
                          : p.status === "Failed" || p.status === "Miscarried"
                            ? "bad"
                            : "neutral"
                      }
                    />
                  </td>
                  <td>{p.expected_delivery_date?.slice(0, 10) ?? "—"}</td>
                  <td>{p.actual_delivery_date?.slice(0, 10) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="surface border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Heat cycles</h3>
          <Link
            href="/animals/heat-cycles"
            className="text-xs text-brand-600 hover:underline"
          >
            Manage all →
          </Link>
        </div>
        {hLoading ? (
          <div className="muted text-sm">Loading…</div>
        ) : (
          <>
            {activeHeatCycle && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-amber-500">
                    Currently in heat
                  </span>
                  <div className="text-xs muted">
                    Started{" "}
                    {activeHeatCycle.heat_start_date?.slice(0, 10) ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => endHeatCycle(activeHeatCycle.heat_cycle_id)}
                  disabled={updateHeatCycle.isPending}
                  className="text-xs px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white whitespace-nowrap"
                  title="Mark this heat cycle as ended (e.g. after breeding)"
                >
                  {updateHeatCycle.isPending ? "Updating…" : "End heat cycle"}
                </button>
              </div>
            )}
            {heatCycles.length === 0 ? (
              <div className="muted text-sm">No heat cycle records.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left muted">
                  <tr>
                    <th className="py-2">Started</th>
                    <th>Ended</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {heatCycles.map((h) => (
                    <tr
                      key={h.heat_cycle_id}
                      className="border-t border-black/5 dark:border-white/10"
                    >
                      <td className="py-2">
                        {h.heat_start_date?.slice(0, 10) ?? "—"}
                      </td>
                      <td>
                        {h.heat_end_date ? (
                          h.heat_end_date.slice(0, 10)
                        ) : (
                          <StatusPill status="In Heat" kind="bad" />
                        )}
                      </td>
                      <td>{h.detection_method ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
