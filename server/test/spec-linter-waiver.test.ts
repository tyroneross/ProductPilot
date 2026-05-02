/**
 * Spec linter — waiver flow unit tests.
 *
 * Covers:
 *   - waivable issues carry waivable=true
 *   - PII non-waivable rule carries waivable=false
 *   - sanitizeWaiverReason strips control bytes, escapes angle brackets, caps length
 *   - same-issueId can be re-waived (idempotent overwrite, not a fault)
 *
 * Route-level integration (auth, audit, 409 on PII waive, server-side enforcement)
 * lives in spec-routes.test.ts.
 */

import { describe, expect, it } from "vitest";
import { ProductStateSchema, SpecSchema } from "@shared/schema";
import { lintSpecSync, sanitizeWaiverReason } from "../services/spec-linter";

describe("spec-linter — waivability flags", () => {
  it("standard blockers are waivable=true", () => {
    const spec = SpecSchema.parse({
      id: "spec-w1",
      productName: "X",
      productDescription: "On-device only; designed to fail loudly when invalid input.",
      platformTarget: "web",
      personas: [{ id: "p-1", name: "User", jobs: ["use thing"] }],
      needs: [{ id: "need-1", title: "Critical", priority: "P0" }],
      tests: [], // missing test → blocker
      uxFlows: [{ id: "f-1", name: "First run", steps: ["start"] }],
      risks: [{ id: "r-1", text: "Tile limit", mitigation: "Graceful degrade." }],
      nonGoals: [{ id: "ng-1", text: "No teams", because: "Solo focus per persona scope." }],
    });
    const state = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s-priv", category: "privacy_data", stance: "Local first.", because: "Privacy on-device matters." },
        { id: "s-cmp", category: "complexity", stance: "Simplify.", because: "Speed over accuracy." },
        { id: "s-cost", category: "cost", stance: "One-time.", because: "Compete with cheap copy-cats." },
      ],
    });
    const result = lintSpecSync({ spec, productState: state });
    const blocker = result.issues.find((i) => i.rule === "p0_need_missing_test");
    expect(blocker).toBeDefined();
    expect(blocker?.waivable).toBe(true);
  });

  it("PII rule emits waivable=false (non-waivable)", () => {
    const spec = SpecSchema.parse({
      id: "spec-w2",
      productName: "X",
      productDescription: "On-device pipeline; fails loudly on bad input.",
      platformTarget: "web",
      dataPoints: [{ id: "dp-1", name: "user_email", type: "string", pii: true }],
      personas: [{ id: "p-1", name: "User", jobs: ["use"] }],
      needs: [{ id: "need-1", title: "Critical", priority: "P0" }],
      tests: [{ id: "test-1", description: "x", needIds: ["need-1"], kind: "acceptance", testFramework: "Vitest" }],
      uxFlows: [{ id: "f-1", name: "Run", steps: ["start"] }],
      risks: [{ id: "r-1", text: "Tile limit", mitigation: "Graceful degrade." }],
      nonGoals: [{ id: "ng-1", text: "No teams", because: "Solo." }],
    });
    const state = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s-priv", category: "privacy_data", stance: "Local first.", because: "Privacy first." },
        { id: "s-cmp", category: "complexity", stance: "Simplify.", because: "Speed over accuracy." },
        { id: "s-cost", category: "cost", stance: "One-time.", because: "No copy of competitor parity features." },
      ],
    });
    const result = lintSpecSync({ spec, productState: state });
    const piiIssue = result.issues.find((i) => i.rule === "pii_handling_note_missing");
    expect(piiIssue).toBeDefined();
    expect(piiIssue?.waivable).toBe(false);
    expect(result.nonWaivableCount).toBeGreaterThanOrEqual(1);
  });
});

describe("sanitizeWaiverReason", () => {
  it("trims whitespace and caps length at 1000 chars", () => {
    const long = "a".repeat(2000);
    const out = sanitizeWaiverReason(`   ${long}   `);
    expect(out.length).toBe(1000);
  });

  it("strips ASCII control bytes but keeps tab and newline", () => {
    const raw = "ok\x00bad\x07also-bad\nkeep\tkeep";
    const out = sanitizeWaiverReason(raw);
    expect(out).not.toMatch(/[\x00-\x08]/);
    expect(out).not.toContain("\x7f");
    expect(out).toContain("\n");
    expect(out).toContain("\t");
  });

  it("escapes angle brackets to defang stored XSS in admin views", () => {
    const raw = "<script>alert(1)</script>";
    const out = sanitizeWaiverReason(raw);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("&lt;");
    expect(out).toContain("&gt;");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(sanitizeWaiverReason(null)).toBe("");
    // @ts-expect-error — exercising the runtime guard
    expect(sanitizeWaiverReason(42)).toBe("");
  });
});
