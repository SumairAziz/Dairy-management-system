import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

/** Models added in recent migrations — used to detect a stale cached client. */
function clientHasCurrentSchema(client: PrismaClient): boolean {
  return "lactation_periods" in client;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && clientHasCurrentSchema(cached)) {
    return cached;
  }
  if (cached) {
    void cached.$disconnect().catch(() => {});
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
