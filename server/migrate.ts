import { neon } from "@neondatabase/serverless";

export async function runMigrations() {
  try {
    console.log("Running database migrations...");
    
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    const sql = neon(process.env.DATABASE_URL);
    
    // Create projects table
    await sql`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "ai_model" text DEFAULT 'claude-sonnet' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Create stages table
    await sql`
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
    `;
    
    // Create messages table
    await sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "stage_id" varchar NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Add foreign key constraints if they don't exist
    await sql`
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
    `;
    
    await sql`
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
    `;
    
    console.log("Database migrations completed successfully!");
    return true;
  } catch (error) {
    console.error("Error running migrations:", error);
    return false;
  }
}