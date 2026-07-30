/**
 * Refuse to let a non-production process touch the production database.
 *
 * Background (2026-07-30): `.env.local` pointed `DATABASE_URL` *and* the `PG*`
 * fallback vars at the same Neon branch Vercel production uses. Any
 * `npm run dev` therefore read, wrote, and ran migrations against live user
 * data, with nothing in the code path to notice. Two demo rows were written to
 * production during an unrelated debugging session before anyone spotted it.
 *
 * The fix is not "remember to check the env file". It is this assertion, which
 * runs before the first connection and fails loudly.
 *
 * Configuration:
 *   PRODUCTION_DB_HOSTS  comma-separated host substrings considered production.
 *                        Defaults to the known ProductPilot prod endpoint.
 *   ALLOW_PROD_DB=1      explicit, deliberate override for the rare case where
 *                        a local process genuinely must reach production (a
 *                        one-off migration or data repair). Requires typing it,
 *                        which is the point.
 *
 * `NODE_ENV=production` is exempt: that IS the deployed app.
 */

const DEFAULT_PRODUCTION_HOST_MARKERS = ["ep-lively-mud-akrgjji2"];

export class ProductionDatabaseGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionDatabaseGuardError";
  }
}

/** Extract a comparable host from a URL or a bare hostname. Never throws. */
function hostOf(databaseUrlOrHost: string): string {
  try {
    return new URL(databaseUrlOrHost).host.toLowerCase();
  } catch {
    return databaseUrlOrHost.trim().toLowerCase();
  }
}

export function isProductionHost(
  databaseUrlOrHost: string,
  markers: string[] = resolveMarkers(),
): boolean {
  const host = hostOf(databaseUrlOrHost);
  return markers.some((m) => m.length > 0 && host.includes(m.toLowerCase()));
}

function resolveMarkers(): string[] {
  const configured = process.env.PRODUCTION_DB_HOSTS;
  if (configured && configured.trim().length > 0) {
    return configured.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_PRODUCTION_HOST_MARKERS;
}

/**
 * Throws when a non-production process is pointed at a production host.
 *
 * @param databaseUrlOrHost the resolved connection target
 * @param nodeEnv           process.env.NODE_ENV at call time
 * @param allowOverride     process.env.ALLOW_PROD_DB at call time
 */
export function assertNotProductionDatabase(
  databaseUrlOrHost: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  allowOverride: string | undefined = process.env.ALLOW_PROD_DB,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): void {
  if (nodeEnv === "production") return;
  // Belt-and-braces: this assertion runs at module load on the serverless
  // boot path, so a false trip would take production down — the exact outcome
  // it exists to prevent. VERCEL_ENV is set by the platform, independently of
  // whatever NODE_ENV ends up being, so honor it as a second proof of "this IS
  // the deployed app".
  if (vercelEnv === "production") return;
  if (allowOverride === "1") return;
  if (!isProductionHost(databaseUrlOrHost)) return;

  throw new ProductionDatabaseGuardError(
    `Refusing to connect: NODE_ENV=${nodeEnv ?? "(unset)"} but the database host looks like PRODUCTION ` +
      `(${hostOf(databaseUrlOrHost)}).\n\n` +
      `This process would read, write, and migrate live user data.\n\n` +
      `Fix: point DATABASE_URL (and the PGHOST/PGUSER/PGPASSWORD/PGDATABASE fallbacks, which take ` +
      `precedence over DATABASE_URL) at the Neon 'dev' branch.\n` +
      `Override deliberately with ALLOW_PROD_DB=1 only for a one-off production repair.`,
  );
}
