import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type {
  MilkLogQueryParams,
  CreateMilkLogInput,
} from "@/validators/milk-log.validator";
import type { Prisma } from "@prisma/client";

export async function findAll(params: MilkLogQueryParams) {
  const { page, pageSize, ...filters } = params;
  const where: Prisma.milk_logsWhereInput = {};

  if (filters.animal_id) where.animal_id = filters.animal_id;
  if (filters.session) where.session = filters.session;

  if (filters.date_from || filters.date_to) {
    where.production_date = {};
    if (filters.date_from) {
      const d = new Date(filters.date_from);
      (where.production_date as Prisma.DateTimeNullableFilter).gte = d;
    }
    if (filters.date_to) {
      const d = new Date(filters.date_to);
      d.setDate(d.getDate() + 1);
      (where.production_date as Prisma.DateTimeNullableFilter).lt = d;
    }
  }

  if (filters.milk_min || filters.milk_max) {
    where.milk_liters = {};
    if (filters.milk_min)
      (where.milk_liters as Prisma.DecimalNullableFilter).gte =
        filters.milk_min;
    if (filters.milk_max)
      (where.milk_liters as Prisma.DecimalNullableFilter).lte =
        filters.milk_max;
  }

  const [data, total] = await Promise.all([
    prisma.milk_logs.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { production_date: "desc" },
      include: { animals: true },
    }),
    prisma.milk_logs.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function create(data: CreateMilkLogInput) {
  const productionDate = new Date(data.production_date);

  const existing = await prisma.milk_logs.findFirst({
    where: {
      animal_id: data.animal_id,
      production_date: productionDate,
      session: data.session,
    },
  });
  if (existing) {
    const { ConflictError } = await import("@/lib/errors");
    throw new ConflictError(
      `A milk record for this animal already exists for the ${data.session} session on ${data.production_date}.`,
    );
  }

  const created = await prisma.milk_logs.create({
    data: {
      ...data,
      production_date: productionDate,
    },
  });
  return serialize(created);
}

export async function findById(id: number) {
  const record = await prisma.milk_logs.findUnique({
    where: { milk_log_id: id },
    include: { animals: true },
  });
  if (!record) {
    const { NotFoundError } = await import("@/lib/errors");
    throw new NotFoundError("Milk log");
  }
  return serialize(record);
}

export async function remove(id: number) {
  await prisma.milk_logs.delete({ where: { milk_log_id: id } });
}

export async function getStats() {
  const todayISO = new Date().toISOString().split("T")[0];
  const today = new Date(todayISO);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [
    todayData,
    todayBySession,
    animalsMilkedToday,
    topProducerToday,
    monthlyData,
  ] = await Promise.all([
    prisma.milk_logs.aggregate({
      where: { production_date: { equals: today } },
      _sum: { milk_liters: true },
    }),
    prisma.milk_logs.groupBy({
      by: ["session"],
      where: { production_date: { equals: today } },
      _sum: { milk_liters: true },
    }),
    prisma.milk_logs.findMany({
      where: { production_date: { equals: today } },
      distinct: ["animal_id"],
      select: { animal_id: true },
    }),
    prisma.milk_logs.groupBy({
      by: ["animal_id"],
      where: { production_date: { equals: today } },
      _sum: { milk_liters: true },
      orderBy: { _sum: { milk_liters: "desc" } },
      take: 1,
    }),
    prisma.milk_logs.aggregate({
      where: { production_date: { gte: monthStart, lte: monthEnd } },
      _sum: { milk_liters: true },
    }),
  ]);

  let topProducerLabel = "—";
  if (topProducerToday.length > 0) {
    const animal = await prisma.animals.findUnique({
      where: { animal_id: topProducerToday[0].animal_id },
      select: { animal_name: true, tag_number: true },
    });
    const liters = Number(topProducerToday[0]._sum.milk_liters ?? 0).toFixed(1);
    const name =
      animal?.animal_name ||
      animal?.tag_number ||
      `#${topProducerToday[0].animal_id}`;
    topProducerLabel = `${name} - ${liters}L`;
  }

  const todayProduction = Number(todayData._sum.milk_liters ?? 0);
  const animalCount = animalsMilkedToday.length;
  const avgYield = animalCount > 0 ? todayProduction / animalCount : 0;
  const monthlyProduction = Number(monthlyData._sum.milk_liters ?? 0);

  const sessions = { Morning: 0, Afternoon: 0, Evening: 0 };
  todayBySession.forEach((s) => {
    if (s.session && s._sum.milk_liters) {
      sessions[s.session as keyof typeof sessions] = parseFloat(
        Number(s._sum.milk_liters).toFixed(1),
      );
    }
  });

  return serialize({
    todayProduction: parseFloat(todayProduction.toFixed(1)),
    animalsMilkedToday: animalCount,
    avgYieldPerAnimal: parseFloat(avgYield.toFixed(1)),
    monthlyProduction: parseFloat(monthlyProduction.toFixed(1)),
    sessions,
    topProducerLabel,
  });
}
