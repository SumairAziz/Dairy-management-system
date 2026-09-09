import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const EMAIL = "123misaliravian@gmail.com";
const PASSWORD = "_uYx.*DA6qZ!#dk";

async function main() {
  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.users.upsert({
    where: { email: EMAIL },
    update: { password_hash, role: "ADMIN", name: "Sumair", is_active: true },
    create: {
      email: EMAIL,
      name: "Sumair",
      role: "ADMIN",
      password_hash,
      is_active: true,
    },
  });
  console.log(`Admin upserted: ${user.email} (role: ${user.role})`);
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
