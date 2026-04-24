# ProductPilot Auth and Database Security Remediation Report

Date: 2026-04-24

## Executive Summary

Email/password authentication is wired through Better Auth and remains enabled without requiring email verification. The remediation pass focused on production risks around auth-token leakage, future provider linking, durable brute-force controls, stored secrets, request boundaries, and database tenant isolation.

Most originally identified auth/database findings are now fixed in code. Two items remain operational: the database migration has not been applied to a live database in this session, and `npm audit --omit=dev` still reports moderate upstream advisories with no current direct fix.

## Fixed Findings

### AUTH-001: Auth links logged when email delivery is missing

Status: Fixed in code.

Location: `server/auth/email.ts`

Change: Production now refuses to log auth email bodies and throws if `RESEND_API_KEY` or `AUTH_FROM_EMAIL` is missing. Local development still logs links for testability.

### AUTH-002: Durable brute-force protection not configured explicitly

Status: Fixed in code.

Location: `server/auth/index.ts`; `server/auth/schema.ts`; `server/migrate.ts`

Change: Better Auth rate limiting now uses database storage, has a `rateLimit` table, and has stricter custom rules for email sign-in, sign-up, password reset, verification email, and magic-link flows.

### AUTH-003: Future provider correlation/account linking needed tightening

Status: Fixed in code and docs.

Location: `server/auth/index.ts`; `docs/AUTH_SETUP.md`

Change: Account linking now trusts Google only, blocks different-email linking, and documents the actual email/password account provider ID (`credential`). Email/password first, then Google with the same email is supported. Google first, then password credential should use password reset/set-password flow rather than normal sign-up.

### DB-001: RLS was present but not enforcing tenant isolation for the app connection

Status: Fixed in code, pending live migration.

Location: `server/storage-hybrid.ts`; `server/routes.ts`; `server/migrate.ts`

Change: Storage calls for tenant data now run inside a request-scoped DB actor context and set transaction-local `app.current_user_id` and `app.current_guest_owner_id`. Migration now forces RLS on `projects`, `stages`, `messages`, and `user_settings`, and adds policies for those tenant tables.

### DB-002: BYOK keys and future OAuth tokens stored without app-level encryption

Status: Fixed in code.

Location: `server/lib/secret-crypto.ts`; `server/storage-hybrid.ts`; `server/auth/index.ts`; `.env.example`

Change: BYOK API keys are encrypted with AES-256-GCM before storage and transparently decrypted on read. Better Auth OAuth token encryption is enabled before Google is configured.

### DB-003: `user_settings.user_id` lacked a foreign key

Status: Fixed in migration, pending live migration.

Location: `server/migrate.ts`

Change: Migration deletes orphaned `user_settings` rows before adding `FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE`.

### APP-001: Cookie-authenticated app routes lacked explicit origin validation

Status: Fixed in code.

Location: `server/routes.ts`

Change: Unsafe non-auth `/api` methods now validate `Origin`/`Referer` against Better Auth trusted origins when a browser origin header is present.

### APP-002: Express body parsers had no explicit size limits

Status: Fixed in code.

Location: `server/index.ts`; `server/api-entry/index.ts`

Change: JSON bodies are limited to `1mb`; URL-encoded bodies are limited to `100kb`.

## Residual Risk

### DEP-001: Moderate dependency advisories remain

Status: Partially remediated.

Evidence: The optional `@better-auth/infra` dashboard dependency was removed to eliminate the `@better-auth/sso -> samlify -> uuid` production advisory chain, and Better Auth was updated from `1.6.6` to `1.6.9`. `npm audit --omit=dev` now reports 5 moderate advisories, all from the `esbuild` advisory through Better Auth's Drizzle tooling path, with no available upstream fix in the current installed tree.

Recommended action: Track upstream Better Auth and Drizzle/esbuild releases. Do not expose Vite/esbuild dev servers publicly.

### OPS-001: Migration not applied in this session

Status: Pending operator action.

Reason: Applying the migration would mutate the live database and delete orphaned `user_settings` rows before adding the FK. The code is ready, but it should be run intentionally against the target environment.

## Validation Performed

- `npm run check`
- `npm run build`
- `npm run build:api`
- `git diff --check`
- `npm audit --omit=dev`
- Local Better Auth source/type inspection for `rateLimit`, `encryptOAuthTokens`, `accountLinking`, `advanced.ipAddress`, and `magicLink.storeToken`
