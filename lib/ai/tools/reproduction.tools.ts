import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool } from "../types";
import { objectSchema, str, int } from "./json-schema";
import { dateStringSchema } from "./common";
import { ACTIVE_PREGNANCY_STATUSES, TERMINAL_PREGNANCY_STATUSES } from "@/lib/pregnancy-status";

// ── Heat cycles ──────────────────────────────────────────────────────────────

const getHeatCyclesSchema = z.object({
  animal_id: z.number().int().optional(),
  farm_id: z.number().int().optional(),
  currently_in_heat: z.boolean().optional(),
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetHeatCyclesArgs = z.infer<typeof getHeatCyclesSchema>;

const getHeatCycles: AiTool<GetHeatCyclesArgs> = {
  name: "getHeatCycles",
  category: "Heat Cycles",
  description:
    "List heat-cycle detection records, optionally filtered by animal, farm, active status ('currently_in_heat' = no end date recorded yet), or date range.",
  parameters: objectSchema({
    animal_id: int("Restrict to one animal."),
    farm_id: int("Restrict to one farm."),
    currently_in_heat: str("true for cycles with no heat_end_date yet (animal currently in heat)."),
    date_from: str("Start date YYYY-MM-DD (matches heat_start_date)."),
    date_to: str("End date YYYY-MM-DD."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getHeatCyclesSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.animal_id) where.animal_id = args.animal_id;
    if (args.farm_id) where.animals = { farm_id: args.farm_id };
    if (args.currently_in_heat) where.heat_end_date = null;
    if (args.date_from || args.date_to) {
      where.heat_start_date = {};
      if (args.date_from) (where.heat_start_date as Record<string, unknown>).gte = new Date(args.date_from);
      if (args.date_to) (where.heat_start_date as Record<string, unknown>).lte = new Date(args.date_to);
    }

    const [records, total] = await Promise.all([
      prisma.heat_cycle_records.findMany({
        where,
        take: args.limit,
        orderBy: { heat_start_date: "desc" },
        include: { animals: { select: { tag_number: true, animal_name: true, farms: { select: { farm_name: true } } } } },
      }),
      prisma.heat_cycle_records.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: records.length,
      records: records.map((r) => ({
        heat_cycle_id: r.heat_cycle_id,
        animal_tag: r.animals?.tag_number,
        farm: r.animals?.farms?.farm_name,
        heat_start_date: r.heat_start_date,
        heat_end_date: r.heat_end_date,
        detection_method: r.detection_method,
      })),
    });
  },
};

const getRepeatHeatAnimalsSchema = z.object({
  min_cycles: z.number().int().min(2).max(10).default(3),
  within_days: z.number().int().min(30).max(730).default(90),
});
type GetRepeatHeatAnimalsArgs = z.infer<typeof getRepeatHeatAnimalsSchema>;

const getRepeatHeatAnimals: AiTool<GetRepeatHeatAnimalsArgs> = {
  name: "getRepeatHeatAnimals",
  category: "Heat Cycles",
  description:
    "Find animals that have gone into heat `min_cycles` or more times within the last `within_days` days without conceiving — i.e. animals repeatedly returning to heat, a fertility red flag. Use for 'which animals repeatedly return to heat'.",
  parameters: objectSchema({
    min_cycles: int("Minimum number of heat cycles in the window to flag, default 3."),
    within_days: int("Lookback window in days, default 90."),
  }),
  schema: getRepeatHeatAnimalsSchema,
  async handler(args) {
    const since = new Date(Date.now() - args.within_days * 86400000);
    const groups = await prisma.heat_cycle_records.groupBy({
      by: ["animal_id"],
      where: { animal_id: { not: null }, heat_start_date: { gte: since } },
      _count: { animal_id: true },
      having: { animal_id: { _count: { gte: args.min_cycles } } },
    });

    const animalIds = groups.map((g) => g.animal_id).filter((id): id is number => id !== null);
    const animals = animalIds.length
      ? await prisma.animals.findMany({
          where: { animal_id: { in: animalIds } },
          select: {
            animal_id: true,
            tag_number: true,
            animal_name: true,
            pregnancy_status: true,
            farms: { select: { farm_name: true } },
          },
        })
      : [];
    const byId = new Map(animals.map((a) => [a.animal_id, a]));

    return serialize({
      minCycles: args.min_cycles,
      withinDays: args.within_days,
      animals: groups
        .map((g) => {
          const a = g.animal_id ? byId.get(g.animal_id) : undefined;
          return a
            ? {
                animal_id: a.animal_id,
                tag_number: a.tag_number,
                name: a.animal_name,
                farm: a.farms?.farm_name,
                pregnancy_status: a.pregnancy_status,
                heatCyclesInWindow: g._count.animal_id,
              }
            : null;
        })
        .filter(Boolean),
    });
  },
};

// ── Pregnancy ────────────────────────────────────────────────────────────────

const getPregnancyRecordsSchema = z.object({
  status: z.enum(["active", "pending", "confirmed", "due_soon", "overdue", "delivered", "failed"]).optional(),
  due_within_days: z.number().int().min(1).max(365).optional(),
  farm_id: z.number().int().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetPregnancyRecordsArgs = z.infer<typeof getPregnancyRecordsSchema>;

const getPregnancyRecords: AiTool<GetPregnancyRecordsArgs> = {
  name: "getPregnancyRecords",
  category: "Pregnancy",
  description:
    "List pregnancy records. `status: active` = any ongoing pregnancy. `due_within_days` filters by expected_delivery_date being within N days from today (combine with status 'active' or 'confirmed' for 'pregnant animals due next month' type questions).",
  parameters: objectSchema({
    status: str("Filter by status.", ["active", "pending", "confirmed", "due_soon", "overdue", "delivered", "failed"]),
    due_within_days: int("Only records whose expected_delivery_date falls within this many days from today."),
    farm_id: int("Restrict to one farm."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getPregnancyRecordsSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.farm_id) where.animals = { farm_id: args.farm_id };

    if (args.status === "active") where.status = { in: [...ACTIVE_PREGNANCY_STATUSES] };
    else if (args.status === "pending") where.status = "Pending";
    else if (args.status === "confirmed") where.status = "Confirmed";
    else if (args.status === "delivered") where.status = "Delivered";
    else if (args.status === "failed") where.status = { in: ["Failed", "Aborted"] };
    else if (args.status === "overdue") {
      where.status = "Confirmed";
      where.expected_delivery_date = { lt: new Date() };
    } else if (args.status === "due_soon") {
      where.status = "Confirmed";
      where.expected_delivery_date = { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) };
    }

    if (args.due_within_days) {
      where.expected_delivery_date = {
        ...(where.expected_delivery_date as object | undefined),
        gte: new Date(),
        lte: new Date(Date.now() + args.due_within_days * 86400000),
      };
      if (!args.status) where.status = { notIn: [...TERMINAL_PREGNANCY_STATUSES] };
    }

    const [records, total] = await Promise.all([
      prisma.pregnancy_records.findMany({
        where,
        take: args.limit,
        orderBy: [{ expected_delivery_date: { sort: "asc", nulls: "last" } }],
        include: { animals: { select: { tag_number: true, animal_name: true, farms: { select: { farm_name: true } } } } },
      }),
      prisma.pregnancy_records.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: records.length,
      records: records.map((r) => ({
        pregnancy_id: r.pregnancy_id,
        animal_tag: r.animals?.tag_number,
        farm: r.animals?.farms?.farm_name,
        insemination_date: r.insemination_date,
        confirmation_date: r.confirmation_date,
        expected_delivery_date: r.expected_delivery_date,
        actual_delivery_date: r.actual_delivery_date,
        status: r.status,
      })),
    });
  },
};

// ── Calving ──────────────────────────────────────────────────────────────────

const getCalvingRecordsSchema = z.object({
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  outcome: z.string().optional(),
  farm_id: z.number().int().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetCalvingRecordsArgs = z.infer<typeof getCalvingRecordsSchema>;

const getCalvingRecords: AiTool<GetCalvingRecordsArgs> = {
  name: "getCalvingRecords",
  category: "Calving",
  description: "List calving events, optionally filtered by date range, outcome (Live Birth/Stillbirth/Complications/Twins), or farm.",
  parameters: objectSchema({
    date_from: str("Start date YYYY-MM-DD."),
    date_to: str("End date YYYY-MM-DD."),
    outcome: str("Filter by outcome, e.g. 'Live Birth'."),
    farm_id: int("Restrict to one farm."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getCalvingRecordsSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.outcome) where.outcome = args.outcome;
    if (args.farm_id) where.mother = { farm_id: args.farm_id };
    if (args.date_from || args.date_to) {
      where.calving_date = {};
      if (args.date_from) (where.calving_date as Record<string, unknown>).gte = new Date(args.date_from);
      if (args.date_to) (where.calving_date as Record<string, unknown>).lte = new Date(args.date_to);
    }

    const [records, total] = await Promise.all([
      prisma.calving_records.findMany({
        where,
        take: args.limit,
        orderBy: { calving_date: "desc" },
        include: {
          mother: { select: { tag_number: true, farms: { select: { farm_name: true } } } },
          calf: { select: { tag_number: true } },
        },
      }),
      prisma.calving_records.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: records.length,
      records: records.map((r) => ({
        calving_id: r.calving_id,
        mother_tag: r.mother?.tag_number,
        farm: r.mother?.farms?.farm_name,
        calving_date: r.calving_date,
        outcome: r.outcome,
        calf_gender: r.calf_gender,
        calf_tag: r.calf_tag ?? r.calf?.tag_number,
      })),
    });
  },
};

const getCalvingSummarySchema = z.object({ year: z.number().int().min(2000).max(2100).optional() });
type GetCalvingSummaryArgs = z.infer<typeof getCalvingSummarySchema>;

const getCalvingSummary: AiTool<GetCalvingSummaryArgs> = {
  name: "getCalvingSummary",
  category: "Calving",
  description: "Summarize calving events for a given year (defaults to the current year): total calves born, breakdown by outcome, by calf gender, and a monthly trend. Use for 'how many calves were born this year'.",
  parameters: objectSchema({ year: int("Calendar year, defaults to the current year.") }),
  schema: getCalvingSummarySchema,
  async handler(args) {
    const year = args.year ?? new Date().getFullYear();
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31T23:59:59`);

    const [total, byOutcome, byGender, monthly] = await Promise.all([
      prisma.calving_records.count({ where: { calving_date: { gte: start, lte: end } } }),
      prisma.calving_records.groupBy({ by: ["outcome"], where: { calving_date: { gte: start, lte: end } }, _count: true }),
      prisma.calving_records.groupBy({ by: ["calf_gender"], where: { calving_date: { gte: start, lte: end } }, _count: true }),
      prisma.$queryRaw<Array<{ month: string; count: number }>>`
        SELECT to_char(date_trunc('month', calving_date), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM calving_records
        WHERE calving_date BETWEEN ${start} AND ${end}
        GROUP BY 1 ORDER BY 1`,
    ]);

    return serialize({
      year,
      totalCalvingEvents: total,
      byOutcome: byOutcome.map((g) => ({ outcome: g.outcome ?? "Unknown", count: g._count })),
      byGender: byGender.map((g) => ({ gender: g.calf_gender === "M" ? "Male" : g.calf_gender === "F" ? "Female" : "Unknown", count: g._count })),
      monthlyTrend: monthly,
    });
  },
};

export const reproductionTools: AiTool<any, any>[] = [
  getHeatCycles,
  getRepeatHeatAnimals,
  getPregnancyRecords,
  getCalvingRecords,
  getCalvingSummary,
];
