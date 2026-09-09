import { prisma } from "@/lib/db";
import { table, chart, report } from "../charts/builders";
import { round1, percentChange } from "../tools/common";
import type { ReportBlock } from "../types";

export async function buildMilkAnalysisReport(dateFrom?: string, dateTo?: string): Promise<ReportBlock> {
  const to = dateTo ?? new Date().toISOString().slice(0, 10);
  const from = dateFrom ?? new Date(new Date(to).getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const spanDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const prevTo = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(from).getTime() - spanDays * 86400000).toISOString().slice(0, 10);

  const [dailySeries, byFarm, bySession, totalNow, totalPrev, topProducers] = await Promise.all([
    prisma.$queryRaw<Array<{ label: string; liters: number }>>`
      SELECT production_date::text AS label, COALESCE(SUM(milk_liters), 0)::float AS liters
      FROM milk_logs WHERE production_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY production_date ORDER BY production_date ASC`,
    prisma.$queryRaw<Array<{ farm_name: string; liters: number }>>`
      SELECT f.farm_name, COALESCE(SUM(m.milk_liters), 0)::float AS liters
      FROM farms f LEFT JOIN animals a ON a.farm_id = f.farm_id
      LEFT JOIN milk_logs m ON m.animal_id = a.animal_id AND m.production_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY f.farm_name ORDER BY liters DESC`,
    prisma.milk_logs.groupBy({
      by: ["session"],
      where: { production_date: { gte: new Date(from), lte: new Date(to) } },
      _sum: { milk_liters: true },
    }),
    prisma.milk_logs.aggregate({ where: { production_date: { gte: new Date(from), lte: new Date(to) } }, _sum: { milk_liters: true } }),
    prisma.milk_logs.aggregate({ where: { production_date: { gte: new Date(prevFrom), lte: new Date(prevTo) } }, _sum: { milk_liters: true } }),
    prisma.$queryRaw<Array<{ tag_number: string; farm_name: string; liters: number }>>`
      SELECT a.tag_number, f.farm_name, COALESCE(SUM(m.milk_liters), 0)::float AS liters
      FROM animals a JOIN farms f ON f.farm_id = a.farm_id JOIN milk_logs m ON m.animal_id = a.animal_id
      WHERE m.production_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY a.animal_id, a.tag_number, f.farm_name ORDER BY liters DESC LIMIT 10`,
  ]);

  const total = round1(Number(totalNow._sum.milk_liters ?? 0));
  const prevTotal = round1(Number(totalPrev._sum.milk_liters ?? 0));
  const change = percentChange(total, prevTotal);
  const avgPerDay = round1(total / spanDays);

  const insights = [
    `Total production from ${from} to ${to}: ${total}L across ${spanDays} day(s), averaging ${avgPerDay}L/day.`,
    change === null ? "No prior-period data available for comparison." : `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% vs the preceding ${spanDays}-day period (${prevTotal}L).`,
    byFarm.length ? `Top farm by volume: ${byFarm[0].farm_name} (${round1(byFarm[0].liters)}L).` : "No farm data available.",
  ];

  return report({
    title: `Milk Production Analysis (${from} to ${to})`,
    summary: `Herd-wide milk production totaled **${total}L** over ${spanDays} day(s) (avg ${avgPerDay}L/day)${
      change === null ? "" : `, ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% vs the prior period`
    }.`,
    tables: [
      table(
        [
          { key: "farm_name", label: "Farm" },
          { key: "liters", label: "Liters" },
        ],
        byFarm.map((r) => ({ farm_name: r.farm_name, liters: round1(r.liters) })),
        "Production by Farm",
      ),
      table(
        [
          { key: "tag_number", label: "Animal" },
          { key: "farm_name", label: "Farm" },
          { key: "liters", label: "Liters" },
        ],
        topProducers.map((r) => ({ tag_number: r.tag_number, farm_name: r.farm_name, liters: round1(r.liters) })),
        "Top 10 Producers",
      ),
    ],
    charts: [
      chart("line", "label", [{ key: "liters", label: "Liters" }], dailySeries.map((r) => ({ label: r.label.slice(5), liters: round1(r.liters) })), {
        title: "Daily Production Trend",
        yLabel: "L",
      }),
      chart(
        "pie",
        "session",
        [{ key: "liters" }],
        bySession.map((s) => ({ session: s.session, liters: round1(Number(s._sum.milk_liters ?? 0)) })),
        { title: "Production by Session" },
      ),
    ],
    insights,
    recommendations:
      change !== null && change < 0
        ? [`Investigate the ${Math.abs(change)}% decline — check for heat stress, feed changes, or health issues on the lowest-producing farms.`]
        : ["Production trend is stable or improving — maintain current feeding and milking schedules."],
  });
}
