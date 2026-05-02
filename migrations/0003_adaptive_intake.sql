-- Phase 1 of the adaptive-intake plan (docs/superpowers/plans/2026-05-02-adaptive-intake-and-spec-generation.md).
--
-- Why this migration exists:
--   1. ProductPilot is moving from prose-only Markdown specs to a structured Spec
--      object as source of truth. Three new pieces of state need to live next to
--      `projects`: working-memory (`product_state`), Need→Feature→Test traceability
--      (`trace_matrix`), and a per-project mode flag (`intake_mode`) that gates
--      adaptive intake without disturbing existing survey/minimum-details rows.
--   2. New tables `intake_questions` and `spec_artifacts` capture per-question
--      answers and per-stage rendered artifacts. Both are tenant-scoped via the
--      same RLS policy pattern used in 0002 — they piggyback on `projects` for
--      both the user_id and guest_owner_id paths so guest demo flows continue
--      to work without an authed session.
--   3. drizzle-kit cannot express ENABLE/FORCE ROW LEVEL SECURITY or CREATE POLICY,
--      so RLS lives here. Pattern mirrors 0002_rls_policies_and_cross_schema_fks.sql.
--
-- All statements are idempotent (IF EXISTS / IF NOT EXISTS / DROP...CREATE for policies).
-- Re-running is safe; the migration runner records the version once but the SQL
-- itself is defensive in case of partial failures or schema drift.

-- ── Additive columns on projects ─────────────────────────────────────────

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "product_state" jsonb;
--> statement-breakpoint

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "trace_matrix" jsonb;
--> statement-breakpoint

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "intake_mode" text NOT NULL DEFAULT 'adaptive';
--> statement-breakpoint

-- Existing projects keep their behavior. Phase 2 will set 'survey' or 'minimum'
-- explicitly for projects that already started in those flows; until then the
-- application-level guards in routes.ts read the legacy `mode` column for
-- existing rows and only consult `intake_mode` for new ones.
COMMENT ON COLUMN "projects"."intake_mode" IS
  'Adaptive-intake gate. New rows default to ''adaptive''; legacy rows can be flipped to ''survey'' or ''minimum'' to stay on prior flows.';
--> statement-breakpoint

-- ── intake_questions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intake_questions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "step" integer NOT NULL,
  "method" text,
  "question_text" text NOT NULL,
  "answer_text" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "answered_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "intake_questions_project_id_step_idx"
  ON "intake_questions" ("project_id", "step");
--> statement-breakpoint

-- ── spec_artifacts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "spec_artifacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "stage_id" varchar REFERENCES "stages"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "payload" jsonb NOT NULL,
  "rendered_markdown" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "spec_artifacts_project_id_kind_idx"
  ON "spec_artifacts" ("project_id", "kind");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "spec_artifacts_project_id_version_idx"
  ON "spec_artifacts" ("project_id", "version");
--> statement-breakpoint

-- ── RLS — pattern mirrors 0002 ──────────────────────────────────────────
-- Both new tables are scoped via the parent project. Either an authed user
-- (app.current_user_id) or a guest demo session (app.current_guest_owner_id)
-- can pass; cross-tenant SELECT/INSERT/UPDATE/DELETE return 0 rows.

DO $$
BEGIN
  ALTER TABLE "intake_questions" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "intake_questions" FORCE ROW LEVEL SECURITY;
  ALTER TABLE "spec_artifacts" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "spec_artifacts" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS intake_questions_actor_isolation ON intake_questions;
  DROP POLICY IF EXISTS spec_artifacts_actor_isolation ON spec_artifacts;

  CREATE POLICY intake_questions_actor_isolation ON intake_questions
    USING (
      EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = intake_questions.project_id
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
        WHERE p.id = intake_questions.project_id
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

  CREATE POLICY spec_artifacts_actor_isolation ON spec_artifacts
    USING (
      EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = spec_artifacts.project_id
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
        WHERE p.id = spec_artifacts.project_id
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
END $$;
