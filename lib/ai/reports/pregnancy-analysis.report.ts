import { prisma } from "@/lib/db";
import { table, chart, report } from "../charts/builders";
import { ACTIVE_PREGNANCY_STATUSES } from "@/lib/pregnancy-status";
import type { ReportBlock } from "../types";

export async function buildPregnancyAnalysisReport(): Promise<ReportBlock> {
  const [byStatus, dueSoon, overdue, active, records] = await Promise.all([
    prisma.pregnancy_records.groupBy({ by: ["status"], _count: true }),
    prisma.pregnancy_records.count({
      where: { status: "Confirmed", expected_delivery_date: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) } },
    }),
    prisma.pregnancy_records.count({ where: { status: "Confirmed", expected_delivery_date: { lt: new Date() } } }),
    prisma.pregnancy_records.count({ where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } } }),
    prisma.pregnancy_records.findMany({
      where: { status: { in: [...ACTIVE_PREGNANCY_STATUSES] } },
      orderBy: [{ expected_delivery_date: { sort: "asc", nulls: "last" } }],
      take: 15,
      include: { animals: { select: { tag_number: true, farms: { select: { farm_name: true } } } } },
    }),
  ]);

  return report({
    title: "Pregnancy Analysis Report",
    summary: `${active} active pregnancy/ies farm-wide — ${dueSoon} due within 14 days, ${overdue} past their expected delivery date and needing veterinary review.`,
    tables: [
      table(
        [
          { key: "animal_tag", label: "Animal" },
          { key: "farm", label: "Farm" },
          { key: "status", label: "Status" },
          { key: "expected_delivery_date", label: "Expected Delivery" },
        ],
        records.map((r) => ({
          animal_tag: r.animals?.tag_number ?? "—",
          farm: r.animals?.farms?.farm_name ?? "—",
          status: r.status ?? "Pending",
          expected_delivery_date: r.expected_delivery_date ? String(r.expected_delivery_date).slice(0, 10) : "—",
        })),
        "Upcoming Deliveries",
      ),
    ],
    charts: [
      chart(
        "pie",
        "status",
        [{ key: "count" }],
        byStatus.map((g) => ({ status: g.status ?? "Unknown", count: g._count })),
        { title: "Pregnancy Status Distribution" },
      ),
    ],
    insights: [
      `${active} animal(s) currently pregnant.`,
      `${dueSoon} due within the next 14 days.`,
      `${overdue} overdue past expected delivery — verify these dates and schedule veterinary checks.`,
    ],
    recommendations:
      overdue > 0
        ? [`Schedule an immediate veterinary check for the ${overdue} overdue pregnancy/ies.`]
        : ["No overdue pregnancies — continue routine monitoring of upcoming deliveries."],
  });
}
