import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { productionStatusWhere } from "@/lib/production-status";
import type { AiTool } from "../types";
import { objectSchema, str, int, bool } from "./json-schema";
import { limitSchema } from "./common";

const getAnimalsSchema = z.object({
  farm_id: z.number().int().optional(),
  species_id: z.number().int().optional(),
  breed_id: z.number().int().optional(),
  lifecycle_stage: z.string().optional(),
  gender: z.enum(["M", "F"]).optional(),
  is_active: z.boolean().optional(),
  pregnant_only: z.boolean().optional(),
  lactation_status: z.enum(["LACTATING", "DRY"]).optional(),
  production_status: z.enum(["lactating", "dry", "never_lactated", "not_applicable"]).optional(),
  has_health_issue: z.boolean().optional(),
  search: z.string().optional(),
  limit: limitSchema,
});
type GetAnimalsArgs = z.infer<typeof getAnimalsSchema>;

const getAnimals: AiTool<GetAnimalsArgs> = {
  name: "getAnimals",
  category: "Animals",
  description:
    "List/filter animals in the herd. Use for questions like 'show all pregnant animals', 'list dry animals', 'show animals on Farm X', 'active female animals', etc. Returns up to `limit` animals (default 50) plus the total matching count.",
  parameters: objectSchema({
    farm_id: int("Restrict to a specific farm by its numeric id."),
    species_id: int("Restrict to a specific species by its numeric id."),
    breed_id: int("Restrict to a specific breed by its numeric id."),
    lifecycle_stage: str("Exact lifecycle stage, e.g. Calf, Heifer, Lactating, Dry, Bull, Retired."),
    gender: str("M for male, F for female.", ["M", "F"]),
    is_active: bool("true for currently active animals only, false for inactive/retired/sold/deceased."),
    pregnant_only: bool("true to return only animals with an active (ongoing) pregnancy."),
    lactation_status: str("LACTATING or DRY.", ["LACTATING", "DRY"]),
    production_status: str(
      "Production filter: lactating, dry, never_lactated, or not_applicable.",
      ["lactating", "dry", "never_lactated", "not_applicable"],
    ),
    has_health_issue: bool("true to return only animals with at least one open (non-Recovered/Resolved) health incident."),
    search: str("Free-text search against tag number or animal name."),
    limit: int("Max rows to return, default 50, max 200."),
  }),
  schema: getAnimalsSchema,
  async handler(args) {
    const where: Record<string, unknown> = {};
    if (args.farm_id) where.farm_id = args.farm_id;
    if (args.breed_id) where.breed_id = args.breed_id;
    if (args.species_id) where.breeds = { species_id: args.species_id };
    if (args.lifecycle_stage) where.lifecycle_stage = args.lifecycle_stage;
    if (args.gender) where.gender = args.gender;
    if (typeof args.is_active === "boolean") where.is_active = args.is_active;
    if (args.lactation_status) where.lactation_status = args.lactation_status;
    if (args.production_status) {
      Object.assign(where, productionStatusWhere(args.production_status));
    }
    if (args.pregnant_only) {
      where.pregnancy_records = { some: { status: { in: ["Pending", "Confirmed", "In Progress"] } } };
    }
    if (args.has_health_issue) {
      where.health_incidents = { some: { status: { notIn: ["Recovered", "Resolved"] } } };
    }
    if (args.search) {
      where.OR = [
        { tag_number: { contains: args.search, mode: "insensitive" } },
        { animal_name: { contains: args.search, mode: "insensitive" } },
      ];
    }

    const take = args.limit ?? 50;
    const [data, total] = await Promise.all([
      prisma.animals.findMany({
        where,
        take,
        orderBy: { animal_id: "desc" },
        select: {
          animal_id: true,
          tag_number: true,
          animal_name: true,
          gender: true,
          date_of_birth: true,
          lifecycle_stage: true,
          is_active: true,
          pregnancy_status: true,
          lactation_status: true,
          farms: { select: { farm_id: true, farm_name: true } },
          breeds: { select: { breed_name: true, species: { select: { species_name: true } } } },
        },
      }),
      prisma.animals.count({ where }),
    ]);

    return serialize({
      totalMatching: total,
      returned: data.length,
      truncated: total > data.length,
      animals: data.map((a) => ({
        animal_id: a.animal_id,
        tag_number: a.tag_number,
        name: a.animal_name,
        gender: a.gender,
        date_of_birth: a.date_of_birth,
        lifecycle_stage: a.lifecycle_stage,
        is_active: a.is_active,
        pregnancy_status: a.pregnancy_status,
        lactation_status: a.lactation_status,
        farm: a.farms?.farm_name,
        breed: a.breeds?.breed_name,
        species: a.breeds?.species?.species_name,
      })),
    });
  },
};

const getAnimalHistorySchema = z.object({
  animal_id: z.number().int(),
});
type GetAnimalHistoryArgs = z.infer<typeof getAnimalHistorySchema>;

const getAnimalHistory: AiTool<GetAnimalHistoryArgs> = {
  name: "getAnimalHistory",
  category: "Animals",
  description:
    "Get the complete profile and history for ONE animal by id: identity, current status, recent milk yield, health incidents, vaccinations, breeding attempts, pregnancy records, heat cycles, and growth (weight) log. Use this whenever the user asks about a specific animal by tag/name/id, or asks 'why does this animal keep returning to heat' etc.",
  parameters: objectSchema(
    { animal_id: int("The animal's numeric animal_id (use getAnimals first if you only have a tag number).") },
    ["animal_id"],
  ),
  schema: getAnimalHistorySchema,
  async handler(args) {
    const animal = await prisma.animals.findUnique({
      where: { animal_id: args.animal_id },
      include: {
        farms: { select: { farm_name: true } },
        units: { select: { unit_name: true } },
        breeds: { select: { breed_name: true, species: { select: { species_name: true } } } },
        milk_logs: { orderBy: { production_date: "desc" }, take: 14 },
        health_incidents: { orderBy: { incident_date: "desc" }, take: 10 },
        vaccination_records: { orderBy: { vaccination_date: "desc" }, take: 10 },
        growth_logs: { orderBy: { recorded_date: "desc" }, take: 10 },
        heat_cycle_records: { orderBy: { heat_start_date: "desc" }, take: 10 },
        pregnancy_records: { orderBy: { insemination_date: "desc" }, take: 10 },
        breeding_records_breeding_records_female_animal_idToanimals: {
          orderBy: { breeding_date: "desc" },
          take: 10,
        },
      },
    });

    if (!animal) return { found: false, message: `No animal found with animal_id ${args.animal_id}.` };

    return serialize({
      found: true,
      profile: {
        animal_id: animal.animal_id,
        tag_number: animal.tag_number,
        name: animal.animal_name,
        gender: animal.gender,
        date_of_birth: animal.date_of_birth,
        lifecycle_stage: animal.lifecycle_stage,
        is_active: animal.is_active,
        pregnancy_status: animal.pregnancy_status,
        lactation_status: animal.lactation_status,
        farm: animal.farms?.farm_name,
        unit: animal.units?.unit_name,
        breed: animal.breeds?.breed_name,
        species: animal.breeds?.species?.species_name,
      },
      recentMilkLogs: animal.milk_logs,
      healthIncidents: animal.health_incidents,
      vaccinationRecords: animal.vaccination_records,
      growthLogs: animal.growth_logs,
      heatCycles: animal.heat_cycle_records,
      pregnancyRecords: animal.pregnancy_records,
      breedingAttempts: animal.breeding_records_breeding_records_female_animal_idToanimals,
    });
  },
};

export const animalTools: AiTool<any, any>[] = [getAnimals, getAnimalHistory];
