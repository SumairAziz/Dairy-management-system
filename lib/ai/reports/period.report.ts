import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { table, chart, report } from "../charts/builders";
import { round1, percentChange } from "../tools/common";
import type { ReportBlock } from "../types";

export type PeriodKind = "daily" | "weekly" | "monthly";

interface PeriodRange {
  label: string;
  start: Date;
  end: Date; // inclusive end-of-day
  prevStart: Date;
  prevEnd: Date;
}

function resolveRange(kind: PeriodKind, anchor?: string): PeriodRange {
  const today = anchor ? new Date(`${anchor}T00:00:00`) : new Date();
  today.setHours(0, 0, 0, 0);

  if (kind === "daily") {
    const start = new Date(today);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(prevStart);
    prevEnd.setHours(23, 59, 59, 999);
    return { label: start.toISOString().slice(0, 10), start, end, prevStart, prevEnd };
  }

  if (kind === "weekly") {
    // `anchor` (or today) is treated as the last day of the week.
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    return {
      label: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
      start,
      end,
      prevStart,
      prevEnd,
    };
  }

  // monthly — `anchor` may be "YYYY-MM" or a full date; use its year/month.
  const year = today.getFullYear();
  const month = today.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const prevStart = new Date(year, month - 1, 1);
  const prevEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    start,
    end,
    prevStart,
    prevEnd,
  };
}

export async function buildPeriodReport(kind: PeriodKind, anchor?: string): Promise<ReportBlock> {
  const range = resolveRange(kind, anchor);

  const [
    milkNow,
    milkPrev,
    topProducers,
    dailySeries,
    overdueVaccinations,
    openHealthIncidents,
    calvings,
    dueSoonPregnancies,
  ] = await Promise.all([
    prisma.milk_logs.aggregate({
      where: { production_date: { gte: range.start, lte: range.end } },
      _sum: { milk_liters: true },
    }),
    prisma.milk_logs.aggregate({
      where: { production_date: { gte: range.prevStart, lte: range.prevEnd } },
      _sum: { milk_liters: true },
    }),
    prisma.$queryRaw<Array<{ tag_number: string; farm_name: string; liters: number }>>`
      SELECT a.tag_number, f.farm_name, COALESCE(SUM(m.milk_liters), 0)::float AS liters
      FROM animals a JOIN farms f ON f.farm_id = a.farm_id
      JOIN milk_logs m ON m.animal_id = a.animal_id
      WHERE m.production_date BETWEEN ${range.start} AND ${range.end}
      GROUP BY a.animal_id, a.tag_number, f.farm_name
      ORDER BY liters DESC LIMIT 5`,
    prisma.$queryRaw<Array<{ label: string; liters: number }>>`
      SELECT to_char(m.production_date, 'MM-DD') AS label, COALESCE(SUM(m.milk_liters), 0)::float AS liters
      FROM milk_logs m
      WHERE m.production_date BETWEEN ${range.start} AND ${range.end}
      GROUP BY m.production_date ORDER BY m.production_date ASC`,
    prisma.vaccination_records.count({ where: { next_due_date: { lt: new Date() } } }),
    prisma.health_incidents.count({ where: { status: { notIn: ["Recovered", "Resolved"] } } }),
    prisma.calving_records.count({ where: { calving_date: { gte: range.start, lte: range.end } } }),
    prisma.pregnancy_records.count({
      where: {
        status: "Confirmed",
        expected_delivery_date: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
      },
    }),
  ]);

  const totalNow = round1(Number(milkNow._sum.milk_liters ?? 0));
  const totalPrev = round1(Number(milkPrev._sum.milk_liters ?? 0));
  const change = percentChange(totalNow, totalPrev);

  const insights: string[] = [
    `Total milk production for ${range.label}: ${totalNow}L${
      change === null ? "" : ` (${change >= 0 ? "+" : ""}${change}% vs the previous ${kind === "daily" ? "day" : kind === "weekly" ? "week" : "month"})`
    }.`,
    `${calvings} calving event(s) recorded in this period.`,
    `${overdueVaccinations} vaccination(s) are currently overdue farm-wide.`,
    `${openHealthIncidents} health incident(s) are currently open (not yet Recovered/Resolved) farm-wide.`,
    `${dueSoonPregnancies} confirmed pregnancy/ies are due to deliver within the next 30 days.`,
  ];

  const recommendations: string[] = [];
  if (overdueVaccinations > 0) recommendations.push(`Schedule the ${overdueVaccinations} overdue vaccination(s) as soon as possible to avoid disease risk.`);
  if (openHealthIncidents > 0) recommendations.push(`Follow up on the ${openHealthIncidents} open health incident(s) with the assigned veterinarian.`);
  if (change !== null && change < -5) recommendations.push(`Milk output dropped ${Math.abs(change)}% vs the previous period — check feed, health, and heat stress for the top farms.`);
  if (dueSoonPregnancies > 0) recommendations.push(`Prepare calving supplies and monitoring for the ${dueSoonPregnancies} animal(s) due within 30 days.`);
  if (recommendations.length === 0) recommendations.push("No urgent issues detected for this period — keep up routine monitoring.");

  const kindLabel = kind === "daily" ? "Daily" : kind === "weekly" ? "Weekly" : "Monthly";

  return report({
    title: `${kindLabel} Farm Report — ${range.label}`,
    summary: `Farm-wide summary for ${range.label}: **${totalNow}L** of milk produced${
      change === null ? "" : ` (${change >= 0 ? "up" : "down"} ${Math.abs(change)}% vs prior period)`
    }, ${calvings} calving event(s), ${overdueVaccinations} overdue vaccination(s), and ${openHealthIncidents} open health incident(s).`,
    tables: [
      table(
        [
          { key: "tag_number", label: "Animal" },
          { key: "farm_name", label: "Farm" },
          { key: "liters", label: "Liters" },
        ],
        topProducers.map((r) => ({ tag_number: r.tag_number, farm_name: r.farm_name, liters: round1(r.liters) })),
        "Top 5 Milk Producers",
      ),
    ],
    charts:
      kind === "daily"
        ? []
        : [
            chart(
              "line",
              "label",
              [{ key: "liters", label: "Liters" }],
              dailySeries.map((r) => ({ label: r.label, liters: round1(r.liters) })),
              { title: "Milk Production Trend", yLabel: "L" },
            ),
          ],
    insights,
    recommendations,
  });
}
