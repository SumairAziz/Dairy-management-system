import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool } from "../types";
import { objectSchema, str, int } from "./json-schema";
import { buildVaccinationStatusWhere, type VaccinationRecordStatus } from "@/lib/vaccination-status";

const STATUS_VALUES = ["overdue", "due_today", "due_soon", "upcoming", "completed"] as const;

const getVaccinationStatusSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  farm_id: z.number().int().optional(),
  animal_id: z.number().int().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetVaccinationStatusArgs = z.infer<typeof getVaccinationStatusSchema>;

const getVaccinationStatus: AiTool<GetVaccinationStatusArgs> = {
  name: "getVaccinationStatus",
  category: "Vaccinations",
  description:
    "List vaccination records filtered by live status (overdue, due_today, due_soon = within 7 days, upcoming, or completed = no booster needed), optionally scoped to a farm or animal. Use for 'which vaccinations are overdue', 'what's due this week'.",
  parameters: objectSchema({
    status: str("Filter by status.", STATUS_VALUES),
    farm_id: int("Restrict to one farm."),
    animal_id: int("Restrict to one animal."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getVaccinationStatusSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.status) Object.assign(where, buildVaccinationStatusWhere(args.status as VaccinationRecordStatus));
    if (args.animal_id) where.animal_id = args.animal_id;
    if (args.farm_id) where.animals = { farm_id: args.farm_id };

    const [records, total] = await Promise.all([
      prisma.vaccination_records.findMany({
        where,
        take: args.limit,
        orderBy: [{ next_due_date: { sort: "asc", nulls: "last" } }],
        include: {
          animals: {
            select: { tag_number: true, animal_name: true, farms: { select: { farm_name: true } } },
          },
        },
      }),
      prisma.vaccination_records.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: records.length,
      records: records.map((r) => ({
        vaccination_id: r.vaccination_id,
        animal_tag: r.animals?.tag_number,
        animal_name: r.animals?.animal_name,
        farm: r.animals?.farms?.farm_name,
        vaccine_name: r.vaccine_name,
        vaccination_date: r.vaccination_date,
        next_due_date: r.next_due_date,
        administered_by: r.administered_by,
      })),
    });
  },
};

export const vaccinationTools: AiTool<any, any>[] = [getVaccinationStatus];
