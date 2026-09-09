/**
 * Idempotent seed for role_permissions table.
 * Run: npm run db:seed:permissions
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import {
  ensureMessagesPermissionsForAllRoles,
  seedDefaultRolePermissions,
} from "@/services/role-permission.service";
import { invalidatePermissionCache } from "@/lib/rbac/permission-resolver";

async function main() {
  console.log("\n=== Syncing role permissions (idempotent) ===\n");

  const messages = await ensureMessagesPermissionsForAllRoles();
  if (messages.added > 0) {
    console.log(`✓ Added ${messages.added} messages permission row(s) across roles\n`);
  } else {
    console.log("✓ Messages permissions already present for all roles\n");
  }

  const result = await seedDefaultRolePermissions();
  console.log(`✓ Sync complete (${result.added} new permission row(s) total)\n`);
  console.log("Note: users must log out and back in for permission changes to apply.\n");

  invalidatePermissionCache();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
