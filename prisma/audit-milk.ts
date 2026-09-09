import "dotenv/config";
import { prisma } from "@/lib/db";

async function main() {
  const earliest = await prisma.milk_logs.aggregate({
    _min: { production_date: true },
    _max: { production_date: true },
    _count: true,
  });
  console.log("EARLIEST:", earliest._min.production_date);
  console.log("LATEST:", earliest._max.production_date);
  console.log("TOTAL:", earliest._count);

  const byYear = await prisma.$queryRaw<
    Array<{ yr: number; cnt: number; liters: number }>
  >`
    SELECT EXTRACT(YEAR FROM production_date)::int AS yr, COUNT(*)::int AS cnt,
      COALESCE(SUM(milk_liters),0)::float AS liters
    FROM milk_logs GROUP BY 1 ORDER BY 1`;

  console.log("BY YEAR:", JSON.stringify(byYear, null, 2));

  const augOnward = await prisma.$queryRaw<
    Array<{ d: Date; cnt: number; liters: number }>
  >`
    SELECT production_date::date AS d, COUNT(*)::int AS cnt,
      COALESCE(SUM(milk_liters),0)::float AS liters
    FROM milk_logs
    WHERE production_date >= '2026-08-20'::date
    GROUP BY 1 ORDER BY 1`;

  console.log(
    "AUG 20+:",
    JSON.stringify(
      augOnward.map((r) => ({ ...r, d: r.d.toISOString().slice(0, 10) })),
      null,
      2,
    ),
  );

  const dupes = await prisma.$queryRaw<
    Array<{ animal_id: number; d: Date; session: string; cnt: number }>
  >`
    SELECT animal_id, production_date::date AS d, session, COUNT(*)::int AS cnt
    FROM milk_logs
    GROUP BY 1,2,3 HAVING COUNT(*) > 1 LIMIT 10`;

  console.log("DUPES:", dupes.length);

  const firstBusy = await prisma.$queryRaw<
    Array<{ d: Date; cnt: number }>
  >`
    SELECT production_date::date AS d, COUNT(*)::int AS cnt
    FROM milk_logs
    GROUP BY 1
    HAVING COUNT(*) >= 10
    ORDER BY d
    LIMIT 5`;

  console.log(
    "FIRST BUSY DAYS:",
    firstBusy.map((r) => ({ d: r.d.toISOString().slice(0, 10), cnt: r.cnt })),
  );

  const { getMilkProductionTrend } = await import("@/services/dashboard.service");
  const lifetime = await getMilkProductionTrend("lifetime");
  console.log("LIFETIME:", {
    granularity: lifetime.granularity,
    points: lifetime.points.length,
    first: lifetime.points[0],
    last: lifetime.points[lifetime.points.length - 1],
    totalLiters: lifetime.totalLiters,
    zeroBuckets: lifetime.points.filter((p) => p.value === 0).length,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
