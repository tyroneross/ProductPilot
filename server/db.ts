import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// Build database URL from Replit PostgreSQL environment variables
function getDatabaseUrl(): string {
  // If individual PG* vars are available, construct the URL from them
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    const port = process.env.PGPORT || "5432";
    // No SSL for Replit's local PostgreSQL
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }
  
  // Fallback to DATABASE_URL if set and valid
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  throw new Error("Database connection not configured. Please ensure PostgreSQL is provisioned.");
}

const databaseUrl = getDatabaseUrl();

const sql = neon(databaseUrl, {
  fetchOptions: {
    // Allow self-signed certs for development
    rejectUnauthorized: false,
  },
});

export const db = drizzle(sql, { schema });