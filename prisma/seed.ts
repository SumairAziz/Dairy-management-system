/**
 * Demo data seed for TerraDairy.
 *
 * Builds a multi-year farm history in dependency order (farms → units →
 * species → breeds → animals → heat cycles → breeding → pregnancy →
 * calving → milk production), reusing the real service layer for
 * breeding/pregnancy/calving/vaccination so the same cascades that run in
 * production (mother status updates, auto-generated vaccination reminders,
 * notifications) apply to the seed data too.
 *
 * Run with: npm run db:seed  (or: npx tsx prisma/seed.ts)
 * Re-running wipes and regenerates everything (see resetDatabase()).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import * as breedingService from "@/services/breeding.service";
import * as pregnancyService from "@/services/pregnancy.service";
import * as calvingService from "@/services/calving.service";
import * as vaccinationService from "@/services/vaccination.service";
import { seedE2eLifecycleAnimal } from "./seed-e2e-lifecycle-animal";

// ─────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────

// All date-only math is done in UTC so that Date objects written directly via
// Prisma (bypassing the service layer's `new Date("YYYY-MM-DD")` string
// parsing, which itself parses as UTC midnight) land on the intended calendar
// date regardless of the machine's local timezone.
const TODAY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function daysAgo(n: number): Date {
  return addDays(TODAY, -n);
}
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthsAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 1): number {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function pickWeighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [item, w] of items) {
    if (r < w) return item;
    r -= w;
  }
  return items[items.length - 1][0];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function chance(pct: number): boolean {
  return Math.random() * 100 < pct;
}

const VET_NAMES = ["Dr. Aisha Raza", "Dr. Bilal Khan", "Dr. Sana Malik", "Farm Staff"];

// ─────────────────────────────────────────────────────────────────────────
// 0. Reset — wipe every table so reseeding is idempotent (children first)
// ─────────────────────────────────────────────────────────────────────────

async function resetDatabase() {
  console.log("Resetting database…");
  await prisma.chat_message_reads.deleteMany();
  await prisma.chat_message_attachments.deleteMany();
  await prisma.chat_messages.deleteMany();
  await prisma.chat_conversation_participants.deleteMany();
  await prisma.chat_conversations.deleteMany();
  await prisma.user_presence.deleteMany();
  await prisma.notifications.deleteMany();
  await prisma.audit_logs.deleteMany();
  await prisma.inventory_transactions.deleteMany();
  await prisma.inventory_lots.deleteMany();
  await prisma.vaccination_records.deleteMany();
  await prisma.calving_records.deleteMany();
  await prisma.pregnancy_records.deleteMany();
  await prisma.breeding_records.deleteMany();
  await prisma.heat_cycle_records.deleteMany();
  await prisma.milk_logs.deleteMany();
  await prisma.growth_logs.deleteMany();
  await prisma.treatment_records.deleteMany();
  await prisma.health_incidents.deleteMany();
  await prisma.group_treatment_batches.deleteMany();
  await prisma.inventory_items.deleteMany();
  await prisma.animals.deleteMany();
  await prisma.breeds.deleteMany();
  await prisma.species.deleteMany();
  await prisma.units.deleteMany();
  await prisma.farms.deleteMany();
  await prisma.users.deleteMany();
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Users
// ─────────────────────────────────────────────────────────────────────────

async function seedUsers() {
  const demoPasswordHash = await bcrypt.hash("Demo@12345", 10);
  const users = [
    { name: "Ahmed Raza", email: "admin@terradairy.demo", role: "ADMIN", password_hash: demoPasswordHash },
    { name: "Imran Sheikh", email: "manager@terradairy.demo", role: "FARM_MANAGER", password_hash: demoPasswordHash },
    { name: "Dr. Aisha Raza", email: "vet@terradairy.demo", role: "VETERINARIAN", password_hash: demoPasswordHash },
    { name: "Inventory Lead", email: "inventory@terradairy.demo", role: "INVENTORY_MANAGER", password_hash: demoPasswordHash },
    { name: "Bilal Ahmed", email: "worker@terradairy.demo", role: "FARM_WORKER", password_hash: demoPasswordHash },
    { name: "Sana Malik", email: "viewer@terradairy.demo", role: "VIEWER", password_hash: demoPasswordHash },
    {
      name: "Sumair",
      email: "123misaliravian@gmail.com",
      role: "ADMIN",
      password_hash: await bcrypt.hash("_uYx.*DA6qZ!#dk", 10),
    },
  ];
  for (const u of users) {
    await prisma.users.create({ data: u });
  }
  console.log(`  users: ${users.length}`);
  return users.length;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Farms
// ─────────────────────────────────────────────────────────────────────────

const FARM_DEFS = [
  {
    farm_name: "Green Valley Dairy",
    owner_name: "Ahmed Raza",
    contact_number: "+92-300-1234567",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    total_area_acres: 120,
    foundedYearsAgo: 5,
    tagPrefix: "GVD",
    notes: "Flagship dairy operation — mixed Holstein Friesian and Sahiwal herd.",
  },
  {
    farm_name: "Punjab Milk Farm",
    owner_name: "Imran Sheikh",
    contact_number: "+92-321-2345678",
    city: "Faisalabad",
    province: "Punjab",
    country: "Pakistan",
    total_area_acres: 85,
    foundedYearsAgo: 4,
    tagPrefix: "PMF",
    notes: "Buffalo-focused milk production with a growing goat herd.",
  },
  {
    farm_name: "Sunrise Livestock Farm",
    owner_name: "Sana Malik",
    contact_number: "+92-333-3456789",
    city: "Multan",
    province: "Punjab",
    country: "Pakistan",
    total_area_acres: 60,
    foundedYearsAgo: 2,
    tagPrefix: "SLF",
    notes: "Newest of the three sites, expanding the breeding program.",
  },
];

async function seedFarms() {
  const farms = [];
  for (const f of FARM_DEFS) {
    const created = await prisma.farms.create({
      data: {
        farm_name: f.farm_name,
        owner_name: f.owner_name,
        contact_number: f.contact_number,
        city: f.city,
        province: f.province,
        country: f.country,
        total_area_acres: f.total_area_acres,
        notes: f.notes,
        is_active: true,
        created_at: monthsAgo(f.foundedYearsAgo * 12),
      },
    });
    farms.push({ ...created, tagPrefix: f.tagPrefix });
  }
  console.log(`  farms: ${farms.length}`);
  return farms;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Units
// ─────────────────────────────────────────────────────────────────────────

type Farm = Awaited<ReturnType<typeof seedFarms>>[number];

async function seedUnits(farms: Farm[]) {
  const defs: Array<{ farmIdx: number; unit_name: string; unit_type: string; capacity: number }> = [
    { farmIdx: 0, unit_name: "Main Dairy Shed", unit_type: "Milking Unit", capacity: 40 },
    { farmIdx: 0, unit_name: "Calf Shed", unit_type: "Calf Shed", capacity: 15 },
    { farmIdx: 0, unit_name: "Pregnant Animals Unit", unit_type: "Maternity Unit", capacity: 12 },
    { farmIdx: 0, unit_name: "Bull Unit", unit_type: "Bull Unit", capacity: 4 },
    { farmIdx: 0, unit_name: "Dry Animals Unit", unit_type: "Dry Unit", capacity: 10 },
    { farmIdx: 1, unit_name: "Main Dairy Shed", unit_type: "Milking Unit", capacity: 35 },
    { farmIdx: 1, unit_name: "Dry Animals Unit", unit_type: "Dry Unit", capacity: 10 },
    { farmIdx: 1, unit_name: "Isolation Unit", unit_type: "Isolation Unit", capacity: 6 },
    { farmIdx: 2, unit_name: "Main Dairy Shed", unit_type: "Milking Unit", capacity: 25 },
    { farmIdx: 2, unit_name: "Calf Shed", unit_type: "Calf Shed", capacity: 10 },
    { farmIdx: 2, unit_name: "Bull Unit", unit_type: "Bull Unit", capacity: 3 },
    { farmIdx: 2, unit_name: "Dry Animals Unit", unit_type: "Dry Unit", capacity: 8 },
  ];

  const units = [];
  for (const d of defs) {
    const created = await prisma.units.create({
      data: {
        farm_id: farms[d.farmIdx].farm_id,
        unit_name: d.unit_name,
        unit_type: d.unit_type,
        capacity: d.capacity,
        is_active: true,
      },
    });
    units.push({ ...created, farmIdx: d.farmIdx });
  }
  console.log(`  units: ${units.length}`);
  return units;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Species & Breeds
// ─────────────────────────────────────────────────────────────────────────

const SPECIES_DEFS = [
  { species_name: "Cow", scientific_name: "Bos taurus" },
  { species_name: "Buffalo", scientific_name: "Bubalus bubalis" },
  { species_name: "Goat", scientific_name: "Capra aegagrus hircus" },
  { species_name: "Sheep", scientific_name: "Ovis aries" },
];

async function seedSpecies() {
  const species = [];
  for (const s of SPECIES_DEFS) {
    species.push(await prisma.species.create({ data: { ...s, is_active: true } }));
  }
  console.log(`  species: ${species.length}`);
  return species;
}

type Species = Awaited<ReturnType<typeof seedSpecies>>[number];

const BREED_DEFS = [
  { species: "Cow", breed_name: "Holstein Friesian", origin_country: "Netherlands", average_milk_production: 28 },
  { species: "Cow", breed_name: "Jersey", origin_country: "United Kingdom", average_milk_production: 20 },
  { species: "Cow", breed_name: "Sahiwal", origin_country: "Pakistan", average_milk_production: 12 },
  { species: "Buffalo", breed_name: "Nili Ravi", origin_country: "Pakistan", average_milk_production: 14 },
  { species: "Buffalo", breed_name: "Kundhi", origin_country: "Pakistan", average_milk_production: 9 },
  { species: "Goat", breed_name: "Beetal", origin_country: "Pakistan", average_milk_production: 2.5 },
  { species: "Goat", breed_name: "Teddy", origin_country: "Pakistan", average_milk_production: 1.8 },
  { species: "Sheep", breed_name: "Kajli", origin_country: "Pakistan", average_milk_production: 1.5 },
  { species: "Sheep", breed_name: "Lohi", origin_country: "Pakistan", average_milk_production: 1.8 },
  { species: "Sheep", breed_name: "Balkhi", origin_country: "Pakistan", average_milk_production: 1.6 },
];

async function seedBreeds(species: Species[]) {
  const speciesByName = new Map(species.map((s) => [s.species_name, s]));
  const breeds = [];
  for (const b of BREED_DEFS) {
    const sp = speciesByName.get(b.species)!;
    const created = await prisma.breeds.create({
      data: {
        species_id: sp.species_id,
        breed_name: b.breed_name,
        origin_country: b.origin_country,
        average_milk_production: b.average_milk_production,
        is_active: true,
      },
    });
    breeds.push({ ...created, speciesName: b.species });
  }
  console.log(`  breeds: ${breeds.length}`);
  return breeds;
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Animals — foundation herd
// ─────────────────────────────────────────────────────────────────────────

type Breed = Awaited<ReturnType<typeof seedBreeds>>[number];
type Unit = Awaited<ReturnType<typeof seedUnits>>[number];

interface AnimalRow {
  animal_id: number;
  farm_id: number;
  unit_id: number | null;
  breed_id: number;
  tag_number: string;
  animal_name: string | null;
  gender: string;
  date_of_birth: Date;
  lifecycle_stage: string;
  speciesName: string;
  farmIdx: number;
}

const CATTLE_NAMES_F = ["Bella", "Daisy", "Luna", "Rosie", "Molly", "Amber", "Coco", "Hazel", "Ivy", "Nala", "Pepper", "Sadie", "Willow", "Zara", "Meera", "Sana", "Ayesha", "Noor", "Farah", "Rani", "Chandni", "Gulab", "Kiran", "Laila", "Mishti"];
const CATTLE_NAMES_M = ["Max", "Rocky", "Titan", "Bruno", "Duke", "Zeus", "Bagheera", "Sultan", "Toofan", "Sheru"];

function makeName(gender: string): string | null {
  if (chance(15)) return null; // some animals are just tagged, no name
  return gender === "F" ? pick(CATTLE_NAMES_F) : pick(CATTLE_NAMES_M);
}

async function seedFoundationAnimals(farms: Farm[], units: Unit[], breeds: Breed[]) {
  const dairyBreeds = breeds.filter((b) => b.speciesName === "Cow" || b.speciesName === "Buffalo");
  const smallBreeds = breeds.filter((b) => b.speciesName === "Goat" || b.speciesName === "Sheep");

  const unitByFarmAndType = (farmIdx: number, type: string) =>
    units.find((u) => u.farmIdx === farmIdx && u.unit_type === type) ??
    units.find((u) => u.farmIdx === farmIdx);

  const tagCounters = [0, 0, 0];
  const nextTag = (farmIdx: number) => {
    tagCounters[farmIdx] += 1;
    return `${farms[farmIdx].tagPrefix}-${String(tagCounters[farmIdx]).padStart(4, "0")}`;
  };

  interface Bucket {
    count: number;
    stage: string;
    breedPool: Breed[];
    ageMonths: [number, number];
    gender: "F" | "M" | "mixed";
    unitType: string;
    isActive?: boolean;
  }

  const buckets: Bucket[] = [
    { count: 6, stage: "Calf", breedPool: [...dairyBreeds, ...smallBreeds], ageMonths: [1, 9], gender: "mixed", unitType: "Calf Shed" },
    { count: 9, stage: "Heifer", breedPool: dairyBreeds, ageMonths: [10, 24], gender: "F", unitType: "Milking Unit" },
    { count: 4, stage: "Heifer", breedPool: smallBreeds, ageMonths: [8, 20], gender: "F", unitType: "Calf Shed" },
    { count: 24, stage: "Lactating", breedPool: dairyBreeds, ageMonths: [30, 108], gender: "F", unitType: "Milking Unit" },
    { count: 6, stage: "Dry", breedPool: dairyBreeds, ageMonths: [36, 108], gender: "F", unitType: "Dry Unit" },
    { count: 3, stage: "Dry", breedPool: smallBreeds, ageMonths: [24, 72], gender: "F", unitType: "Calf Shed" },
    { count: 2, stage: "Bull", breedPool: dairyBreeds, ageMonths: [30, 96], gender: "M", unitType: "Bull Unit" },
    { count: 3, stage: "Breeding Bull", breedPool: dairyBreeds, ageMonths: [36, 90], gender: "M", unitType: "Bull Unit" },
    { count: 3, stage: "Retired", breedPool: dairyBreeds, ageMonths: [84, 140], gender: "mixed", unitType: "Dry Unit", isActive: false },
  ];

  const animals: AnimalRow[] = [];

  for (const bucket of buckets) {
    for (let i = 0; i < bucket.count; i++) {
      const farmIdx = randInt(0, farms.length - 1);
      const breed = pick(bucket.breedPool);
      const gender = bucket.gender === "mixed" ? pick(["M", "F"] as const) : bucket.gender;
      const ageMonths = randInt(bucket.ageMonths[0], bucket.ageMonths[1]);
      const dob = monthsAgo(ageMonths + randInt(0, 1));
      const unit = unitByFarmAndType(farmIdx, bucket.unitType);
      const isActive = bucket.isActive ?? true;
      let stage = bucket.stage;
      if (!isActive) stage = pick(["Retired", "Sold", "Deceased"]);
      const lactationStatus = stage === "Lactating" ? "LACTATING" : stage === "Dry" ? "DRY" : null;

      const created = await prisma.animals.create({
        data: {
          farm_id: farms[farmIdx].farm_id,
          unit_id: unit?.unit_id ?? null,
          breed_id: breed.breed_id,
          tag_number: nextTag(farmIdx),
          animal_name: makeName(gender),
          gender,
          date_of_birth: dob,
          birth_weight_kg: breed.speciesName === "Cow" || breed.speciesName === "Buffalo" ? randFloat(28, 45) : randFloat(2, 4.5),
          lifecycle_stage: stage,
          lactation_status: lactationStatus,
          is_active: isActive,
          created_at: dob,
        },
      });

      animals.push({
        animal_id: created.animal_id,
        farm_id: created.farm_id,
        unit_id: created.unit_id,
        breed_id: created.breed_id,
        tag_number: created.tag_number,
        animal_name: created.animal_name,
        gender: created.gender,
        date_of_birth: created.date_of_birth,
        lifecycle_stage: created.lifecycle_stage!,
        speciesName: breed.speciesName,
        farmIdx,
      });
    }
  }

  console.log(`  foundation animals: ${animals.length}`);
  return { animals, nextTag, dairyBreeds, smallBreeds, unitByFarmAndType };
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Pre-existing lineage — a handful of mother→calf links that predate
//    the tracked breeding/pregnancy workflow (common for a farm that's
//    been operating for years before adopting this software).
// ─────────────────────────────────────────────────────────────────────────

async function seedFoundationLineage(
  animals: AnimalRow[],
  breeds: Breed[],
  nextTag: (farmIdx: number) => string,
) {
  // Minimum breeding age (~21 months) plus a small buffer, so the mother must
  // already be old enough now that a calf could plausibly have been born to
  // her in the past.
  const MIN_BREEDING_AGE_MONTHS = 21;
  const candidateMothers = animals.filter(
    (a) =>
      a.gender === "F" &&
      (a.lifecycle_stage === "Lactating" || a.lifecycle_stage === "Dry") &&
      a.speciesName !== "Goat" &&
      a.speciesName !== "Sheep" &&
      monthsDiff(a.date_of_birth, TODAY) >= MIN_BREEDING_AGE_MONTHS + 6,
  );
  const bulls = animals.filter((a) => a.gender === "M" && (a.lifecycle_stage === "Bull" || a.lifecycle_stage === "Breeding Bull"));

  const created: AnimalRow[] = [];
  const mothers = shuffle(candidateMothers).slice(0, 5);

  for (const mother of mothers) {
    const breed = breeds.find((b) => b.breed_id === mother.breed_id)!;
    const father = bulls.length > 0 && chance(60) ? pick(bulls) : null;
    const motherAgeNowMonths = monthsDiff(mother.date_of_birth, TODAY);
    const maxCalfAge = Math.min(60, motherAgeNowMonths - MIN_BREEDING_AGE_MONTHS);
    const ageMonthsAtBirth = randInt(Math.min(6, maxCalfAge), Math.max(6, maxCalfAge));
    const dob = monthsAgo(ageMonthsAtBirth);
    const gender = pick(["M", "F"] as const);

    const calf = await prisma.animals.create({
      data: {
        farm_id: mother.farm_id,
        unit_id: mother.unit_id,
        breed_id: mother.breed_id,
        tag_number: nextTag(mother.farmIdx),
        animal_name: makeName(gender),
        gender,
        date_of_birth: dob,
        mother_id: mother.animal_id,
        father_id: father?.animal_id ?? null,
        birth_weight_kg: randFloat(28, 42),
        lifecycle_stage: monthsDiff(dob, TODAY) < 10 ? "Calf" : "Heifer",
        is_active: true,
        created_at: dob,
      },
    });

    created.push({
      animal_id: calf.animal_id,
      farm_id: calf.farm_id,
      unit_id: calf.unit_id,
      breed_id: calf.breed_id,
      tag_number: calf.tag_number,
      animal_name: calf.animal_name,
      gender: calf.gender,
      date_of_birth: calf.date_of_birth,
      lifecycle_stage: calf.lifecycle_stage!,
      speciesName: breed.speciesName,
      farmIdx: mother.farmIdx,
    });
  }

  console.log(`  pre-existing lineage calves: ${created.length}`);
  return created;
}

function monthsDiff(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Growth logs
// ─────────────────────────────────────────────────────────────────────────

async function seedGrowthLogs(animals: AnimalRow[]) {
  const young = animals.filter((a) => monthsDiff(a.date_of_birth, TODAY) <= 24);
  let count = 0;
  const rows: Array<{ animal_id: number; weight_kg: number; recorded_date: Date; notes: string | null }> = [];

  for (const a of young) {
    const ageMonths = monthsDiff(a.date_of_birth, TODAY);
    const checkpoints = Math.min(6, Math.max(1, Math.floor(ageMonths / 2)));
    const isSmall = a.speciesName === "Goat" || a.speciesName === "Sheep";
    let weight = isSmall ? randFloat(2.5, 4) : randFloat(32, 42);
    for (let i = 0; i < checkpoints; i++) {
      const recordedDate = addDays(a.date_of_birth, Math.round(((i + 1) / (checkpoints + 1)) * ageMonths * 30));
      weight += isSmall ? randFloat(1.5, 3) : randFloat(15, 28);
      rows.push({ animal_id: a.animal_id, weight_kg: Number(weight.toFixed(2)), recorded_date: recordedDate, notes: null });
      count++;
    }
  }

  await prisma.growth_logs.createMany({ data: rows });
  console.log(`  growth logs: ${count}`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Health incidents
// ─────────────────────────────────────────────────────────────────────────

const DISEASES = ["Mastitis", "Foot Rot", "Bloat", "Milk Fever", "Retained Placenta", "Respiratory Infection", "Lameness", "Ketosis", "Diarrhea"];
const SEVERITIES = ["Mild", "Moderate", "Severe"];

async function seedHealthIncidents(animals: AnimalRow[]) {
  const pool = shuffle(animals.filter((a) => a.lifecycle_stage !== "Sold")).slice(0, 14);
  let count = 0;

  for (const a of pool) {
    const daysBack = randInt(3, 700);
    const incidentDate = daysAgo(daysBack);
    const isRecent = daysBack < 21;
    const status = isRecent ? pick(["Open", "In Progress", "Critical"]) : pick(["Resolved", "Resolved", "Resolved", "Recovering"]);

    await prisma.health_incidents.create({
      data: {
        animal_id: a.animal_id,
        incident_date: incidentDate,
        disease_name: pick(DISEASES),
        severity: pick(SEVERITIES),
        symptoms: "Reduced appetite, observed during routine check.",
        treatment: status === "Open" ? null : "Administered supportive treatment and antibiotics as prescribed by the veterinarian.",
        status,
        veterinarian_id: null,
      },
    });
    count++;
  }

  console.log(`  health incidents: ${count}`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Heat cycle records
// ─────────────────────────────────────────────────────────────────────────

const DETECTION_METHODS = ["Visual Observation", "Heat Detector", "Vasectomized Bull", "Progesterone Testing"];

async function seedHeatCycles(
  eligibleFemales: AnimalRow[],
  currentlyPregnantIds: Set<number>,
) {
  const pool = shuffle(eligibleFemales).slice(0, 20);
  let count = 0;

  for (const a of pool) {
    const cycles = randInt(2, 3);
    for (let i = 0; i < cycles; i++) {
      const isLatest = i === cycles - 1;
      const daysBack = isLatest ? randInt(2, 45) : randInt(60, 720);
      const start = daysAgo(daysBack);
      const leaveOpen = isLatest && !currentlyPregnantIds.has(a.animal_id) && chance(25) && daysBack < 5;
      const end = leaveOpen ? null : addDays(start, randInt(0, 1));

      await prisma.heat_cycle_records.create({
        data: {
          animal_id: a.animal_id,
          heat_start_date: start,
          heat_end_date: end,
          detection_method: pick(DETECTION_METHODS),
          confidence_score: randFloat(2.5, 5, 2),
          notes: null,
        },
      });
      count++;
    }
  }

  console.log(`  heat cycle records: ${count}`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 10. Reproductive simulation — breeding → pregnancy → (calving)
// ─────────────────────────────────────────────────────────────────────────

const SEMEN_BATCHES = ["SEM-HOL-1042", "SEM-JER-0871", "SEM-HOL-1108", "SEM-SAH-0512", "SEM-NR-0345"];
const BREEDING_METHODS = ["Natural Mating", "Artificial Insemination", "Embryo Transfer"] as const;
const CALVING_OUTCOMES_LIVE = ["Live Birth", "Live Birth", "Live Birth", "Complications"];

interface PregnancyPlan {
  mother: AnimalRow;
  father: AnimalRow | null;
  inseminationDaysAgo: number;
  outcome: "delivered" | "failed" | "pending" | "confirmed_ongoing";
  priorFailedAttempt: boolean;
}

async function administerReminders(where: { pregnancy_id?: number; breeding_id?: number }, opts: { basePct: number; baseDate: Date }) {
  const reminders = await prisma.vaccination_records.findMany({ where: { ...where, vaccination_date: null } });
  // The longer ago a reminder was scheduled, the more likely it has since been
  // resolved one way or another — keeps "overdue" concentrated on genuinely
  // recent items instead of years of accumulated unresolved history.
  const daysSinceBase = Math.max(0, Math.round((TODAY.getTime() - opts.baseDate.getTime()) / 86_400_000));
  const effectivePct = Math.min(97, opts.basePct + daysSinceBase / 6);
  for (const r of reminders) {
    if (chance(effectivePct)) {
      const due = r.next_due_date ?? opts.baseDate;
      const jittered = addDays(due, randInt(-2, 2));
      const administeredDate = jittered > TODAY ? TODAY : jittered;
      await vaccinationService.update(r.vaccination_id, {
        vaccination_date: toDateStr(administeredDate),
        administered_by: pick(VET_NAMES),
      });
    }
  }
}

async function runReproductiveSimulation(animals: AnimalRow[], breeds: Breed[]) {
  const eligibleFemales = animals.filter(
    (a) =>
      a.gender === "F" &&
      (a.lifecycle_stage === "Lactating" || a.lifecycle_stage === "Dry" || a.lifecycle_stage === "Heifer") &&
      (a.speciesName === "Cow" || a.speciesName === "Buffalo"),
  );
  const bulls = animals.filter((a) => a.gender === "M" && a.lifecycle_stage === "Breeding Bull");

  // Oldest animal first, so the plans that need to reach furthest back in
  // time (large inseminationDaysAgo) get paired with mothers old enough to
  // have actually been of breeding age back then.
  const pool = shuffle(eligibleFemales).sort((a, b) => a.date_of_birth.getTime() - b.date_of_birth.getTime());
  const gestationFor = (a: AnimalRow) => (a.speciesName === "Buffalo" ? 310 : 283);
  const MIN_BREEDING_AGE_MONTHS = 15;

  interface Slot {
    outcome: PregnancyPlan["outcome"];
    priorFailedAttempt: boolean;
    /** Days-since-calving for "delivered" slots; otherwise the insemination offset directly. */
    deliveredOffsetDays?: number;
    inseminationDaysAgo?: number;
  }

  const slots: Slot[] = [
    ...[900, 660, 520, 400, 300, 210, 120, 55, 25].map((off, i) => ({
      outcome: "delivered" as const,
      priorFailedAttempt: i < 3,
      deliveredOffsetDays: off,
    })),
    { outcome: "failed" as const, priorFailedAttempt: false, inseminationDaysAgo: 200 },
    { outcome: "failed" as const, priorFailedAttempt: false, inseminationDaysAgo: 120 },
    ...[12, 22, 33].map((d) => ({ outcome: "pending" as const, priorFailedAttempt: false, inseminationDaysAgo: d })),
    ...[273, 291, 60, 120, 180, 230].map((d) => ({ outcome: "confirmed_ongoing" as const, priorFailedAttempt: false, inseminationDaysAgo: d })),
  ];

  // Approximate the age requirement (using a generic 283-day gestation — the
  // ~27-day buffalo difference doesn't change ordering across these
  // month-scale buckets) and sort so the largest requirement is assigned first.
  const requiredDaysAgo = (s: Slot) => (s.deliveredOffsetDays !== undefined ? s.deliveredOffsetDays + 283 + 5 : s.inseminationDaysAgo!) + (s.priorFailedAttempt ? 21 : 0);
  const sortedSlots = [...slots].sort((a, b) => requiredDaysAgo(b) - requiredDaysAgo(a));

  const plans: PregnancyPlan[] = [];
  sortedSlots.forEach((slot, idx) => {
    const mother = pool[idx % pool.length];
    const inseminationDaysAgo =
      slot.deliveredOffsetDays !== undefined ? slot.deliveredOffsetDays + gestationFor(mother) + 5 : slot.inseminationDaysAgo!;
    plans.push({
      mother,
      father: chance(50) ? pick(bulls) : null,
      inseminationDaysAgo,
      outcome: slot.outcome,
      priorFailedAttempt: slot.priorFailedAttempt,
    });
  });

  // 2 cows get a second, older, already-delivered pregnancy (repeat freshening)
  // — reuse the two oldest mothers, who are guaranteed old enough.
  for (let i = 0; i < 2; i++) {
    const mother = pool[i];
    plans.push({ mother, father: null, inseminationDaysAgo: 1150 + i * 90, outcome: "delivered", priorFailedAttempt: false });
  }

  // Drop any slot whose assigned mother still isn't old enough (only possible
  // if the eligible pool is smaller than the slot count) rather than emit
  // biologically-impossible data.
  const validPlans = plans.filter((p) => monthsDiff(p.mother.date_of_birth, TODAY) >= MIN_BREEDING_AGE_MONTHS + p.inseminationDaysAgo / 30);
  if (validPlans.length < plans.length) {
    console.warn(`  (skipped ${plans.length - validPlans.length} reproductive plan(s): eligible pool too young/small)`);
  }
  plans.length = 0;
  plans.push(...validPlans);

  plans.sort((a, b) => b.inseminationDaysAgo - a.inseminationDaysAgo); // oldest first

  let breedingCount = 0;
  let pregnancyCount = 0;
  let calvingCount = 0;
  const offspring: AnimalRow[] = [];
  const currentlyPregnantIds = new Set<number>();
  const tagCounters: Record<number, number> = {};

  for (const plan of plans) {
    const inseminationDate = daysAgo(plan.inseminationDaysAgo);
    const method = plan.father ? "Natural Mating" : pick(BREEDING_METHODS.filter((m) => m !== "Natural Mating"));

    if (plan.priorFailedAttempt) {
      const earlierDate = addDays(inseminationDate, -21);
      const failedBreeding = await breedingService.create({
        female_animal_id: plan.mother.animal_id,
        male_animal_id: plan.father?.animal_id ?? null,
        breeding_date: toDateStr(earlierDate),
        method,
        result: "Failed",
        semen_batch_id: method === "Artificial Insemination" ? pick(SEMEN_BATCHES) : null,
        notes: "First attempt did not result in conception.",
      });
      breedingCount++;
      await administerReminders({ breeding_id: failedBreeding.breeding_id }, { basePct: 45, baseDate: earlierDate });
    }

    const result = plan.outcome === "failed" && !plan.priorFailedAttempt ? "Success" : "Success";
    const breeding = await breedingService.create({
      female_animal_id: plan.mother.animal_id,
      male_animal_id: plan.father?.animal_id ?? null,
      breeding_date: toDateStr(inseminationDate),
      method,
      result: plan.outcome === "pending" ? "Pending" : result,
      semen_batch_id: method === "Artificial Insemination" ? pick(SEMEN_BATCHES) : null,
      notes: null,
    });
    breedingCount++;
    await administerReminders({ breeding_id: breeding.breeding_id }, { basePct: plan.outcome === "pending" ? 12 : 45, baseDate: inseminationDate });

    if (plan.outcome === "pending") {
      await pregnancyService.create({
        animal_id: plan.mother.animal_id,
        breeding_id: breeding.breeding_id,
        insemination_date: toDateStr(inseminationDate),
        pregnancy_confirmed: false,
        status: "Pending",
      } as never);
      pregnancyCount++;
      continue;
    }

    const gestationDays = plan.mother.speciesName === "Buffalo" ? 310 : 283;
    const expectedDelivery = addDays(inseminationDate, gestationDays);
    const confirmationDate = addDays(inseminationDate, randInt(35, 45));

    if (plan.outcome === "failed") {
      await pregnancyService.create({
        animal_id: plan.mother.animal_id,
        breeding_id: breeding.breeding_id,
        insemination_date: toDateStr(inseminationDate),
        pregnancy_confirmed: true,
        confirmation_date: toDateStr(confirmationDate),
        expected_delivery_date: toDateStr(expectedDelivery),
        status: "Failed",
      } as never);
      pregnancyCount++;
      continue;
    }

    const pregnancy = await pregnancyService.create({
      animal_id: plan.mother.animal_id,
      breeding_id: breeding.breeding_id,
      insemination_date: toDateStr(inseminationDate),
      pregnancy_confirmed: true,
      confirmation_date: toDateStr(confirmationDate),
      expected_delivery_date: toDateStr(expectedDelivery),
      status: "Confirmed",
    } as never);
    pregnancyCount++;

    if (plan.outcome === "confirmed_ongoing") {
      currentlyPregnantIds.add(plan.mother.animal_id);
      // Dry-off reminder (edd-60) usually already handled; pre-calving (edd-30) left as live signal.
      const reminders = await prisma.vaccination_records.findMany({
        where: { pregnancy_id: pregnancy.pregnancy_id, vaccine_name: "Dry-Off Vaccination", vaccination_date: null },
      });
      for (const r of reminders) {
        if (r.next_due_date && r.next_due_date < TODAY && chance(80)) {
          const jittered = addDays(r.next_due_date, randInt(-1, 2));
          const administeredDate = jittered > TODAY ? TODAY : jittered;
          await vaccinationService.update(r.vaccination_id, {
            vaccination_date: toDateStr(administeredDate),
            administered_by: pick(VET_NAMES),
          });
        }
      }
      continue;
    }

    // Delivered: administer the pregnancy-workflow reminders, then record calving + offspring
    await administerReminders({ pregnancy_id: pregnancy.pregnancy_id }, { basePct: 55, baseDate: expectedDelivery });

    const actualDelivery = addDays(expectedDelivery, randInt(-4, 3));
    const outcome = chance(10) ? "Stillbirth" : chance(12) ? "Twins" : pick(CALVING_OUTCOMES_LIVE);
    const motherBreed = breeds.find((b) => b.breed_id === plan.mother.breed_id)!;

    let calfId: number | null = null;
    let calfGender: string | null = null;
    let calfTag: string | null = null;

    if (outcome !== "Stillbirth") {
      const gender = pick(["M", "F"] as const);
      tagCounters[plan.mother.farmIdx] = (tagCounters[plan.mother.farmIdx] ?? 0) + 1;
      const tag = `${FARM_DEFS[plan.mother.farmIdx].tagPrefix}-C${String(offspring.length + 1).padStart(3, "0")}`;
      const calf = await prisma.animals.create({
        data: {
          farm_id: plan.mother.farm_id,
          unit_id: plan.mother.unit_id,
          breed_id: plan.mother.breed_id,
          tag_number: tag,
          animal_name: makeName(gender),
          gender,
          date_of_birth: actualDelivery,
          mother_id: plan.mother.animal_id,
          father_id: plan.father?.animal_id ?? null,
          birth_weight_kg: randFloat(28, 42),
          lifecycle_stage: "Calf",
          is_active: true,
          created_at: actualDelivery,
        },
      });
      calfId = calf.animal_id;
      calfGender = calf.gender;
      calfTag = calf.tag_number;
      offspring.push({
        animal_id: calf.animal_id,
        farm_id: calf.farm_id,
        unit_id: calf.unit_id,
        breed_id: calf.breed_id,
        tag_number: calf.tag_number,
        animal_name: calf.animal_name,
        gender: calf.gender,
        date_of_birth: calf.date_of_birth,
        lifecycle_stage: calf.lifecycle_stage!,
        speciesName: motherBreed.speciesName,
        farmIdx: plan.mother.farmIdx,
      });

      if (outcome === "Twins") {
        const gender2 = pick(["M", "F"] as const);
        const tag2 = `${FARM_DEFS[plan.mother.farmIdx].tagPrefix}-C${String(offspring.length + 1).padStart(3, "0")}`;
        const twin = await prisma.animals.create({
          data: {
            farm_id: plan.mother.farm_id,
            unit_id: plan.mother.unit_id,
            breed_id: plan.mother.breed_id,
            tag_number: tag2,
            animal_name: makeName(gender2),
            gender: gender2,
            date_of_birth: actualDelivery,
            mother_id: plan.mother.animal_id,
            father_id: plan.father?.animal_id ?? null,
            birth_weight_kg: randFloat(24, 36),
            lifecycle_stage: "Calf",
            is_active: true,
            created_at: actualDelivery,
          },
        });
        offspring.push({
          animal_id: twin.animal_id,
          farm_id: twin.farm_id,
          unit_id: twin.unit_id,
          breed_id: twin.breed_id,
          tag_number: twin.tag_number,
          animal_name: twin.animal_name,
          gender: twin.gender,
          date_of_birth: twin.date_of_birth,
          lifecycle_stage: twin.lifecycle_stage!,
          speciesName: motherBreed.speciesName,
          farmIdx: plan.mother.farmIdx,
        });
      }
    }

    await calvingService.create({
      mother_id: plan.mother.animal_id,
      pregnancy_id: pregnancy.pregnancy_id,
      calving_date: toDateStr(actualDelivery),
      outcome,
      calf_gender: calfGender,
      calf_tag: calfTag,
      calf_id: calfId,
      notes: null,
    });
    calvingCount++;

    // The calving cascade updates pregnancy_status/lactation_status but not
    // lifecycle_stage — keep the mother's stage in sync (Dry → Lactating).
    if (plan.mother.lifecycle_stage !== "Lactating") {
      await prisma.animals.update({ where: { animal_id: plan.mother.animal_id }, data: { lifecycle_stage: "Lactating" } });
      plan.mother.lifecycle_stage = "Lactating";
    }
  }

  // Bump young, currently-pregnant heifers to the more specific lifecycle stage
  for (const id of currentlyPregnantIds) {
    const animal = animals.find((a) => a.animal_id === id);
    if (animal && monthsDiff(animal.date_of_birth, TODAY) < 30) {
      await prisma.animals.update({ where: { animal_id: id }, data: { lifecycle_stage: "Pregnant Heifer" } });
    }
  }

  console.log(`  breeding records: ${breedingCount}`);
  console.log(`  pregnancy records: ${pregnancyCount}`);
  console.log(`  calving records: ${calvingCount}`);
  console.log(`  offspring animals: ${offspring.length}`);

  return { breedingCount, pregnancyCount, calvingCount, offspring, currentlyPregnantIds, eligibleFemales };
}

// ─────────────────────────────────────────────────────────────────────────
// 11. Standalone breeding attempts (noise — not tied to any pregnancy)
// ─────────────────────────────────────────────────────────────────────────

async function seedStandaloneBreeding(eligibleFemales: AnimalRow[], bulls: AnimalRow[]) {
  const pool = shuffle(eligibleFemales).slice(0, 4);
  let count = 0;
  for (const mother of pool) {
    const daysBack = randInt(30, 500);
    const date = daysAgo(daysBack);
    const father = chance(50) ? pick(bulls) : null;
    const method = father ? "Natural Mating" : pick(["Artificial Insemination", "Embryo Transfer"] as const);
    const breeding = await breedingService.create({
      female_animal_id: mother.animal_id,
      male_animal_id: father?.animal_id ?? null,
      breeding_date: toDateStr(date),
      method,
      result: "Failed",
      semen_batch_id: method === "Artificial Insemination" ? pick(SEMEN_BATCHES) : null,
      notes: "No conception confirmed at follow-up check.",
    });
    count++;
    await administerReminders({ breeding_id: breeding.breeding_id }, { basePct: 40, baseDate: date });
  }
  console.log(`  standalone breeding attempts: ${count}`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 12. Manual routine vaccinations (independent of the auto workflows)
// ─────────────────────────────────────────────────────────────────────────

const ROUTINE_VACCINES = ["Foot and Mouth Disease (FMD)", "Hemorrhagic Septicemia (HS)", "Brucellosis", "Anthrax", "Black Quarter (BQ)", "Deworming"];

async function seedRoutineVaccinations(animals: AnimalRow[]) {
  const pool = shuffle(animals.filter((a) => a.lifecycle_stage !== "Sold")).slice(0, 40);
  let count = 0;

  for (const a of pool) {
    const shots = randInt(1, 2);
    for (let i = 0; i < shots; i++) {
      const daysBack = randInt(-30, 500); // allow a few upcoming (negative = future)
      const dueDate = daysAgo(daysBack);
      // Older due dates are far more likely to have since been administered —
      // keeps overdue records concentrated on recent, plausibly-still-open ones.
      const administered = daysBack > 14 && chance(Math.min(95, 40 + daysBack / 8));
      await vaccinationService.create({
        animal_id: a.animal_id,
        vaccine_name: pick(ROUTINE_VACCINES),
        vaccination_date: administered ? toDateStr(addDays(dueDate, randInt(-2, 2))) : null,
        next_due_date: toDateStr(administered ? addDays(dueDate, 365) : dueDate),
        administered_by: administered ? pick(VET_NAMES) : null,
        notes: null,
        source: null,
      } as never);
      count++;
    }
  }
  console.log(`  routine vaccination records: ${count}`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 13. Milk production
// ─────────────────────────────────────────────────────────────────────────

async function seedMilkProduction(animals: AnimalRow[], breeds: Breed[]) {
  const breedById = new Map(breeds.map((b) => [b.breed_id, b]));
  const lactating = animals.filter((a) => a.lifecycle_stage === "Lactating");

  const rows: Array<{ animal_id: number; production_date: Date; session: string; milk_liters: number; quality_grade: string | null }> = [];
  let count = 0;

  for (const a of lactating) {
    const breed = breedById.get(a.breed_id);
    const baseYield = Number(breed?.average_milk_production ?? 15);
    const lactationStartDaysAgo = Math.min(280, monthsDiff(a.date_of_birth, TODAY) > 30 ? randInt(10, 280) : randInt(5, 60));
    const historyDays = Math.min(120, lactationStartDaysAgo);
    const cowFactor = randFloat(0.85, 1.15, 2);

    for (let d = historyDays; d >= 0; d--) {
      const date = daysAgo(d);
      const dayOfLactation = lactationStartDaysAgo - d;
      const curve = dayOfLactation < 60 ? 0.75 + (dayOfLactation / 60) * 0.35 : Math.max(0.55, 1.1 - (dayOfLactation - 60) / 500);
      const dayTotal = baseYield * cowFactor * curve * randFloat(0.92, 1.08, 2);

      const sessions: Array<[string, number]> = [
        ["Morning", 0.4],
        ["Afternoon", 0.28],
        ["Evening", 0.32],
      ];
      for (const [session, share] of sessions) {
        const liters = Number((dayTotal * share * randFloat(0.9, 1.1, 2)).toFixed(2));
        if (liters <= 0) continue;
        const grade = pickWeighted<string | null>([
          ["A", 70],
          ["B", 18],
          ["C", 7],
          ["Rejected", 2],
          [null, 3],
        ]);
        rows.push({ animal_id: a.animal_id, production_date: date, session, milk_liters: liters, quality_grade: grade });
        count++;
      }
    }
  }

  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.milk_logs.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
  }

  console.log(`  milk logs: ${count} (${lactating.length} lactating animals)`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  await resetDatabase();

  console.log("Seeding…");
  const userCount = await seedUsers();
  const farms = await seedFarms();
  const units = await seedUnits(farms);
  const species = await seedSpecies();
  const breeds = await seedBreeds(species);

  const { animals: foundation, nextTag, dairyBreeds } = await seedFoundationAnimals(farms, units, breeds);
  const lineageCalves = await seedFoundationLineage(foundation, breeds, nextTag);
  const allAnimalsSoFar = [...foundation, ...lineageCalves];

  const growthCount = await seedGrowthLogs(allAnimalsSoFar);
  const healthCount = await seedHealthIncidents(allAnimalsSoFar);

  const { breedingCount, pregnancyCount, calvingCount, offspring, currentlyPregnantIds, eligibleFemales } =
    await runReproductiveSimulation(allAnimalsSoFar, breeds);

  const bulls = allAnimalsSoFar.filter((a) => a.gender === "M" && a.lifecycle_stage === "Breeding Bull");
  const standaloneBreedingCount = await seedStandaloneBreeding(
    eligibleFemales.filter((f) => !currentlyPregnantIds.has(f.animal_id)),
    bulls,
  );

  const heatCycleCount = await seedHeatCycles(eligibleFemales, currentlyPregnantIds);

  const allAnimals = [...allAnimalsSoFar, ...offspring];
  const vaccinationRoutineCount = await seedRoutineVaccinations(allAnimals);
  const milkCount = await seedMilkProduction(allAnimals, breeds);

  console.log("\n── E2E lifecycle test animal (deterministic) ──");
  const e2eLifecycleReport = await seedE2eLifecycleAnimal();

  const totalAnimals = allAnimals.length + 1 + e2eLifecycleReport.counts.offspring;
  const totalVaccinations = await prisma.vaccination_records.count();
  const totalBreeding = breedingCount + standaloneBreedingCount;

  console.log("\n─────────────────────────────────────────");
  console.log("Seed complete. Record counts:");
  console.log(`  users:               ${userCount}`);
  console.log(`  farms:               ${farms.length}`);
  console.log(`  units:               ${units.length}`);
  console.log(`  species:             ${species.length}`);
  console.log(`  breeds:              ${breeds.length}`);
  console.log(`  animals (total):     ${totalAnimals}  (${offspring.length} offspring incl. via calving)`);
  console.log(`  growth logs:         ${growthCount}`);
  console.log(`  health incidents:    ${healthCount}`);
  console.log(`  heat cycle records:  ${heatCycleCount}`);
  console.log(`  breeding records:    ${totalBreeding}`);
  console.log(`  pregnancy records:   ${pregnancyCount}`);
  console.log(`  calving records:     ${calvingCount}`);
  console.log(`  vaccination records: ${totalVaccinations}  (routine: ${vaccinationRoutineCount}, remainder auto-generated)`);
  console.log(`  milk logs:           ${milkCount}`);
  console.log(`  E2E lifecycle tag:   ${e2eLifecycleReport.tag} (death ${e2eLifecycleReport.deathDate})`);
  console.log("─────────────────────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
