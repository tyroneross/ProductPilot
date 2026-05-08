/**
 * Spec linter — deterministic-tier tests.
 *
 * Covers every rule in spec-linter.ts that does NOT require a model call:
 *   - p0_need_missing_test
 *   - pii_handling_note_missing  (non-waivable)
 *   - low_reversibility_adr_uncited
 *   - stance_because_missing
 *   - non_goal_because_missing
 *   - test_framework_missing / test_framework_platform_mismatch (cross-platform)
 *   - stage1_fidelity_below_threshold
 *
 * The Haiku-tier (LLM) rules live in spec-linter-llm.test.ts.
 * Per-platform extras (iOS HIG, macOS HIG, claude-plugin manifest) live in
 * spec-linter-platform.test.ts.
 */

import { describe, expect, it } from "vitest";
import { SpecSchema, ProductStateSchema } from "@shared/schema";
import { lintSpecSync } from "../services/spec-linter";

// A spec with the eight Fidelity-Check signals already present, so individual
// tests can stay focused on the rule under test rather than fighting the
// Stage-1 Fidelity blocker.
function clean8FidelitySpec(overrides: Partial<Parameters<typeof SpecSchema.parse>[0]> = {}) {
  return SpecSchema.parse({
    id: "spec-base",
    productName: "Base",
    productDescription:
      "On-device runs locally; cloud sync optional. Designed to fail loudly when the on-device pipeline cannot resolve.",
    platformTarget: "web",
    personas: [{ id: "per-1", name: "Solo runner", jobs: ["plan a route"] }],
    scenarios: [],
    needs: [
      {
        id: "need-1",
        title: "Plan a route quickly.",
        priority: "P0",
        description: "Single-metric outcome: minutes to plan-finish.",
      },
    ],
    features: [],
    uxFlows: [{ id: "flow-1", name: "First run", steps: ["open", "tap start"] }],
    screens: [],
    dataPoints: [],
    integrations: [],
    apiContracts: [],
    tests: [
      {
        id: "test-1",
        description: "Acceptance: plan a 10km route end-to-end.",
        needIds: ["need-1"],
        kind: "acceptance",
        testFramework: "Vitest",
      },
    ],
    adrs: [],
    assumptions: [],
    risks: [
      { id: "risk-1", text: "Map tile rate limit", mitigation: "Graceful degrade with cached tiles." },
    ],
    nonGoals: [{ id: "ng-1", text: "No competitor parity for race-day.", because: "We differentiate on solo planning." }],
    ...overrides,
  });
}

function fullState() {
  return ProductStateSchema.parse({
    stanceBecauseClauses: [
      { id: "s-priv", category: "privacy_data", stance: "Local-first, no cloud upload by default.", because: "Trust matters for journaling-adjacent privacy." },
      { id: "s-cmp", category: "complexity", stance: "Simplify; one primary action per screen.", because: "Faster onboarding beats configurability." },
      { id: "s-cost", category: "cost", stance: "One-time purchase, no subs.", because: "Race against competitors copying feature for cheaper." },
    ],
    pivotLog: [],
    workingMemory: {},
  });
}

describe("spec-linter — deterministic / clean baseline", () => {
  it("reports zero blockers for a fully-clean spec + populated productState", () => {
    const result = lintSpecSync({ spec: clean8FidelitySpec(), productState: fullState() });
    expect(result.blockerCount).toBe(0);
    expect(result.nonWaivableCount).toBe(0);
    expect(result.llmRan).toBe(false); // sync path
  });
});

describe("spec-linter — p0_need_missing_test", () => {
  it("blocks when a P0 Need has zero Tests pointing at its id", () => {
    const spec = clean8FidelitySpec({
      needs: [{ id: "need-x", title: "Critical user value", priority: "P0" }],
      tests: [], // none
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find((i) => i.rule === "p0_need_missing_test");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.waivable).toBe(true);
    expect(issue?.refs[0]?.id).toBe("need-x");
  });

  it("does not block when Need is P1 (only P0 is gated)", () => {
    const spec = clean8FidelitySpec({
      needs: [{ id: "need-y", title: "Nice-to-have", priority: "P1" }],
      tests: [],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.find((i) => i.rule === "p0_need_missing_test")).toBeUndefined();
  });
});

describe("spec-linter — pii_handling_note_missing (non-waivable)", () => {
  it("emits a non-waivable block when pii=true and handlingNote is missing", () => {
    const spec = clean8FidelitySpec({
      dataPoints: [{ id: "dp-1", name: "user_email", type: "string", pii: true }],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find((i) => i.rule === "pii_handling_note_missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.waivable).toBe(false); // critical: this rule is non-waivable
  });

  it("passes when pii=true with a handlingNote", () => {
    const spec = clean8FidelitySpec({
      dataPoints: [
        { id: "dp-1", name: "user_email", type: "string", pii: true, handlingNote: "Hashed at rest." },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.find((i) => i.rule === "pii_handling_note_missing")).toBeUndefined();
  });

  it("ignores DataPoints with pii=false even when handlingNote is empty", () => {
    const spec = clean8FidelitySpec({
      dataPoints: [{ id: "dp-1", name: "anon_id", type: "uuid", pii: false }],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.find((i) => i.rule === "pii_handling_note_missing")).toBeUndefined();
  });
});

describe("spec-linter — low_reversibility_adr_uncited", () => {
  it("blocks when an ADR with reversibility='low' has empty cites[]", () => {
    const spec = clean8FidelitySpec({
      adrs: [
        {
          id: "adr-1",
          title: "Move auth to OAuth-only",
          context: "x",
          decision: "y",
          reversibility: "low",
          cites: [],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find((i) => i.rule === "low_reversibility_adr_uncited");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
  });

  it("does not block when low-reversibility ADR cites something", () => {
    const spec = clean8FidelitySpec({
      adrs: [
        {
          id: "adr-1",
          title: "Move auth to OAuth-only",
          context: "x",
          decision: "y",
          reversibility: "low",
          cites: ["need-1"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.find((i) => i.rule === "low_reversibility_adr_uncited")).toBeUndefined();
  });
});

describe("spec-linter — stance_because_missing", () => {
  it("blocks when a stance has empty because clause", () => {
    const stateBad = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s-bad", category: "privacy_data", stance: "We will not log queries.", because: "" },
      ],
    });
    const result = lintSpecSync({ spec: clean8FidelitySpec(), productState: stateBad });
    const issue = result.issues.find((i) => i.rule === "stance_because_missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.refs[0]?.kind).toBe("stance");
  });
});

describe("spec-linter — non_goal_because_missing", () => {
  it("blocks when a NonGoal has empty because clause", () => {
    const spec = clean8FidelitySpec({
      nonGoals: [{ id: "ng-2", text: "No teams feature", because: "" }],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find((i) => i.rule === "non_goal_because_missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.refs[0]?.id).toBe("ng-2");
  });
});

describe("spec-linter — test_framework rules (cross-platform deterministic)", () => {
  it("blocks Test with empty testFramework", () => {
    const spec = clean8FidelitySpec({
      tests: [
        { id: "test-1", description: "Plan a route", needIds: ["need-1"], kind: "acceptance", testFramework: "" },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.find((i) => i.rule === "test_framework_missing")).toBeDefined();
  });

  it("blocks web spec whose Test names a non-web framework", () => {
    const spec = clean8FidelitySpec({
      platformTarget: "web",
      tests: [
        { id: "test-1", description: "Plan a route", needIds: ["need-1"], kind: "acceptance", testFramework: "XCTest" },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeDefined();
  });
});

describe("spec-linter — Stage-1 Fidelity Check", () => {
  it("blocks when fewer than 6/8 tactical answers are derivable", () => {
    // Strip stance because-clauses + UX flows + risks → derivedCount drops below 6.
    const minimal = SpecSchema.parse({
      id: "spec-thin",
      productName: "Thin",
      productDescription: "A thing.",
      platformTarget: "web",
      needs: [],
      tests: [],
    });
    const stateThin = ProductStateSchema.parse({});
    const result = lintSpecSync({ spec: minimal, productState: stateThin });
    expect(result.issues.find((i) => i.rule === "stage1_fidelity_below_threshold")).toBeDefined();
  });

  it("passes when ≥6/8 tactical answers are derivable", () => {
    const result = lintSpecSync({ spec: clean8FidelitySpec(), productState: fullState() });
    expect(result.issues.find((i) => i.rule === "stage1_fidelity_below_threshold")).toBeUndefined();
  });
});

describe("spec-linter — issue shape contract", () => {
  it("every emitted issue has a rule, severity, waivable flag, and stable id", () => {
    const spec = clean8FidelitySpec({
      needs: [{ id: "need-x", title: "P0 with no test", priority: "P0" }],
      tests: [], // forces p0_need_missing_test
      dataPoints: [{ id: "dp-1", name: "email", type: "string", pii: true }], // forces non-waivable
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    expect(result.issues.length).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(typeof issue.id).toBe("string");
      expect(issue.id.length).toBeGreaterThan(0);
      expect(["block", "warn", "info"]).toContain(issue.severity);
      expect(typeof issue.waivable).toBe("boolean");
      expect(typeof issue.rule).toBe("string");
    }
  });
});
