import { prisma } from "@/lib/db";
import { table, chart, report } from "../charts/builders";
import type { ReportBlock } from "../types";

export async function buildBreedingReport(): Promise<ReportBlock> {
  const [byResult, byMethod, repeatBreederGroups] = await Promise.all([
    prisma.breeding_records.groupBy({ by: ["result"], _count: true }),
    prisma.breeding_records.groupBy({ by: ["method"], _count: true }),
    prisma.breeding_records.groupBy({
      by: ["female_animal_id"],
      where: { female_animal_id: { not: null }, result: { notIn: ["Success"] } },
      _count: { female_animal_id: true },
      having: { female_animal_id: { _count: { gte: 3 } } },
    }),
  ]);

  const total = byResult.reduce((s, g) => s + g._count, 0);
  const success = byResult.find((g) => g.result === "Success")?._count ?? 0;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  const repeatIds = repeatBreederGroups.map((g) => g.female_animal_id).filter((id): id is number => id !== null);
  const repeatAnimals = repeatIds.length
    ? await prisma.animals.findMany({ where: { animal_id: { in: repeatIds } }, select: { tag_number: true, farms: { select: { farm_name: true } } } })
    : [];

  return report({
    title: "Breeding Performance Report",
    summary: `${total} breeding record(s) on file with a ${successRate}% success rate. ${repeatAnimals.length} animal(s) flagged as repeat breeders (3+ failed/pending attempts).`,
    tables: [
      table(
        [
          { key: "tag_number", label: "Animal" },
          { key: "farm", label: "Farm" },
        ],
        repeatAnimals.map((a) => ({ tag_number: a.tag_number, farm: a.farms?.farm_name ?? "—" })),
        "Repeat Breeders (3+ unsuccessful attempts)",
      ),
    ],
    charts: [
      chart("pie", "result", [{ key: "count" }], byResult.map((g) => ({ result: g.result ?? "Pending", count: g._count })), {
        title: "Breeding Outcomes",
      }),
      chart("bar", "method", [{ key: "count" }], byMethod.map((g) => ({ method: g.method ?? "Unknown", count: g._count })), {
        title: "By Method",
      }),
    ],
    insights: [`Overall breeding success rate: ${successRate}%.`, `${repeatAnimals.length} animal(s) are repeat breeders and may need veterinary evaluation.`],
    recommendations:
      repeatAnimals.length > 0
        ? ["Schedule a fertility evaluation for the listed repeat breeders."]
        : ["No repeat-breeder concerns detected — breeding program is performing normally."],
  });
}
