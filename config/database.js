/**
 * Database Abstraction & Configuration Layer for Auxosys Backend
 * 
 * Supports flexible database connectivity across:
 * - Supabase (default active driver)
 * - Native PostgreSQL / AWS RDS PostgreSQL (via pg connection pool)
 * 
 * Configurable via environment variables:
 * - DB_DRIVER: 'supabase' (default) | 'postgres' | 'rds'
 * - DATABASE_URL: full postgres connection URI (optional)
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL
 */

require("dotenv").config();
const { Pool } = require("pg");
const supabase = require("./supabaseClient");

const DB_DRIVER = (process.env.DB_DRIVER || "supabase").toLowerCase();

let pgPool = null;

function getPgPool() {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    const isSslEnabled = process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";

    if (connectionString) {
      pgPool = new Pool({
        connectionString,
        ssl: isSslEnabled ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.DB_POOL_MAX || "20", 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || "5000", 10),
      });
    } else {
      pgPool = new Pool({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "auxosys_db",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        ssl: isSslEnabled ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.DB_POOL_MAX || "20", 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || "5000", 10),
      });
    }

    pgPool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return pgPool;
}

/**
 * Execute direct PostgreSQL SQL queries
 * @param {string} text 
 * @param {Array} params 
 */
async function query(text, params) {
  const pool = getPgPool();
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === "development") {
    console.log("executed query", { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

const { checkPrismaHealth } = require("./prismaClient");

/**
 * Universal Database Health Check Utility
 * Verifies live connection to Supabase, PostgreSQL, or Prisma AWS RDS.
 */
async function checkDatabaseHealth() {
  const driver = DB_DRIVER;
  try {
    if (driver === "prisma") {
      return await checkPrismaHealth();
    } else if (driver === "postgres" || driver === "rds") {
      const pool = getPgPool();
      const res = await pool.query("SELECT 1 AS alive, current_database() AS db_name, version() AS version;");
      return {
        status: "healthy",
        driver: "postgres",
        database: res.rows[0].db_name,
        postgresVersion: res.rows[0].version,
        timestamp: new Date().toISOString()
      };
    } else {
      // Supabase mode (default)
      const { data, error } = await supabase.from("access_control").select("id").limit(1);
      return {
        status: "healthy",
        driver: "supabase",
        supabaseUrl: process.env.SUPABASE_URL ? "configured" : "missing",
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      driver,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Graceful pool shutdown
 */
async function closePool() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

module.exports = {
  dbDriver: DB_DRIVER,
  supabase,
  getPgPool,
  query,
  checkDatabaseHealth,
  closePool
};
