import { Pool } from "pg";

// Build database URL from Replit PostgreSQL environment variables
function getDatabaseUrl(): string {
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    const port = process.env.PGPORT || "5432";
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }
  
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  throw new Error("Database connection not configured. Please ensure PostgreSQL is provisioned.");
}

export async function runMigrations() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  
  try {
    console.log("Running database migrations...");
    
    // Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "ai_model" text DEFAULT 'claude-sonnet' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Create stages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "stages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL,
        "stage_number" integer NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "progress" integer DEFAULT 0 NOT NULL,
        "is_unlocked" boolean DEFAULT true NOT NULL,
        "system_prompt" text NOT NULL,
        "ai_model" text,
        "outputs" jsonb,
        "key_insights" jsonb,
        "completed_insights" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "stage_id" varchar NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Create users table for auth
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text,
        "first_name" text,
        "last_name" text,
        "profile_image_url" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Create sessions table for connect-pg-simple
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);
    
    // Create index on sessions expire
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire")
    `);
    
    // Create admin_prompts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "admin_prompts" (
        "id" serial PRIMARY KEY,
        "key" text UNIQUE NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "content" text NOT NULL,
        "category" text DEFAULT 'general' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Add foreign key constraints if they don't exist
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'stages_project_id_projects_id_fk'
        ) THEN
          ALTER TABLE "stages" ADD CONSTRAINT "stages_project_id_projects_id_fk" 
          FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);
    
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'messages_stage_id_stages_id_fk'
        ) THEN
          ALTER TABLE "messages" ADD CONSTRAINT "messages_stage_id_stages_id_fk" 
          FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);
    
    console.log("Database migrations completed successfully!");
    return true;
  } catch (error) {
    console.error("Error running migrations:", error);
    return false;
  } finally {
    await pool.end();
  }
}
