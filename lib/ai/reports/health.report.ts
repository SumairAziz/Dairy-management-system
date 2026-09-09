import { prisma } from "@/lib/db";
import { table, chart, report } from "../charts/builders";
import type { ReportBlock } from "../types";

export async function buildHealthReport(): Promise<ReportBlock> {
  const [bySeverity, openIncidents, byDisease] = await Promise.all([
    prisma.health_incidents.groupBy({ by: ["severity"], _count: true }),
    prisma.health_incidents.findMany({
      where: { status: { notIn: ["Recovered", "Resolved"] } },
      orderBy: { incident_date: "desc" },
      take: 15,
      include: { animals: { select: { tag_number: true, farms: { select: { farm_name: true } } } } },
    }),
    prisma.health_incidents.groupBy({ by: ["disease_name"], _count: true, orderBy: { _count: { disease_name: "desc" } }, take: 8 }),
  ]);

  const openCount = openIncidents.length;
  const critical = bySeverity.find((g) => g.severity === "Critical")?._count ?? 0;

  return report({
    title: "Herd Health Report",
    summary: `${openCount} open health incident(s) farm-wide${critical > 0 ? `, including ${critical} marked Critical` : ""}.`,
    tables: [
      table(
        [
          { key: "animal_tag", label: "Animal" },
          { key: "farm", label: "Farm" },
          { key: "disease_name", label: "Condition" },
          { key: "severity", label: "Severity" },
          { key: "status", label: "Status" },
        ],
        openIncidents.map((r) => ({
          animal_tag: r.animals?.tag_number ?? "—",
          farm: r.animals?.farms?.farm_name ?? "—",
          disease_name: r.disease_name ?? "—",
          severity: r.severity ?? "—",
          status: r.status ?? "—",
        })),
        "Open Health Incidents",
      ),
    ],
    charts: [
      chart("pie", "severity", [{ key: "count" }], bySeverity.map((g) => ({ severity: g.severity ?? "Unknown", count: g._count })), {
        title: "Incidents by Severity",
      }),
      chart("bar", "disease_name", [{ key: "count" }], byDisease.map((g) => ({ disease_name: g.disease_name ?? "Unknown", count: g._count })), {
        title: "Most Common Conditions",
      }),
    ],
    insights: [
      `${openCount} incident(s) currently open across the herd.`,
      critical > 0 ? `${critical} incident(s) are Critical severity and need immediate attention.` : "No Critical-severity incidents currently open.",
    ],
    recommendations:
      critical > 0
        ? [`Prioritize veterinary follow-up for the ${critical} Critical incident(s).`]
        : ["No urgent critical cases — continue routine monitoring."],
  });
}
