/**
 * Guard against a non-production process connecting to the production database.
 *
 * Regression origin (2026-07-30): `.env.local` pointed both DATABASE_URL and
 * the PG* fallback vars at the same Neon branch Vercel production uses, so
 * `npm run dev` read, wrote, and ran migrations against live user data with
 * nothing in the code path to object.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertNotProductionDatabase,
  isProductionHost,
  ProductionDatabaseGuardError,
} from "../lib/db-guard";

const PROD = "postgresql://u:p@ep-lively-mud-akrgjji2-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require";
const DEV = "postgresql://u:p@ep-broad-mud-akbe5f27-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require";

const ENV = { ...process.env };
beforeEach(() => {
  delete process.env.PRODUCTION_DB_HOSTS;
  delete process.env.ALLOW_PROD_DB;
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("isProductionHost", () => {
  it("recognizes the production endpoint", () => {
    expect(isProductionHost(PROD)).toBe(true);
  });

  it("does not flag the dev branch endpoint", () => {
    expect(isProductionHost(DEV)).toBe(false);
  });

  it("accepts a bare hostname as well as a URL", () => {
    expect(isProductionHost("ep-lively-mud-akrgjji2-pooler.c-3.us-west-2.aws.neon.tech")).toBe(true);
  });

  it("is configurable via PRODUCTION_DB_HOSTS", () => {
    process.env.PRODUCTION_DB_HOSTS = "my-prod-host,another-prod";
    expect(isProductionHost("postgresql://u:p@my-prod-host.example.com/db")).toBe(true);
    expect(isProductionHost(PROD)).toBe(false); // default marker no longer applies
  });

  it("does not throw on an unparseable connection string", () => {
    expect(() => isProductionHost("not a url at all")).not.toThrow();
  });
});

describe("assertNotProductionDatabase", () => {
  it("throws when a development process targets production", () => {
    expect(() => assertNotProductionDatabase(PROD, "development")).toThrow(
      ProductionDatabaseGuardError,
    );
  });

  it("throws when NODE_ENV is unset entirely", () => {
    expect(() => assertNotProductionDatabase(PROD, undefined)).toThrow(
      ProductionDatabaseGuardError,
    );
  });

  it("throws in test runs too — a test suite must never hit prod", () => {
    expect(() => assertNotProductionDatabase(PROD, "test")).toThrow(ProductionDatabaseGuardError);
  });

  it("allows the deployed app itself", () => {
    expect(() => assertNotProductionDatabase(PROD, "production")).not.toThrow();
  });

  it("allows a dev process against the dev branch", () => {
    expect(() => assertNotProductionDatabase(DEV, "development")).not.toThrow();
  });

  it("allows a deliberate ALLOW_PROD_DB=1 override", () => {
    expect(() => assertNotProductionDatabase(PROD, "development", "1")).not.toThrow();
  });

  it("does not treat any other ALLOW_PROD_DB value as an override", () => {
    for (const v of ["true", "yes", "0", ""]) {
      expect(() => assertNotProductionDatabase(PROD, "development", v)).toThrow(
        ProductionDatabaseGuardError,
      );
    }
  });

  it("names the offending host and the PG*-precedence trap in the message", () => {
    try {
      assertNotProductionDatabase(PROD, "development");
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("ep-lively-mud-akrgjji2");
      // PG* vars take precedence over DATABASE_URL — repointing only
      // DATABASE_URL leaves the process still aimed at prod.
      expect(msg).toContain("PGHOST");
      expect(msg).toContain("ALLOW_PROD_DB=1");
    }
  });

  it("never leaks the password from the connection string", () => {
    const withSecret = "postgresql://neondb_owner:npg_SUPERSECRET@ep-lively-mud-akrgjji2-pooler.neon.tech/neondb";
    try {
      assertNotProductionDatabase(withSecret, "development");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain("npg_SUPERSECRET");
    }
  });
});
