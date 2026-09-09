import { prisma } from "@/lib/db";
import { table, chart, report } from "../charts/builders";
import { buildVaccinationStatusWhere } from "@/lib/vaccination-status";
import type { ReportBlock } from "../types";

export async function buildVaccinationReport(): Promise<ReportBlock> {
  const [overdue, dueToday, dueSoon, upcoming, overdueList, byVaccine] = await Promise.all([
    prisma.vaccination_records.count({ where: buildVaccinationStatusWhere("overdue") }),
    prisma.vaccination_records.count({ where: buildVaccinationStatusWhere("due_today") }),
    prisma.vaccination_records.count({ where: buildVaccinationStatusWhere("due_soon") }),
    prisma.vaccination_records.count({ where: buildVaccinationStatusWhere("upcoming") }),
    prisma.vaccination_records.findMany({
      where: buildVaccinationStatusWhere("overdue"),
      orderBy: { next_due_date: "asc" },
      take: 15,
      include: { animals: { select: { tag_number: true, farms: { select: { farm_name: true } } } } },
    }),
    prisma.vaccination_records.groupBy({ by: ["vaccine_name"], _count: true, orderBy: { _count: { vaccine_name: "desc" } }, take: 8 }),
  ]);

  return report({
    title: "Vaccination Report",
    summary: `${overdue} vaccination(s) overdue, ${dueToday} due today, ${dueSoon} due within 7 days, and ${upcoming} scheduled further out.`,
    tables: [
      table(
        [
          { key: "animal_tag", label: "Animal" },
          { key: "farm", label: "Farm" },
          { key: "vaccine_name", label: "Vaccine" },
          { key: "next_due_date", label: "Was Due" },
        ],
        overdueList.map((r) => ({
          animal_tag: r.animals?.tag_number ?? "—",
          farm: r.animals?.farms?.farm_name ?? "—",
          vaccine_name: r.vaccine_name ?? "—",
          next_due_date: r.next_due_date ? String(r.next_due_date).slice(0, 10) : "—",
        })),
        "Overdue Vaccinations",
      ),
    ],
    charts: [
      chart(
        "bar",
        "status",
        [{ key: "count" }],
        [
          { status: "Overdue", count: overdue },
          { status: "Due Today", count: dueToday },
          { status: "Due Soon", count: dueSoon },
          { status: "Upcoming", count: upcoming },
        ],
        { title: "Vaccinations by Status" },
      ),
      chart(
        "bar",
        "vaccine_name",
        [{ key: "count" }],
        byVaccine.map((g) => ({ vaccine_name: g.vaccine_name ?? "Unknown", count: g._count })),
        { title: "Records by Vaccine" },
      ),
    ],
    insights: [`${overdue} overdue vaccination(s) represent an immediate disease-risk exposure.`, `${dueSoon} more due within the week.`],
    recommendations:
      overdue > 0
        ? [`Prioritize the ${overdue} overdue vaccination(s) listed above this week.`]
        : ["No overdue vaccinations — maintain the current schedule."],
  });
}
