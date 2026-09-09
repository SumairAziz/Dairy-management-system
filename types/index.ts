// ─── Base API Types ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiValidationErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    details: Array<{ field: string; message: string }>;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse
  | ApiValidationErrorResponse;

// ─── Entity Types ─────────────────────────────────────────────────────────────

export interface Farm {
  farm_id: number;
  farm_name: string;
  owner_name: string | null;
  contact_number: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  total_area_acres: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  units?: Unit[];
  _count?: { animals: number; units: number };
}

export interface FarmDetail {
  farm: Farm & { units?: Unit[] };
  stats: {
    animalCount: number;
    unitCount: number;
    dailyMilk: number;
    health: Array<{ status: string | null; _count: number }>;
    species: Array<{ label: string; value: number }>;
  };
}

export interface UnitDetail {
  unit: Unit & { farms?: Farm };
  animals: Animal[];
  stats: {
    occupancy: number;
    maxCapacity: number;
    dailyMilk: number;
    lifecycle: Array<{ lifecycle_stage: string | null; _count: number }>;
  };
}

export interface Unit {
  unit_id: number;
  farm_id: number;
  unit_name: string;
  unit_type: string;
  capacity: number | null;
  description: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  farms?: Farm;
  animals?: Animal[];
  _count?: { animals: number };
}

export interface Breed {
  breed_id: number;
  species_id: number;
  breed_name: string;
  origin_country: string | null;
  average_milk_production: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  species?: Species;
}

export interface Species {
  species_id: number;
  species_name: string;
  scientific_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  breeds?: Breed[];
}

export interface Animal {
  animal_id: number;
  farm_id: number;
  unit_id: number | null;
  breed_id: number;
  tag_number: string;
  animal_name: string | null;
  gender: "M" | "F";
  date_of_birth: string;
  mother_id: number | null;
  father_id: number | null;
  birth_weight_kg: number | null;
  lifecycle_stage: string;
  is_active: boolean;
  /** "PREGNANT" | "CALVED" | "FAILED" | null — set by pregnancy/calving workflow */
  pregnancy_status: string | null;
  /** "LACTATING" | "DRY" | null — set by calving workflow */
  lactation_status: string | null;
  /** Derived production state — lactating | dry | never_lactated | not_applicable */
  production_status?: string;
  created_at: string;
  updated_at: string;
  farms?: Farm;
  units?: Unit;
  breeds?: Breed & { species?: Species };
  animals_animals_mother_idToanimals?: Animal | null;
  animals_animals_father_idToanimals?: Animal | null;
  other_animals_animals_mother_idToanimals?: Pick<
    Animal,
    "animal_id" | "tag_number"
  >[];
  other_animals_animals_father_idToanimals?: Pick<
    Animal,
    "animal_id" | "tag_number"
  >[];
  growth_logs?: GrowthLog[];
  health_incidents?: HealthIncident[];
  milk_logs?: MilkLog[];
  /** Today's total milk (all sessions), from unit detail API. */
  daily_milk_liters?: number | null;
  vaccination_records?: VaccinationRecord[];
  breeding_records_breeding_records_female_animal_idToanimals?: BreedingRecord[];
  breeding_records_breeding_records_male_animal_idToanimals?: BreedingRecord[];
  pregnancy_records?: PregnancyRecord[];
  heat_cycle_records?: HeatCycleRecord[];
}

export interface MilkLog {
  milk_log_id: number;
  animal_id: number;
  production_date: string;
  session: "Morning" | "Afternoon" | "Evening";
  milk_liters: number;
  quality_grade: string | null;
  notes: string | null;
  created_at: string;
  animals?: Animal;
}

/** One row = one animal's full day (Morning/Afternoon/Evening grouped) — the milk register view. */
export interface DailyMilkRecord {
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
}

export interface HealthIncident {
  incident_id: number;
  animal_id: number | null;
  incident_date: string | null;
  disease_name: string | null;
  severity: string | null;
  symptoms: string | null;
  treatment: string | null;
  status: string | null;
  veterinarian_id: number | null;
  animals?: Animal;
  treatment_records?: TreatmentRecord[];
}

export interface GrowthLog {
  growth_log_id: number;
  animal_id: number;
  weight_kg: number;
  recorded_date: string;
  notes: string | null;
  created_at: string;
  animals?: Animal;
}

export interface VaccinationRecord {
  vaccination_id: number;
  animal_id: number | null;
  vaccine_name: string | null;
  vaccination_date: string | null;
  next_due_date: string | null;
  administered_by: string | null;
  notes: string | null;
  /** "pregnancy_workflow" for auto-generated records, "group_batch" for batch treatments, null for manual */
  source: string | null;
  /** Linked pregnancy record id for auto-generated reminders */
  pregnancy_id: number | null;
  batch_id?: number | null;
  inventory_item_id?: number | null;
  dosage?: number | null;
  animals?: Animal;
}

export interface TreatmentRecord {
  treatment_id: number;
  incident_id: number | null;
  medicine_id: number | null;
  dosage: string | null;
  treatment_date: string | null;
  remarks: string | null;
  batch_id?: number | null;
  inventory_item_id?: number | null;
  medicine_name?: string | null;
}

export interface BreedingRecord {
  breeding_id: number;
  female_animal_id: number | null;
  male_animal_id: number | null;
  breeding_date: string | null;
  method: string | null;
  result: string | null;
  semen_batch_id: string | null;
  notes: string | null;
  animals_breeding_records_female_animal_idToanimals?: Animal | null;
  animals_breeding_records_male_animal_idToanimals?: Animal | null;
}

export interface PregnancyRecord {
  pregnancy_id: number;
  animal_id: number;
  insemination_date: string;
  pregnancy_confirmed: boolean | null;
  confirmation_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  status: string | null;
  created_at: string;
  animals?: Animal;
}

export interface CalvingRecord {
  calving_id: number;
  mother_id: number;
  pregnancy_id: number | null;
  calving_date: string;
  outcome: string | null;
  calf_gender: string | null;
  calf_tag: string | null;
  calf_id: number | null;
  notes: string | null;
  created_at: string;
  mother?: Pick<Animal, "animal_id" | "tag_number" | "animal_name">;
  calf?: Pick<Animal, "animal_id" | "tag_number" | "animal_name"> | null;
  pregnancy_records?: Pick<PregnancyRecord, "pregnancy_id" | "insemination_date" | "expected_delivery_date"> | null;
}

export interface HeatCycleRecord {
  heat_cycle_id: number;
  animal_id: number | null;
  heat_start_date: string | null;
  heat_end_date: string | null;
  detection_method: string | null;
  confidence_score: number | null;
  notes: string | null;
  created_at: string;
  animals?: Animal;
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totals: {
    animalCount: number;
    speciesCount: number;
    breedCount: number;
    farmCount: number;
    unitCount: number;
    dailyMilk: number;
    pregnantCount: number;
  };
  health: Array<{ status: string; _count: number }>;
  vaccination: Array<{ vaccine_name: string; _count: number }>;
  recent: Animal[];
  milkByFarm: Array<{ farm_id: number; farm_name: string; liters: number }>;
  speciesDist: Array<{ id: number; label: string; value: number }>;
  milkTrend: Array<{ label: string; value: number; date: string; date_from?: string; date_to?: string }>;
  milkTrendMeta?: {
    period: string;
    periodLabel: string;
    granularity: "day" | "week" | "month" | "year";
    totalLiters: number;
  };
  breedingStats: Array<{ label: string; value: number }>;
  heatCycleByMethod: Array<{ label: string; value: number }>;
  pregnancyByStatus: Array<{ label: string; value: number }>;
  lifecycleDist: Array<{ label: string; value: number }>;
  upcomingVaccinations: number;
  overdueVaccinations: number;
  vaccinationDueSoon: number;
  animalsInHeat: number;
  upcomingDeliveries: number;
  pregnanciesDueSoon: number;
  farmCapacity: Array<{ id: number; label: string; value: number; max: number }>;
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    expired: number;
    attentionCount: number;
  };
}

export interface MilkStats {
  todayProduction: number;
  animalsMilkedToday: number;
  lactatingAnimals?: number;
  avgYieldPerAnimal: number;
  monthlyProduction: number;
  sessions: { Morning: number; Afternoon: number; Evening: number };
  topProducerLabel: string;
  topProducerId: number | null;
}

export interface AnimalStats {
  total: { count: number; female: number; male: number };
  active: { count: number; inactiveCount: number };
  lactating: { count: number; percentOfHerd: number };
  pregnant: { count: number; dueWithin30Days: number };
  inHeat: { count: number };
  calves: { count: number; male: number; female: number };
  stageDistribution: Array<{ label: string; value: number }>;
  breedDistribution: Array<{ id: number | null; label: string; value: number }>;
  farmDistribution: Array<{ id: number | null; label: string; value: number }>;
  vaccinationDue: { count: number };
  breedingEligible: { count: number };
  dry: { count: number };
  neverLactated: { count: number };
  healthIssues: { count: number };
}

// ─── Auth & User Types ────────────────────────────────────────────────────────

export type Role =
  | "ADMIN"
  | "FARM_MANAGER"
  | "VETERINARIAN"
  | "INVENTORY_MANAGER"
  | "FARM_WORKER"
  | "VIEWER";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type ExpiryStatus = "expired" | "expiring_soon" | "ok" | "none";

export interface InventoryItem {
  item_id: number;
  farm_id: number | null;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number | null;
  unit_cost: number | null;
  supplier: string | null;
  expiry_date: string | null;
  notes: string | null;
  is_active: boolean;
  stock_status: StockStatus;
  expiry_status: ExpiryStatus;
  total_value: number;
  batch?: string | null;
  primary_lot?: InventoryLotSummary | null;
  created_at?: string;
  updated_at?: string;
  farms?: { farm_id: number; farm_name: string } | null;
}

export interface InventoryLotSummary {
  lot_id: number;
  lot_number: string | null;
  remaining_quantity: number;
  expiry_date: string | null;
  supplier: string | null;
}

export interface InventoryLot extends InventoryLotSummary {
  quantity: number;
  unit_cost: number | null;
  manufacturing_date: string | null;
  received_date: string;
  notes: string | null;
}

export interface InventoryTransaction {
  transaction_id: number;
  item_id: number;
  lot_id?: number | null;
  transaction_type: string;
  quantity: number;
  transaction_date: string;
  reference?: string | null;
  notes: string | null;
  created_at?: string;
  lot?: { lot_id: number; lot_number: string | null } | null;
  user?: { user_id: number; name: string } | null;
  item?: {
    item_id: number;
    item_name: string;
    unit: string;
    category?: string;
  } | null;
}

export interface InventoryItemDetail extends InventoryItem {
  inventory_lots?: InventoryLot[];
  inventory_transactions: InventoryTransaction[];
}

export interface InventorySupplierSummary {
  supplier: string;
  itemCount: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  items: Array<{ item_id: number; item_name: string; quantity: number; unit: string }>;
  lastPurchase: string | null;
  purchaseHistory: Array<{
    transaction_date: string;
    item_name: string;
    quantity: number;
  }>;
}

export interface InventoryConsumptionAnalytics {
  consumptionOverTime: Array<{ date: string; quantity: number }>;
  quantityByCategory: Array<{ label: string; quantity: number }>;
  mostUsedMedicines: Array<{
    item_name: string;
    quantity: number;
    unit: string;
    estimated_cost: number;
  }>;
}

export interface InventoryStats {
  totalItems: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  attentionCount: number;
  expired: number;
  expiringSoon: number;
  inventoryCostThisMonth: number;
  categoryDistribution: Array<{ label: string; value: number }>;
  categoryValueDistribution: Array<{ label: string; value: number }>;
  stockStatusBreakdown: Array<{ label: string; value: number; key: StockStatus }>;
  attentionItems: Array<{
    item_id: number;
    item_name: string;
    reason: string;
    stock_status: StockStatus;
    expiry_status: ExpiryStatus;
    quantity: number;
    unit: string;
    reorder_level: number | null;
  }>;
  recentMovements: InventoryTransaction[];
  consumptionAnalytics: InventoryConsumptionAnalytics;
}

// ─── Audit & Notification Types ───────────────────────────────────────────────

export interface AuditLog {
  id: number;
  user_id: number;
  entity: string;
  entity_id: number;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}
