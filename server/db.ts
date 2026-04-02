import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Build database URL from environment variables
function getDatabaseUrl(): string {
  // If individual PG* vars are available, construct the URL from them
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    const port = process.env.PGPORT || "5432";
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }
  
  // Fallback to DATABASE_URL if set and valid
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  return null;
}

const dbUrl = getDatabaseUrl();

// Append sslmode=require if not already present (Neon requires SSL)
const connString = dbUrl && !dbUrl.includes('sslmode=')
  ? dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require'
  : dbUrl;

const pool = connString
  ? new Pool({
      connectionString: connString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;
