import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool } from "../types";
import { objectSchema, str, int } from "./json-schema";
import { dateStringSchema } from "./common";

const getHealthIncidentsSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  farm_id: z.number().int().optional(),
  animal_id: z.number().int().optional(),
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetHealthIncidentsArgs = z.infer<typeof getHealthIncidentsSchema>;

const getHealthIncidents: AiTool<GetHealthIncidentsArgs> = {
  name: "getHealthIncidents",
  category: "Health",
  description:
    "List animal health incidents, optionally filtered by status (e.g. Under Treatment, Recovering, Recovered), severity (Mild/Moderate/Severe/Critical), farm, animal, or date range. Use for 'show animals with health incidents', 'sick animals'.",
  parameters: objectSchema({
    status: str("Exact status value, e.g. 'Under Treatment', 'Recovered'."),
    severity: str("Exact severity value, e.g. 'Mild', 'Severe', 'Critical'."),
    farm_id: int("Restrict to one farm."),
    animal_id: int("Restrict to one animal."),
    date_from: str("Start date YYYY-MM-DD (incident_date)."),
    date_to: str("End date YYYY-MM-DD."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getHealthIncidentsSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.status) where.status = args.status;
    if (args.severity) where.severity = args.severity;
    if (args.animal_id) where.animal_id = args.animal_id;
    if (args.farm_id) where.animals = { farm_id: args.farm_id };
    if (args.date_from || args.date_to) {
      where.incident_date = {};
      if (args.date_from) (where.incident_date as Record<string, unknown>).gte = new Date(args.date_from);
      if (args.date_to) (where.incident_date as Record<string, unknown>).lte = new Date(args.date_to);
    }

    const [records, total] = await Promise.all([
      prisma.health_incidents.findMany({
        where,
        take: args.limit,
        orderBy: { incident_date: "desc" },
        include: { animals: { select: { tag_number: true, animal_name: true, farms: { select: { farm_name: true } } } } },
      }),
      prisma.health_incidents.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: records.length,
      records: records.map((r) => ({
        incident_id: r.incident_id,
        animal_tag: r.animals?.tag_number,
        farm: r.animals?.farms?.farm_name,
        incident_date: r.incident_date,
        disease_name: r.disease_name,
        severity: r.severity,
        status: r.status,
        symptoms: r.symptoms,
      })),
    });
  },
};

const getTreatmentsSchema = z.object({
  incident_id: z.number().int().optional(),
  animal_id: z.number().int().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
type GetTreatmentsArgs = z.infer<typeof getTreatmentsSchema>;

const getTreatments: AiTool<GetTreatmentsArgs> = {
  name: "getTreatments",
  category: "Health",
  description: "List treatment records for a specific health incident or animal. Use `getHealthIncidents` first to find an incident_id if only an animal is known.",
  parameters: objectSchema({
    incident_id: int("Restrict to one health incident."),
    animal_id: int("Restrict to treatments for one animal (via its incidents)."),
    limit: int("Max rows, default 100, max 200."),
  }),
  schema: getTreatmentsSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.incident_id) where.incident_id = args.incident_id;
    if (args.animal_id) where.health_incidents = { animal_id: args.animal_id };

    const records = await prisma.treatment_records.findMany({
      where,
      take: args.limit,
      orderBy: { treatment_date: "desc" },
      include: { health_incidents: { select: { disease_name: true, animal_id: true } } },
    });

    return serialize(
      records.map((r) => ({
        treatment_id: r.treatment_id,
        incident_id: r.incident_id,
        disease_name: r.health_incidents?.disease_name,
        dosage: r.dosage,
        treatment_date: r.treatment_date,
        remarks: r.remarks,
      })),
    );
  },
};

export const healthTools: AiTool<any, any>[] = [getHealthIncidents, getTreatments];
