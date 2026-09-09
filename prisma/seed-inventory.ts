/**
 * Seed demo inventory items + sample stock movements (insert-only by item_name).
 * Run: npm run db:seed:inventory
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

const TODAY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function daysAgo(days: number) {
  return addDays(TODAY, -days);
}

const DEMO_ITEMS = [
  {
    item_name: "Dairy Concentrate Feed",
    category: "Feed",
    quantity: 850,
    unit: "kg",
    reorder_level: 200,
    unit_cost: 95,
    supplier: "AgriFeed Supplies",
    expiry_date: addDays(TODAY, 120),
  },
  {
    item_name: "Silage Additive",
    category: "Feed",
    quantity: 45,
    unit: "L",
    reorder_level: 50,
    unit_cost: 420,
    supplier: "AgriFeed Supplies",
    expiry_date: addDays(TODAY, 90),
  },
  {
    item_name: "Alfalfa Hay Bales",
    category: "Feed",
    quantity: 120,
    unit: "bales",
    reorder_level: 40,
    unit_cost: 650,
    supplier: "GreenPasture Co.",
    expiry_date: addDays(TODAY, 200),
  },
  {
    item_name: "Oxytetracycline Injection",
    category: "Medicines",
    quantity: 12,
    unit: "doses",
    reorder_level: 15,
    unit_cost: 850,
    supplier: "VetCare Pharma",
    expiry_date: addDays(TODAY, 180),
  },
  {
    item_name: "Ivermectin Dewormer",
    category: "Medicines",
    quantity: 4,
    unit: "bottles",
    reorder_level: 6,
    unit_cost: 2200,
    supplier: "VetCare Pharma",
    expiry_date: addDays(TODAY, 22),
  },
  {
    item_name: "FMD Vaccine (Bulk)",
    category: "Vaccines",
    quantity: 0,
    unit: "doses",
    reorder_level: 20,
    unit_cost: 120,
    supplier: "National Vet Labs",
    expiry_date: addDays(TODAY, 60),
  },
  {
    item_name: "Brucellosis Vaccine",
    category: "Vaccines",
    quantity: 8,
    unit: "doses",
    reorder_level: 15,
    unit_cost: 180,
    supplier: "National Vet Labs",
    expiry_date: addDays(TODAY, -12),
  },
  {
    item_name: "Disposable Syringes 10ml",
    category: "Supplies",
    quantity: 240,
    unit: "pcs",
    reorder_level: 100,
    unit_cost: 25,
    supplier: "Farm Supplies Co.",
    expiry_date: null,
  },
  {
    item_name: "Milking Cluster Liners",
    category: "Equipment",
    quantity: 8,
    unit: "sets",
    reorder_level: 4,
    unit_cost: 4500,
    supplier: "DairyTech Equipment",
    expiry_date: null,
  },
  {
    item_name: "Calcium Bolus",
    category: "Medicines",
    quantity: 6,
    unit: "pcs",
    reorder_level: 10,
    unit_cost: 350,
    supplier: "VetCare Pharma",
    expiry_date: addDays(TODAY, -5),
  },
  {
    item_name: "Mineral Lick Blocks",
    category: "Feed",
    quantity: 18,
    unit: "blocks",
    reorder_level: 12,
    unit_cost: 780,
    supplier: "AgriFeed Supplies",
    expiry_date: addDays(TODAY, 14),
  },
  {
    item_name: "Teat Dip Solution",
    category: "Supplies",
    quantity: 22,
    unit: "L",
    reorder_level: 10,
    unit_cost: 650,
    supplier: "Farm Supplies Co.",
    expiry_date: addDays(TODAY, 45),
  },
  {
    item_name: "Hoof Trimming Kit",
    category: "Equipment",
    quantity: 2,
    unit: "kits",
    reorder_level: 1,
    unit_cost: 12500,
    supplier: "DairyTech Equipment",
    expiry_date: null,
  },
  {
    item_name: "Calf Milk Replacer",
    category: "Feed",
    quantity: 0,
    unit: "kg",
    reorder_level: 25,
    unit_cost: 1100,
    supplier: "GreenPasture Co.",
    expiry_date: addDays(TODAY, 75),
  },
  {
    item_name: "Udder Wipes",
    category: "Supplies",
    quantity: 15,
    unit: "packs",
    reorder_level: 20,
    unit_cost: 420,
    supplier: "Farm Supplies Co.",
    expiry_date: addDays(TODAY, 8),
  },
];

/** Sample movements applied after items exist (matched by item_name). */
const DEMO_MOVEMENTS: Array<{
  item_name: string;
  transaction_type: "Stock In" | "Stock Out";
  quantity: number;
  daysAgo: number;
  notes: string;
}> = [
  {
    item_name: "Dairy Concentrate Feed",
    transaction_type: "Stock In",
    quantity: 500,
    daysAgo: 7,
    notes: "Weekly feed delivery",
  },
  {
    item_name: "Dairy Concentrate Feed",
    transaction_type: "Stock Out",
    quantity: 120,
    daysAgo: 3,
    notes: "Morning feeding round — lactating herd",
  },
  {
    item_name: "Silage Additive",
    transaction_type: "Stock Out",
    quantity: 8,
    daysAgo: 2,
    notes: "Silage pit treatment",
  },
  {
    item_name: "Oxytetracycline Injection",
    transaction_type: "Stock Out",
    quantity: 2,
    daysAgo: 1,
    notes: "Mastitis treatment — Tag #1042",
  },
  {
    item_name: "Teat Dip Solution",
    transaction_type: "Stock In",
    quantity: 10,
    daysAgo: 5,
    notes: "Restock from Farm Supplies Co.",
  },
  {
    item_name: "Disposable Syringes 10ml",
    transaction_type: "Stock Out",
    quantity: 30,
    daysAgo: 4,
    notes: "Vaccination session",
  },
  {
    item_name: "Mineral Lick Blocks",
    transaction_type: "Stock Out",
    quantity: 4,
    daysAgo: 6,
    notes: "Paddock mineral supplement",
  },
];

async function main() {
  const farm = await prisma.farms.findFirst({ where: { is_active: true } });
  if (!farm) {
    console.log("No active farm found — skipping inventory seed.");
    return;
  }

  let created = 0;
  const itemByName = new Map<string, number>();

  for (const item of DEMO_ITEMS) {
    const existing = await prisma.inventory_items.findFirst({
      where: { item_name: item.item_name, farm_id: farm.farm_id },
    });

    if (existing) {
      itemByName.set(item.item_name, existing.item_id);
      continue;
    }

    const row = await prisma.inventory_items.create({
      data: {
        farm_id: farm.farm_id,
        item_name: item.item_name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        reorder_level: item.reorder_level,
        unit_cost: item.unit_cost,
        supplier: item.supplier,
        expiry_date: item.expiry_date,
        is_active: true,
      },
    });
    itemByName.set(item.item_name, row.item_id);
    created++;
  }

  let movements = 0;
  for (const m of DEMO_MOVEMENTS) {
    const itemId = itemByName.get(m.item_name);
    if (!itemId) continue;

    const dup = await prisma.inventory_transactions.findFirst({
      where: {
        item_id: itemId,
        transaction_type: m.transaction_type,
        notes: m.notes,
      },
    });
    if (dup) continue;

    await prisma.inventory_transactions.create({
      data: {
        item_id: itemId,
        transaction_type: m.transaction_type,
        quantity: m.quantity,
        transaction_date: daysAgo(m.daysAgo),
        notes: m.notes,
      },
    });
    movements++;
  }

  console.log(
    `Inventory seed complete: ${created} item(s) created, ${movements} movement(s) added for ${farm.farm_name}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
