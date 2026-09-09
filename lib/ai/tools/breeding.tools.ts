import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool } from "../types";
import { objectSchema, str, int } from "./json-schema";
import { dateStringSchema } from "./common";

const getBreedingRecordsSchema = z.object({
  result: z.enum(["Success", "Failed", "Pending"]).optional(),
  method: z.string().optional(),
  female_animal_id: z.number().int().optional(),
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetBreedingRecordsArgs = z.infer<typeof getBreedingRecordsSchema>;

const getBreedingRecords: AiTool<GetBreedingRecordsArgs> = {
  name: "getBreedingRecords",
  category: "Breeding",
  description:
    "List breeding (mating/AI) records, optionally filtered by result, method, a specific female animal, or a date range. Use for 'breeding records this month', 'AI vs natural mating success rate'.",
  parameters: objectSchema({
    result: str("Filter by outcome.", ["Success", "Failed", "Pending"]),
    method: str("Filter by method, e.g. 'Natural Mating' or 'Artificial Insemination'."),
    female_animal_id: int("Restrict to one female animal."),
    date_from: str("Start date YYYY-MM-DD."),
    date_to: str("End date YYYY-MM-DD."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getBreedingRecordsSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.result === "Pending") where.OR = [{ result: "Pending" }, { result: null }];
    else if (args.result) where.result = args.result;
    if (args.method) where.method = { contains: args.method, mode: "insensitive" };
    if (args.female_animal_id) where.female_animal_id = args.female_animal_id;
    if (args.date_from || args.date_to) {
      where.breeding_date = {};
      if (args.date_from) (where.breeding_date as Record<string, unknown>).gte = new Date(args.date_from);
      if (args.date_to) (where.breeding_date as Record<string, unknown>).lte = new Date(args.date_to);
    }

    const [records, total] = await Promise.all([
      prisma.breeding_records.findMany({
        where,
        take: args.limit,
        orderBy: { breeding_date: "desc" },
        include: {
          animals_breeding_records_female_animal_idToanimals: { select: { tag_number: true, animal_name: true } },
          animals_breeding_records_male_animal_idToanimals: { select: { tag_number: true, animal_name: true } },
        },
      }),
      prisma.breeding_records.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: records.length,
      records: records.map((r) => ({
        breeding_id: r.breeding_id,
        female: r.animals_breeding_records_female_animal_idToanimals?.tag_number,
        male: r.animals_breeding_records_male_animal_idToanimals?.tag_number,
        breeding_date: r.breeding_date,
        method: r.method,
        result: r.result ?? "Pending",
      })),
    });
  },
};

const getRepeatBreedersSchema = z.object({
  min_attempts: z.number().int().min(2).max(10).default(3),
  farm_id: z.number().int().optional(),
});
type GetRepeatBreedersArgs = z.infer<typeof getRepeatBreedersSchema>;

const getRepeatBreeders: AiTool<GetRepeatBreedersArgs> = {
  name: "getRepeatBreeders",
  category: "Breeding",
  description:
    "Find female animals that have had `min_attempts` or more breeding attempts without a recorded Success — i.e. repeat breeders that may need veterinary attention. Use for questions about animals that keep failing to conceive.",
  parameters: objectSchema({
    min_attempts: int("Minimum number of breeding attempts to flag, default 3."),
    farm_id: int("Restrict to one farm."),
  }),
  schema: getRepeatBreedersSchema,
  async handler(args) {
    const groups = await prisma.breeding_records.groupBy({
      by: ["female_animal_id"],
      where: {
        female_animal_id: { not: null },
        result: { notIn: ["Success"] },
        ...(args.farm_id ? { animals_breeding_records_female_animal_idToanimals: { farm_id: args.farm_id } } : {}),
      },
      _count: { female_animal_id: true },
      having: { female_animal_id: { _count: { gte: args.min_attempts } } },
    });

    const animalIds = groups.map((g) => g.female_animal_id).filter((id): id is number => id !== null);
    const animals = animalIds.length
      ? await prisma.animals.findMany({
          where: { animal_id: { in: animalIds } },
          select: { animal_id: true, tag_number: true, animal_name: true, farms: { select: { farm_name: true } } },
        })
      : [];
    const byId = new Map(animals.map((a) => [a.animal_id, a]));

    return serialize({
      threshold: args.min_attempts,
      animals: groups
        .map((g) => {
          const a = g.female_animal_id ? byId.get(g.female_animal_id) : undefined;
          return a
            ? {
                animal_id: a.animal_id,
                tag_number: a.tag_number,
                name: a.animal_name,
                farm: a.farms?.farm_name,
                failedOrPendingAttempts: g._count.female_animal_id,
              }
            : null;
        })
        .filter(Boolean),
    });
  },
};

export const breedingTools: AiTool<any, any>[] = [getBreedingRecords, getRepeatBreeders];
