"use client";
import { LineChart } from "@/app/components/custom-charts";
import { useMilkLogs } from "@/hooks";
import type { Animal } from "@/types";

interface Props {
  animal: Animal;
}

export function AnimalMilkTab({ animal }: Props) {
  const { data, isLoading } = useMilkLogs({
    animal_id: String(animal.animal_id),
    pageSize: "100",
    sortBy: "production_date",
    sortDir: "asc",
  });

  const records = data?.data ?? [];

  const chartData = records.map((r) => ({
    label: r.production_date?.slice(5, 10) || "",
    value: Number(r.milk_liters || 0),
  }));

  const totalMilk = records.reduce(
    (s, r) => s + Number(r.milk_liters || 0),
    0,
  );
  const avgMilk = records.length
    ? totalMilk / records.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="surface border rounded-2xl p-4 text-center">
          <div className="text-xs uppercase tracking-wider muted mb-1">
            Total Records
          </div>
          <div className="text-2xl font-semibold">{records.length}</div>
        </div>
        <div className="surface border rounded-2xl p-4 text-center">
          <div className="text-xs uppercase tracking-wider muted mb-1">
            Total Milk
          </div>
          <div className="text-2xl font-semibold">
            {totalMilk.toFixed(1)} L
          </div>
        </div>
        <div className="surface border rounded-2xl p-4 text-center">
          <div className="text-xs uppercase tracking-wider muted mb-1">
            Avg/record
          </div>
          <div className="text-2xl font-semibold">
            {avgMilk.toFixed(1)} L
          </div>
        </div>
      </div>

      <div className="surface border rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Milk production trend</h3>
        <LineChart yLabel="L" data={chartData} />
      </div>

      <div className="surface border rounded-2xl p-5">
        <table className="w-full text-sm">
          <thead className="text-left muted">
            <tr>
              <th className="py-2">Date</th>
              <th>Session</th>
              <th>Milk (L)</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {records
              .slice()
              .reverse()
              .map((r) => (
                <tr
                  key={r.milk_log_id}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="py-2">{r.production_date?.slice(0, 10)}</td>
                  <td>{r.session}</td>
                  <td>{Number(r.milk_liters).toFixed(2)}</td>
                  <td className="muted">{r.quality_grade ?? "—"}</td>
                </tr>
              ))}
            {isLoading && (
              <tr>
                <td colSpan={4} className="py-4 text-center muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && records.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center muted">
                  No milk records for this animal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}