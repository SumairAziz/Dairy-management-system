/**
 * Idempotent RBAC development users.
 * Run: npm run db:seed:rbac
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ensureMessagesPermissionsForAllRoles, seedDefaultRolePermissions } from "@/services/role-permission.service";

const DEV_USERS = [
  {
    name: "TerraDairy Admin",
    email: "admin@terradairy.local",
    password: "TD_Admin_2026!",
    role: "ADMIN",
  },
  {
    name: "Farm Manager",
    email: "manager@terradairy.local",
    password: "TD_Manager_2026!",
    role: "FARM_MANAGER",
  },
  {
    name: "Farm Veterinarian",
    email: "vet@terradairy.local",
    password: "TD_Vet_2026!",
    role: "VETERINARIAN",
  },
  {
    name: "Inventory Manager",
    email: "inventory@terradairy.local",
    password: "TD_Inventory_2026!",
    role: "INVENTORY_MANAGER",
  },
  {
    name: "Farm Worker",
    email: "worker@terradairy.local",
    password: "TD_Worker_2026!",
    role: "FARM_WORKER",
  },
] as const;

export async function seedRbacUsers() {
  console.log("\n=== Seeding RBAC development users (idempotent) ===\n");

  await ensureMessagesPermissionsForAllRoles();
  await seedDefaultRolePermissions();
  console.log("✓ Role permissions synced");

  for (const entry of DEV_USERS) {
    const password_hash = await bcrypt.hash(entry.password, 10);
    const user = await prisma.users.upsert({
      where: { email: entry.email },
      update: {
        name: entry.name,
        role: entry.role,
        password_hash,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        name: entry.name,
        email: entry.email,
        role: entry.role,
        password_hash,
        is_active: true,
      },
    });
    console.log(`✓ ${entry.role.padEnd(18)} ${user.email}`);
  }

  console.log("\nDevelopment credentials (local/dev only):");
  for (const entry of DEV_USERS) {
    console.log(`  ${entry.role}: ${entry.email} / ${entry.password}`);
  }
  console.log("");
}

seedRbacUsers()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
