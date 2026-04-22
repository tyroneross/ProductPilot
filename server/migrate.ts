import { Pool } from "pg";

// Build database URL from environment variables
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
  const dbUrl = getDatabaseUrl();
  const connString = !dbUrl.includes('sslmode=')
    ? dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require'
    : dbUrl;
  const pool = new Pool({ connectionString: connString });
  
  try {
    console.log("Running database migrations...");
    
    // Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "guest_owner_id" varchar,
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
    
    // Create legacy sessions table (kept to avoid breaking older local data)
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

    // Create Better Auth tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "email_verified" boolean DEFAULT false NOT NULL,
        "image" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "id" text PRIMARY KEY NOT NULL,
        "expires_at" timestamp NOT NULL,
        "token" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "ip_address" text,
        "user_agent" text,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" text PRIMARY KEY NOT NULL,
        "account_id" text NOT NULL,
        "provider_id" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "access_token" text,
        "refresh_token" text,
        "id_token" text,
        "access_token_expires_at" timestamp,
        "refresh_token_expires_at" timestamp,
        "scope" text,
        "password" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "verification" (
        "id" text PRIMARY KEY NOT NULL,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token")
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id")
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id")
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique" ON "account" ("provider_id", "account_id")
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier")
    `);
    
    // Create admin_prompts table (matching shared/schema.ts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "admin_prompts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "scope" text NOT NULL,
        "target_key" text NOT NULL,
        "label" text NOT NULL,
        "description" text,
        "content" text NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "stage_number" integer,
        "updated_by" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Migrate old admin_prompts table if it has old schema
    await pool.query(`
      DO $$ 
      BEGIN
        -- Check if old schema exists (has 'key' column but not 'scope')
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_prompts' AND column_name = 'key')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_prompts' AND column_name = 'scope') THEN
          -- Drop old table and recreate with new schema
          DROP TABLE "admin_prompts";
          CREATE TABLE "admin_prompts" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "scope" text NOT NULL,
            "target_key" text NOT NULL,
            "label" text NOT NULL,
            "description" text,
            "content" text NOT NULL,
            "is_default" boolean DEFAULT false NOT NULL,
            "stage_number" integer,
            "updated_by" varchar,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          );
        END IF;
      END $$;
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
    
    // Add new columns to projects table for session persistence
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'user_id') THEN
          ALTER TABLE "projects" ADD COLUMN "user_id" varchar;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'guest_owner_id') THEN
          ALTER TABLE "projects" ADD COLUMN "guest_owner_id" varchar;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'mode') THEN
          ALTER TABLE "projects" ADD COLUMN "mode" text DEFAULT 'survey' NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'survey_phase') THEN
          ALTER TABLE "projects" ADD COLUMN "survey_phase" text DEFAULT 'discovery';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'survey_definition') THEN
          ALTER TABLE "projects" ADD COLUMN "survey_definition" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'survey_responses') THEN
          ALTER TABLE "projects" ADD COLUMN "survey_responses" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'custom_prompts') THEN
          ALTER TABLE "projects" ADD COLUMN "custom_prompts" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'intake_answers') THEN
          ALTER TABLE "projects" ADD COLUMN "intake_answers" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'minimum_details') THEN
          ALTER TABLE "projects" ADD COLUMN "minimum_details" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'app_style') THEN
          ALTER TABLE "projects" ADD COLUMN "app_style" jsonb;
        END IF;
      END $$;
    `);

    // UNIQUE constraint so seedDefaultPrompts can't duplicate on re-run.
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'admin_prompts_target_key_unique' AND table_name = 'admin_prompts'
        ) THEN
          -- Deduplicate any existing rows before enforcing UNIQUE
          DELETE FROM "admin_prompts" a USING "admin_prompts" b
          WHERE a."created_at" > b."created_at" AND a."target_key" = b."target_key";
          ALTER TABLE "admin_prompts"
          ADD CONSTRAINT "admin_prompts_target_key_unique" UNIQUE ("target_key");
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" ("user_id")
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "projects_guest_owner_id_idx" ON "projects" ("guest_owner_id")
    `);

    // Hot-path index flagged in DB audit: message reads always filter by stage_id and order by created_at.
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "messages_stage_id_created_at_idx" ON "messages" ("stage_id", "created_at")
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "stages_project_id_idx" ON "stages" ("project_id")
    `);

    // projects.user_id → user.id FK (ON DELETE SET NULL) so deleting a Better Auth user preserves
    // the project data for admin review but removes the reference. Idempotent: only adds FK if missing.
    // Orphan cleanup first: null any user_id that doesn't match an existing user row (legacy Neon/Replit IDs).
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'projects_user_id_user_id_fk' AND table_name = 'projects'
        ) THEN
          -- Clear stale userIds before enforcing the FK to avoid migration failure.
          UPDATE "projects"
          SET "user_id" = NULL
          WHERE "user_id" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "projects"."user_id");

          ALTER TABLE "projects"
          ADD CONSTRAINT "projects_user_id_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // llm_calls — cost + latency telemetry. Written by AIService at call boundary.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "llm_calls" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "guest_owner_id" varchar,
        "project_id" varchar,
        "stage_id" varchar,
        "provider" text NOT NULL,
        "model" text NOT NULL,
        "task" text NOT NULL,
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        "cache_read_tokens" integer,
        "cache_write_tokens" integer,
        "cost_usd" numeric(12, 6),
        "latency_ms" integer,
        "status" text NOT NULL,
        "error_code" text,
        "streamed" boolean NOT NULL DEFAULT false,
        "byok" boolean NOT NULL DEFAULT false,
        "request_id" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "llm_calls_user_id_created_at_idx" ON "llm_calls" ("user_id", "created_at")
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "llm_calls_project_id_idx" ON "llm_calls" ("project_id")
    `);

    // messages.kind + messages.version — distinguish chat turns from finalized deliverables,
    // support versioned regeneration without a separate documents table.
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='kind') THEN
          ALTER TABLE "messages" ADD COLUMN "kind" text NOT NULL DEFAULT 'chat';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='version') THEN
          ALTER TABLE "messages" ADD COLUMN "version" integer NOT NULL DEFAULT 1;
        END IF;
      END $$;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "messages_stage_kind_idx" ON "messages" ("stage_id", "kind")
    `);

    // audit_events — write-only business-event log.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "actor_type" text NOT NULL,
        "actor_id" varchar,
        "action" text NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" varchar,
        "metadata" jsonb,
        "request_id" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "audit_events_actor_id_created_at_idx" ON "audit_events" ("actor_id", "created_at")
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "audit_events_resource_idx" ON "audit_events" ("resource_type", "resource_id")
    `);

    // Create user_settings table for BYOK LLM configuration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar(255) NOT NULL UNIQUE,
        "llm_provider" text DEFAULT 'groq',
        "llm_api_key" text,
        "llm_model" text DEFAULT 'llama-3.3-70b-versatile',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);

    // Enable RLS on all public tables
    await pool.query(`
      DO $$
      DECLARE
        tbl TEXT;
      BEGIN
        FOR tbl IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename NOT IN ('user', 'session', 'account', 'verification')
        LOOP
          EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        END LOOP;
      END $$;
    `);

    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE IF EXISTS "user" DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS "session" DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS "account" DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS "verification" DISABLE ROW LEVEL SECURITY;
      END $$;
    `);

    // RLS policies — projects scoped to user_id, user_settings scoped to user_id
    await pool.query(`
      DO $$
      BEGIN
        -- Projects: users see their own + unowned projects (demo)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_user_isolation') THEN
          CREATE POLICY projects_user_isolation ON projects
            USING (user_id IS NULL OR user_id = current_setting('app.current_user_id', true));
        END IF;

        -- User settings: users see only their own
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_settings_isolation') THEN
          CREATE POLICY user_settings_isolation ON user_settings
            USING (user_id = current_setting('app.current_user_id', true));
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
