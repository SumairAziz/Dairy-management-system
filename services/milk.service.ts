import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { getTodayProductionDate, milkEligibleAnimalFilter } from "@/lib/milk-daily";
import type {
  MilkLogQueryParams,
  CreateMilkLogInput,
  DailyMilkQueryParams,
  UpsertDailyMilkInput,
} from "@/validators/milk-log.validator";
import { Prisma } from "@prisma/client";

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

/** Export path — same filters as the list UI, including farm/search, without pagination caps. */
export async function findAllForExport(params: {
  page?: number;
  pageSize?: number;
  animal_id?: number;
  farm_id?: number;
  session?: "Morning" | "Afternoon" | "Evening";
  date_from?: string;
  date_to?: string;
  search?: string;
}) {
  const { page = 1, pageSize = 50_000, ...filters } = params;
  const where: Prisma.milk_logsWhereInput = {};

  if (filters.animal_id) where.animal_id = filters.animal_id;
  if (filters.session) where.session = filters.session;

  if (filters.date_from || filters.date_to) {
    where.production_date = {};
    if (filters.date_from) {
      (where.production_date as Prisma.DateTimeNullableFilter).gte = new Date(
        filters.date_from,
      );
    }
    if (filters.date_to) {
      const d = new Date(filters.date_to);
      d.setDate(d.getDate() + 1);
      (where.production_date as Prisma.DateTimeNullableFilter).lt = d;
    }
  }

  if (filters.farm_id || filters.search) {
    const animalWhere: Prisma.animalsWhereInput = {};
    if (filters.farm_id) animalWhere.farm_id = filters.farm_id;
    if (filters.search) {
      animalWhere.OR = [
        { tag_number: { contains: filters.search, mode: "insensitive" } },
        { animal_name: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    where.animals = animalWhere;
  }

  const [data, total] = await Promise.all([
    prisma.milk_logs.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ production_date: "desc" }, { session: "asc" }],
      include: { animals: true },
    }),
    prisma.milk_logs.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}

export async function create(data: CreateMilkLogInput) {
  const productionDate = new Date(data.production_date);
  const { ConflictError, ValidationError } = await import("@/lib/errors");
  const { getProductionStatus } = await import("@/lib/production-status");

  const animal = await prisma.animals.findUnique({
    where: { animal_id: data.animal_id },
    include: {
      calving_records_as_mother: { select: { calving_id: true }, take: 1 },
      milk_logs: { select: { milk_log_id: true }, take: 1 },
    },
  });
  if (!animal) {
    const { NotFoundError } = await import("@/lib/errors");
    throw new NotFoundError("Animal");
  }

  const productionStatus = getProductionStatus({
    gender: animal.gender,
    lifecycle_stage: animal.lifecycle_stage,
    lactation_status: animal.lactation_status,
    hasCalvingHistory: animal.calving_records_as_mother.length > 0,
    hasMilkHistory: animal.milk_logs.length > 0,
  });
  if (productionStatus !== "lactating") {
    throw new ValidationError(
      "Milk can only be recorded for animals currently marked as lactating.",
    );
  }

  const existing = await prisma.milk_logs.findFirst({
    where: {
      animal_id: data.animal_id,
      production_date: productionDate,
      session: data.session,
    },
  });
  if (existing) {
    throw new ConflictError(
      `${data.session} milk record already exists for this animal on ${data.production_date}. Would you like to edit it instead?`,
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
  const today = getTodayProductionDate();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const eligibleAnimalFilter = milkEligibleAnimalFilter();

  const [
    todayData,
    todayBySession,
    lactatingAnimalCount,
    topProducerToday,
    monthlyData,
  ] = await Promise.all([
    prisma.milk_logs.aggregate({
      where: {
        production_date: { equals: today },
        animals: eligibleAnimalFilter,
      },
      _sum: { milk_liters: true },
    }),
    prisma.milk_logs.groupBy({
      by: ["session"],
      where: {
        production_date: { equals: today },
        animals: eligibleAnimalFilter,
      },
      _sum: { milk_liters: true },
    }),
    prisma.animals.count({ where: eligibleAnimalFilter }),
    prisma.milk_logs.groupBy({
      by: ["animal_id"],
      where: {
        production_date: { equals: today },
        animals: eligibleAnimalFilter,
      },
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
  let topProducerId: number | null = null;
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
    topProducerId = topProducerToday[0].animal_id;
  }

  const todayProduction = Number(todayData._sum.milk_liters ?? 0);
  const animalsMilkedToday = await prisma.milk_logs.findMany({
    where: {
      production_date: { equals: today },
      animals: eligibleAnimalFilter,
    },
    distinct: ["animal_id"],
    select: { animal_id: true },
  });
  const animalCount = animalsMilkedToday.length;
  const avgYield =
    lactatingAnimalCount > 0 ? todayProduction / lactatingAnimalCount : 0;
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
    lactatingAnimals: lactatingAnimalCount,
    avgYieldPerAnimal: parseFloat(avgYield.toFixed(1)),
    monthlyProduction: parseFloat(monthlyProduction.toFixed(1)),
    sessions,
    topProducerLabel,
    topProducerId,
  });
}

/**
 * The daily milk register — the real UI-facing shape (one row per
 * animal+day, sessions grouped into columns). The underlying storage is
 * still one row per session; this groups at read time via SQL so it stays
 * cheap even across thousands of milk_logs rows.
 */
export async function findAllDaily(params: DailyMilkQueryParams) {
  const { page, pageSize, animal_id, farm_id, date_from, date_to, search } = params;

  const conditions: Prisma.Sql[] = [];
  if (animal_id) conditions.push(Prisma.sql`ml.animal_id = ${animal_id}`);
  if (farm_id) conditions.push(Prisma.sql`a.farm_id = ${farm_id}`);
  if (date_from) conditions.push(Prisma.sql`ml.production_date >= ${new Date(date_from)}`);
  if (date_to) conditions.push(Prisma.sql`ml.production_date <= ${new Date(date_to)}`);
  if (search) conditions.push(Prisma.sql`(a.tag_number ILIKE ${"%" + search + "%"} OR a.animal_name ILIKE ${"%" + search + "%"})`);

  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      animal_id: number;
      tag_number: string;
      animal_name: string | null;
      production_date: string;
      morning: number | null;
      afternoon: number | null;
      evening: number | null;
      morning_id: number | null;
      afternoon_id: number | null;
      evening_id: number | null;
      total: number;
      quality_grade: string | null;
      notes: string | null;
    }>
  >`
    SELECT
      a.animal_id, a.tag_number, a.animal_name,
      ml.production_date::text AS production_date,
      MAX(CASE WHEN ml.session = 'Morning' THEN ml.milk_liters END)::float AS morning,
      MAX(CASE WHEN ml.session = 'Afternoon' THEN ml.milk_liters END)::float AS afternoon,
      MAX(CASE WHEN ml.session = 'Evening' THEN ml.milk_liters END)::float AS evening,
      MAX(CASE WHEN ml.session = 'Morning' THEN ml.milk_log_id END)::int AS morning_id,
      MAX(CASE WHEN ml.session = 'Afternoon' THEN ml.milk_log_id END)::int AS afternoon_id,
      MAX(CASE WHEN ml.session = 'Evening' THEN ml.milk_log_id END)::int AS evening_id,
      SUM(ml.milk_liters)::float AS total,
      (array_agg(ml.quality_grade ORDER BY CASE ml.quality_grade
        WHEN 'Rejected' THEN 0 WHEN 'C' THEN 1 WHEN 'B' THEN 2 WHEN 'A' THEN 3 ELSE 4 END)
        FILTER (WHERE ml.quality_grade IS NOT NULL))[1] AS quality_grade,
      string_agg(DISTINCT NULLIF(ml.notes, ''), ' | ') AS notes
    FROM milk_logs ml
    JOIN animals a ON a.animal_id = ml.animal_id
    ${where}
    GROUP BY a.animal_id, a.tag_number, a.animal_name, ml.production_date
    ORDER BY ml.production_date DESC, a.tag_number ASC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM (
      SELECT 1 FROM milk_logs ml
      JOIN animals a ON a.animal_id = ml.animal_id
      ${where}
      GROUP BY ml.animal_id, ml.production_date
    ) t
  `;
  const total = Number(countRows[0]?.count ?? 0);

  return serialize({ data: rows, total, page, pageSize });
}

/**
 * Create/update/clear each session of a single animal+day record from one
 * form submission. `null` clears (deletes) that session; a number
 * creates-or-updates it; `undefined` leaves it untouched. quality_grade and
 * notes are day-level in the UI, so they're applied to every session row
 * that ends up existing for the day after this call.
 */
export async function upsertDaily(data: UpsertDailyMilkInput) {
  const { animal_id, quality_grade, notes } = data;
  const production_date = new Date(data.production_date);

  const sessions: Array<{ key: "Morning" | "Afternoon" | "Evening"; value: number | null | undefined }> = [
    { key: "Morning", value: data.morning },
    { key: "Afternoon", value: data.afternoon },
    { key: "Evening", value: data.evening },
  ];

  for (const { key, value } of sessions) {
    if (value === undefined) continue;
    const existing = await prisma.milk_logs.findFirst({ where: { animal_id, production_date, session: key } });
    if (value === null) {
      if (existing) await prisma.milk_logs.delete({ where: { milk_log_id: existing.milk_log_id } });
      continue;
    }
    if (existing) {
      await prisma.milk_logs.update({ where: { milk_log_id: existing.milk_log_id }, data: { milk_liters: value } });
    } else {
      await prisma.milk_logs.create({
        data: { animal_id, production_date, session: key, milk_liters: value, quality_grade: quality_grade ?? null, notes: notes ?? null },
      });
    }
  }

  if (quality_grade !== undefined || notes !== undefined) {
    const updateData: Prisma.milk_logsUpdateManyMutationInput = {};
    if (quality_grade !== undefined) updateData.quality_grade = quality_grade;
    if (notes !== undefined) updateData.notes = notes;
    await prisma.milk_logs.updateMany({ where: { animal_id, production_date }, data: updateData });
  }

  const rows = await prisma.milk_logs.findMany({ where: { animal_id, production_date }, include: { animals: true } });
  return serialize(rows);
}

/** Deletes every session row for one animal+day — the "delete entire day" action. */
export async function removeDaily(animal_id: number, production_date: string) {
  const { count } = await prisma.milk_logs.deleteMany({ where: { animal_id, production_date: new Date(production_date) } });
  return count;
}
