import "dotenv/config";
import { prisma } from "@/lib/db";
import { sumDailyMilkLiters, getTodayProductionDate } from "@/lib/milk-daily";

async function main() {
  const latest = await prisma.milk_logs.findFirst({
    orderBy: { production_date: "desc" },
    select: { production_date: true },
  });
  const asOf = latest?.production_date ?? new Date();
  const day = getTodayProductionDate(asOf);

  const totalOnDay = await prisma.milk_logs.aggregate({
    where: { production_date: { equals: day } },
    _sum: { milk_liters: true },
  });
  console.log(`Verifying daily milk for ${day.toISOString().slice(0, 10)}…`);
  console.log(`Raw DB total that day: ${Number(totalOnDay._sum.milk_liters ?? 0).toFixed(1)}L\n`);

  const farms = await prisma.farms.findMany({ include: { units: true } });

  for (const farm of farms) {
    const farmDaily = await sumDailyMilkLiters({ farmId: farm.farm_id }, asOf);
    let unitTotal = 0;
    for (const unit of farm.units) {
      unitTotal += await sumDailyMilkLiters({ unitId: unit.unit_id }, asOf);
    }

    const bullUnits = farm.units.filter((u) => u.unit_type === "Bull Unit");
    const bullMilk = await Promise.all(
      bullUnits.map((u) => sumDailyMilkLiters({ unitId: u.unit_id }, asOf)),
    );

    console.log(
      `${farm.farm_name}: farmDaily=${farmDaily.toFixed(1)}L unitSum=${unitTotal.toFixed(1)}L reconcile=${Math.abs(farmDaily - unitTotal) < 0.01} bullUnitMilk=[${bullMilk.map((v) => v.toFixed(1)).join(", ")}]`,
    );
  }
}

main().finally(() => prisma.$disconnect());
