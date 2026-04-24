-- Follow-up to 0001_consolidate_from_runtime.sql.
--
-- Why this migration exists:
--   1. drizzle-kit cannot express cross-schema FKs cleanly (projects.user_id → user.id
--      and user_settings.user_id → user.id). The `user` table lives in
--      server/auth/schema.ts while `projects` / `user_settings` live in shared/schema.ts.
--      Importing across the shared → server boundary breaks the type isolation, so we
--      add the FKs in hand-written SQL here.
--   2. drizzle-kit has no abstraction for RLS ENABLE/FORCE or CREATE POLICY. Postgres
--      row-level security for tenant isolation lives here.
--   3. Both steps need orphan cleanup before enforcing constraints; those DELETE/UPDATE
--      statements must run as part of the same migration, not outside it.
--
-- All statements are idempotent (IF EXISTS / IF NOT EXISTS / DROP...CREATE for policies)
-- so re-running is safe.

-- ── Cross-schema FKs ──────────────────────────────────────────────────────

-- projects.user_id → user.id (ON DELETE SET NULL).
-- Clears stale user_ids first (legacy Neon/Replit IDs that no longer exist).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_user_id_user_id_fk' AND table_name = 'projects'
  ) THEN
    UPDATE "projects"
    SET "user_id" = NULL
    WHERE "user_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "projects"."user_id");

    ALTER TABLE "projects"
    ADD CONSTRAINT "projects_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

-- user_settings.user_id → user.id (ON DELETE CASCADE).
-- Deletes orphaned rows first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_settings_user_id_user_id_fk' AND table_name = 'user_settings'
  ) THEN
    DELETE FROM "user_settings"
    WHERE "user_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "user_settings"."user_id");

    ALTER TABLE "user_settings"
    ADD CONSTRAINT "user_settings_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

-- user_settings.user_id → user.id FK via orphan cleanup. Drizzle-kit already
-- emitted the unique constraint on user_settings.user_id via schema.ts; no action here.

-- ── Row-Level Security ────────────────────────────────────────────────────

-- Auth tables never get RLS (Better Auth owns them). All other tables in public get RLS.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('user', 'session', 'account', 'verification', 'rateLimit')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE IF EXISTS "user" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "session" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "account" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "verification" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "rateLimit" DISABLE ROW LEVEL SECURITY;
END $$;
--> statement-breakpoint

-- Tenant isolation policies. Every tenant table's USING/WITH CHECK gates on the
-- request-scoped GUCs app.current_user_id + app.current_guest_owner_id set inside
-- PostgresStorage.withActor() (server/storage-hybrid.ts).
DO $$
BEGIN
  DROP POLICY IF EXISTS projects_user_isolation ON projects;
  DROP POLICY IF EXISTS user_settings_isolation ON user_settings;
  DROP POLICY IF EXISTS projects_actor_isolation ON projects;
  DROP POLICY IF EXISTS stages_actor_isolation ON stages;
  DROP POLICY IF EXISTS messages_actor_isolation ON messages;
  DROP POLICY IF EXISTS user_settings_actor_isolation ON user_settings;

  ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
  ALTER TABLE "stages" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "stages" FORCE ROW LEVEL SECURITY;
  ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
  ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;

  CREATE POLICY projects_actor_isolation ON projects
    USING (
      (
        NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
        AND user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
      )
      OR (
        NULLIF(current_setting('app.current_guest_owner_id', true), '') IS NOT NULL
        AND guest_owner_id::text = NULLIF(current_setting('app.current_guest_owner_id', true), '')
      )
    )
    WITH CHECK (
      (
        NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
        AND user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
      )
      OR (
        NULLIF(current_setting('app.current_guest_owner_id', true), '') IS NOT NULL
        AND guest_owner_id::text = NULLIF(current_setting('app.current_guest_owner_id', true), '')
      )
    );

  CREATE POLICY stages_actor_isolation ON stages
    USING (
      EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = stages.project_id
          AND (
            (
              NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
              AND p.user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
            )
            OR (
              NULLIF(current_setting('app.current_guest_owner_id', true), '') IS NOT NULL
              AND p.guest_owner_id::text = NULLIF(current_setting('app.current_guest_owner_id', true), '')
            )
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = stages.project_id
          AND (
            (
              NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
              AND p.user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
            )
            OR (
              NULLIF(current_setting('app.current_guest_owner_id', true), '') IS NOT NULL
              AND p.guest_owner_id::text = NULLIF(current_setting('app.current_guest_owner_id', true), '')
            )
          )
      )
    );

  CREATE POLICY messages_actor_isolation ON messages
    USING (
      EXISTS (
        SELECT 1
        FROM stages s
        JOIN projects p ON p.id = s.project_id
        WHERE s.id = messages.stage_id
          AND (
            (
              NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
              AND p.user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
            )
            OR (
              NULLIF(current_setting('app.current_guest_owner_id', true), '') IS NOT NULL
              AND p.guest_owner_id::text = NULLIF(current_setting('app.current_guest_owner_id', true), '')
            )
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM stages s
        JOIN projects p ON p.id = s.project_id
        WHERE s.id = messages.stage_id
          AND (
            (
              NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
              AND p.user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
            )
            OR (
              NULLIF(current_setting('app.current_guest_owner_id', true), '') IS NOT NULL
              AND p.guest_owner_id::text = NULLIF(current_setting('app.current_guest_owner_id', true), '')
            )
          )
      )
    );

  CREATE POLICY user_settings_actor_isolation ON user_settings
    USING (
      NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
      AND user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
    )
    WITH CHECK (
      NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
      AND user_id::text = NULLIF(current_setting('app.current_user_id', true), '')
    );
END $$;
