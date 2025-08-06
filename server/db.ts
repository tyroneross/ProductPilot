import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL, {
  fetchOptions: {
    // Allow self-signed certs for development
    rejectUnauthorized: false,
  },
});

export const db = drizzle(sql, { schema });