/**
 * Prisma Client Configuration Layer for Auxosys Backend
 * 
 * FUTURE PRISMA / AWS RDS INTEGRATION: Currently inactive.
 * Enable only when migrating the Auxosys database to PostgreSQL / AWS RDS.
 * 
 * Configuration via environment variables:
 * - ENABLE_PRISMA: "true" | "false" (default: false)
 * - DB_DRIVER: "prisma" | "supabase" (default: supabase)
 * - DATABASE_URL: full AWS RDS or PostgreSQL connection string
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const isPrismaEnabled =
  (process.env.ENABLE_PRISMA === "true" || process.env.DB_DRIVER === "prisma") &&
  Boolean(process.env.DATABASE_URL);

let prisma = null;

if (isPrismaEnabled) {
  console.log("⚡ Prisma Client activated for PostgreSQL / AWS RDS.");
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
} else {
  // Lazy proxy when Prisma is inactive
  prisma = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "isPrismaActive") return false;
        if (prop === "$connect" || prop === "$disconnect") return async () => {};
        throw new Error(
          `Prisma is currently INACTIVE. Enable it by setting ENABLE_PRISMA=true and providing DATABASE_URL in your .env file.`
        );
      },
    }
  );
}

/**
 * Health probe for Prisma PostgreSQL connection
 */
async function checkPrismaHealth() {
  if (!isPrismaEnabled) {
    return {
      status: "inactive",
      driver: "prisma",
      message: "Prisma integration is disabled (ENABLE_PRISMA=false). Current default driver is Supabase.",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const result = await prisma.$queryRaw`SELECT 1 AS alive, current_database() AS db_name, version() AS version;`;
    return {
      status: "healthy",
      driver: "prisma",
      database: result[0]?.db_name,
      postgresVersion: result[0]?.version,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      driver: "prisma",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = {
  prisma,
  isPrismaEnabled,
  checkPrismaHealth,
};
