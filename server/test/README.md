# server/test

Vitest 2.x suite. Default `npm run test` is fast and DB-free. RLS contracts
opt-in via `npm run test:rls` against a local Postgres sandbox.

## Modes

### Default — `npm run test`

Runs every `*.test.ts` and `*.test.tsx` under `server/test/`. The RLS
integration file (`rls-spec-artifacts.test.ts`) skips itself cleanly because
neither `RLS_SANDBOX` nor `TEST_DATABASE_URL` is set. No external dependencies.

### Live RLS — `npm run test:rls`

Runs the RLS contract suite against a freshly-provisioned Postgres database.

**Prerequisite:** `postgresql@15` running locally (Homebrew default). Verify with:

```sh
brew services list | grep postgresql@15
psql -d postgres -c "SELECT version();"
```

**What happens:**

1. Vitest's `globalSetup` (`server/test/helpers/rls-global-setup.ts`)
   delegates to `setupSandboxDb()` in `helpers/postgres-sandbox.ts`.
2. The helper connects to `postgresql://<your-OS-user>@localhost:5432/postgres`
   (override with `LOCAL_PG_URL=...` if your Postgres needs a non-default
   user/password/host) and `CREATE DATABASE productpilot_rls_<pid>_<ts>_<rand>`.
3. All migrations under `migrations/` (currently `0000` → `0003`) apply in
   lexical order. SQL files are split on the `--> statement-breakpoint`
   markers drizzle-kit emits.
4. The helper asserts `pg_class.relrowsecurity` is `true` on `projects`,
   `intake_questions`, and `spec_artifacts`.
5. A non-superuser role `productpilot_rls_app` is created and granted SELECT/
   INSERT/UPDATE/DELETE on all tables. The test queries `SET LOCAL ROLE` to it
   so RLS actually fires; superusers bypass RLS even with `FORCE ROW LEVEL
   SECURITY` (FORCE only affects the table OWNER).
6. After all suites finish, the sandbox DB is dropped. Stale orphans from
   previously-crashed runs (>60 min old) are swept opportunistically on the
   next setup invocation.

**Connection-string handling:**

- The sandbox URL lives in `process.env.RLS_SANDBOX_URL` for the duration of
  the test run only. Never written to disk, never logged.
- The helper **does not read** `.env.local`, `DATABASE_URL`, or `POSTGRES_URL`
  — it builds its own connection string from `LOCAL_PG_URL` (or defaults to
  localhost:5432 with the current OS user).
- No prod data ever touches the sandbox.

## Future portability — Path A (testcontainers)

The current setup picks Docker-free pragmatism: developers already have
Homebrew Postgres 15 running, so we lean on it. If we later need CI or
multi-platform parity, the path is `@testcontainers/postgresql`. The
`setupSandboxDb` / `teardownSandboxDb` interface is a stable seam — wiring
testcontainers behind it would be a single-file change in
`helpers/postgres-sandbox.ts` plus adding the dev-dep. Not wired today.

## Migration journal guard

`migrate-journal-guard.test.ts` runs in the default `npm run test` mode. It
fixtures a temp directory rather than the real `migrations/` folder, so it
needs no DB and no special env. The guard it covers (`server/lib/migrate-guard.ts`)
runs at production startup and throws if a `*.sql` migration file on disk is
missing from `migrations/meta/_journal.json` — the failure mode that hit
0003_adaptive_intake (which would have skipped four schema changes in prod
because drizzle-orm's migrator iterates the journal, not the directory).

Add a fixture case here whenever the guard's behavior changes (e.g. new
ignore pattern, new error format).

## Adding new RLS tests

1. Use the `withAppRole(...)` helper in `rls-spec-artifacts.test.ts` for any
   assertion that needs RLS to fire. Setup/teardown can stay superuser.
2. Always set both `app.current_user_id` and `app.current_guest_owner_id`
   GUCs on the actor (use `setActor({...})`) — empty strings are treated as
   NULL by the policies, which is what the production storage layer also does.
3. Cover both the user-owned (`current_user_id`) and guest-owned
   (`current_guest_owner_id`) branches when the policy reads from `projects`
   — both paths matter to the demo flow.
