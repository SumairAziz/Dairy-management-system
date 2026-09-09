import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool } from "../types";
import { objectSchema, str, int } from "./json-schema";
import { dateStringSchema, round1 } from "./common";

const getMilkProductionSchema = z.object({
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  farm_id: z.number().int().optional(),
  animal_id: z.number().int().optional(),
  group_by: z.enum(["day", "week", "month", "farm", "animal"]).default("day"),
});
type GetMilkProductionArgs = z.infer<typeof getMilkProductionSchema>;

const getMilkProduction: AiTool<GetMilkProductionArgs> = {
  name: "getMilkProduction",
  category: "Milk Production",
  description:
    "Aggregate milk production totals over a date range, optionally scoped to a farm or a single animal, grouped by day/week/month/farm/animal. Use for 'how much milk last week', 'milk trend this month', 'which farm produced the most milk', etc. Defaults to the last 30 days if no dates given.",
  parameters: objectSchema({
    date_from: str("Start date YYYY-MM-DD. Defaults to 30 days before date_to (or today)."),
    date_to: str("End date YYYY-MM-DD (inclusive). Defaults to today."),
    farm_id: int("Restrict to one farm."),
    animal_id: int("Restrict to one animal."),
    group_by: str("How to bucket the totals.", ["day", "week", "month", "farm", "animal"]),
  }),
  schema: getMilkProductionSchema,
  async handler(args) {
    const to = args.date_to ?? new Date().toISOString().slice(0, 10);
    const from = args.date_from ?? new Date(new Date(to).getTime() - 29 * 86400000).toISOString().slice(0, 10);

    const animalFilter = args.animal_id ? Prisma.sql`AND m.animal_id = ${args.animal_id}` : Prisma.empty;
    const farmFilter = args.farm_id ? Prisma.sql`AND a.farm_id = ${args.farm_id}` : Prisma.empty;
    const dateFilter = Prisma.sql`AND m.production_date BETWEEN ${from}::date AND ${to}::date`;

    let rows: Array<{ bucket: string; liters: number }>;

    if (args.group_by === "farm") {
      const r = await prisma.$queryRaw<Array<{ bucket: string; liters: number }>>`
        SELECT f.farm_name AS bucket, COALESCE(SUM(m.milk_liters), 0)::float AS liters
        FROM farms f
        LEFT JOIN animals a ON a.farm_id = f.farm_id
        LEFT JOIN milk_logs m ON m.animal_id = a.animal_id ${dateFilter} ${animalFilter}
        GROUP BY f.farm_name ORDER BY liters DESC`;
      rows = r;
    } else if (args.group_by === "animal") {
      const r = await prisma.$queryRaw<Array<{ bucket: string; liters: number }>>`
        SELECT COALESCE(a.animal_name, a.tag_number) AS bucket, COALESCE(SUM(m.milk_liters), 0)::float AS liters
        FROM animals a
        JOIN milk_logs m ON m.animal_id = a.animal_id
        WHERE 1=1 ${dateFilter} ${animalFilter} ${farmFilter}
        GROUP BY a.animal_id, a.animal_name, a.tag_number ORDER BY liters DESC LIMIT 50`;
      rows = r;
    } else {
      const trunc = args.group_by === "week" ? "week" : args.group_by === "month" ? "month" : "day";
      const r = await prisma.$queryRaw<Array<{ bucket: string; liters: number }>>`
        SELECT to_char(date_trunc(${trunc}, m.production_date), 'YYYY-MM-DD') AS bucket,
          COALESCE(SUM(m.milk_liters), 0)::float AS liters
        FROM milk_logs m
        JOIN animals a ON a.animal_id = m.animal_id
        WHERE 1=1 ${dateFilter} ${animalFilter} ${farmFilter}
        GROUP BY 1 ORDER BY 1 ASC`;
      rows = r;
    }

    const total = rows.reduce((s, r) => s + r.liters, 0);

    return serialize({
      dateRange: { from, to },
      groupBy: args.group_by,
      totalLiters: round1(total),
      series: rows.map((r) => ({ label: r.bucket, liters: round1(r.liters) })),
    });
  },
};

const getTopMilkProducersSchema = z.object({
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  farm_id: z.number().int().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
type GetTopMilkProducersArgs = z.infer<typeof getTopMilkProducersSchema>;

const getTopMilkProducers: AiTool<GetTopMilkProducersArgs> = {
  name: "getTopMilkProducers",
  category: "Milk Production",
  description:
    "Rank animals by total milk produced over a date range (defaults to the last 30 days). Use for 'show highest producing cows', 'who are our top milkers this month'.",
  parameters: objectSchema({
    date_from: str("Start date YYYY-MM-DD. Defaults to 30 days before date_to."),
    date_to: str("End date YYYY-MM-DD. Defaults to today."),
    farm_id: int("Restrict to one farm."),
    limit: int("How many top animals to return, default 10, max 50."),
  }),
  schema: getTopMilkProducersSchema,
  async handler(args) {
    const to = args.date_to ?? new Date().toISOString().slice(0, 10);
    const from = args.date_from ?? new Date(new Date(to).getTime() - 29 * 86400000).toISOString().slice(0, 10);
    const farmFilter = args.farm_id ? Prisma.sql`AND a.farm_id = ${args.farm_id}` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{ animal_id: number; tag_number: string; animal_name: string | null; farm_name: string; liters: number }>
    >`
      SELECT a.animal_id, a.tag_number, a.animal_name, f.farm_name,
        COALESCE(SUM(m.milk_liters), 0)::float AS liters
      FROM animals a
      JOIN farms f ON f.farm_id = a.farm_id
      JOIN milk_logs m ON m.animal_id = a.animal_id
      WHERE m.production_date BETWEEN ${from}::date AND ${to}::date ${farmFilter}
      GROUP BY a.animal_id, a.tag_number, a.animal_name, f.farm_name
      ORDER BY liters DESC
      LIMIT ${args.limit}`;

    return serialize({
      dateRange: { from, to },
      topProducers: rows.map((r) => ({
        animal_id: r.animal_id,
        tag_number: r.tag_number,
        name: r.animal_name,
        farm: r.farm_name,
        totalLiters: round1(r.liters),
      })),
    });
  },
};

const getBreedMilkRanking: AiTool<Record<string, never>> = {
  name: "getBreedMilkRanking",
  category: "Milk Production",
  description:
    "Rank breeds by actual average daily milk yield computed from real milk_logs (not just the reference `average_milk_production` field on the breed). Use for 'which breed produces the most milk'.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    const rows = await prisma.$queryRaw<
      Array<{ breed_name: string; species_name: string; reference_avg: number | null; actual_avg_per_session: number; sample_size: number }>
    >`
      SELECT b.breed_name, s.species_name, b.average_milk_production::float AS reference_avg,
        COALESCE(AVG(m.milk_liters), 0)::float AS actual_avg_per_session,
        COUNT(m.milk_log_id)::int AS sample_size
      FROM breeds b
      JOIN species s ON s.species_id = b.species_id
      LEFT JOIN animals a ON a.breed_id = b.breed_id
      LEFT JOIN milk_logs m ON m.animal_id = a.animal_id
      GROUP BY b.breed_id, b.breed_name, s.species_name, b.average_milk_production
      HAVING COUNT(m.milk_log_id) > 0
      ORDER BY actual_avg_per_session DESC`;

    return serialize(
      rows.map((r) => ({
        breed: r.breed_name,
        species: r.species_name,
        referenceAveragePerSession: r.reference_avg,
        actualAveragePerSession: round1(r.actual_avg_per_session),
        sampleSize: r.sample_size,
      })),
    );
  },
};

export const milkTools: AiTool<any, any>[] = [getMilkProduction, getTopMilkProducers, getBreedMilkRanking];
