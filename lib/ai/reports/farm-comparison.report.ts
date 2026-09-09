import { buildFarmStat } from "../tools/farms.tools";
import { table, chart, report } from "../charts/builders";
import type { ReportBlock } from "../types";

export async function buildFarmComparisonReport(farmIds: number[]): Promise<ReportBlock> {
  const stats = await Promise.all(farmIds.map((id) => buildFarmStat(id)));
  const found = stats.filter((s): s is NonNullable<typeof s> => s !== null);

  const leader = [...found].sort((a, b) => b.milk_last_30_days_liters - a.milk_last_30_days_liters)[0];

  const insights = found.map(
    (f) =>
      `${f.farm_name}: ${f.active_animal_count} active animals, ${f.milk_last_30_days_liters}L milk in the last 30 days, ${f.currently_pregnant_count} currently pregnant.`,
  );

  return report({
    title: `Farm Comparison — ${found.map((f) => f.farm_name).join(" vs ")}`,
    summary: leader
      ? `Across the ${found.length} compared farms, **${leader.farm_name}** leads in milk production over the last 30 days with ${leader.milk_last_30_days_liters}L.`
      : "No matching farms were found to compare.",
    tables: [
      table(
        [
          { key: "farm_name", label: "Farm" },
          { key: "active_animal_count", label: "Active Animals" },
          { key: "unit_count", label: "Units" },
          { key: "total_capacity", label: "Capacity" },
          { key: "milk_last_30_days_liters", label: "Milk (30d, L)" },
          { key: "currently_pregnant_count", label: "Pregnant" },
        ],
        found.map((f) => ({
          farm_name: f.farm_name,
          active_animal_count: f.active_animal_count,
          unit_count: f.unit_count,
          total_capacity: f.total_capacity,
          milk_last_30_days_liters: f.milk_last_30_days_liters,
          currently_pregnant_count: f.currently_pregnant_count,
        })),
      ),
    ],
    charts: [
      chart(
        "bar",
        "farm_name",
        [{ key: "milk_last_30_days_liters", label: "Milk (L)" }],
        found.map((f) => ({ farm_name: f.farm_name, milk_last_30_days_liters: f.milk_last_30_days_liters })),
        { title: "Milk Production — Last 30 Days", yLabel: "L" },
      ),
    ],
    insights,
    recommendations: [
      "Investigate any farm significantly below the group's average milk-per-animal ratio for feed, health, or milking-frequency issues.",
    ],
  });
}
