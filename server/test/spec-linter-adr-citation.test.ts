/**
 * Phase 4 — spec-linter rule: every ADR must cite a tradeoff axis OR a stance
 * "because" clause id.
 *
 * Rule id: adr_missing_weight_or_stance_citation
 *
 * Citation matchers:
 *   - axis: any of the six TRADEOFF_AXES, or "unacceptable_tradeoff(:<axis>)?"
 *   - stance: literal "stance:" prefix, OR an exact match against
 *     productState.stanceBecauseClauses[*].id
 *
 * The clean baseline below has zero ADRs so the new rule does not fire — we
 * insert ADRs per-test to drive the targeted assertions.
 */

import { describe, expect, it } from "vitest";
import { SpecSchema, ProductStateSchema } from "@shared/schema";
import { lintSpecSync } from "../services/spec-linter";

function baseSpec(overrides: Partial<Parameters<typeof SpecSchema.parse>[0]> = {}) {
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
        description: "Single-metric outcome.",
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
    tradeoffWeights: {
      speed_to_alpha: 35,
      scalability: 10,
      ux_polish: 15,
      maintainability: 20,
      cost: 10,
      security: 10,
      unacceptable_tradeoff: "security",
    },
  });
}

describe("spec-linter — adr_missing_weight_or_stance_citation", () => {
  it("blocks an ADR with empty cites[] (no axis, no stance) — clear failure path", () => {
    const spec = baseSpec({
      adrs: [
        {
          id: "adr-1",
          title: "Choose modular monolith",
          context: "We need to ship fast.",
          decision: "Use a single Express app, not microservices.",
          reversibility: "medium",
          cites: [],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find(
      (i) => i.rule === "adr_missing_weight_or_stance_citation",
    );
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("block");
    expect(issue?.waivable).toBe(true);
    expect(issue?.refs[0]?.id).toBe("adr-1");
  });

  it("passes when an ADR cites a tradeoff axis by name", () => {
    const spec = baseSpec({
      adrs: [
        {
          id: "adr-axis",
          title: "Modular monolith over microservices",
          context: "Solo founder.",
          decision: "Single app.",
          reversibility: "medium",
          cites: ["speed_to_alpha=35", "maintainability=20"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find(
      (i) => i.rule === "adr_missing_weight_or_stance_citation",
    );
    expect(issue).toBeUndefined();
  });

  it("passes when an ADR cites a stance-because id (literal stance: prefix)", () => {
    const spec = baseSpec({
      adrs: [
        {
          id: "adr-stance",
          title: "Avoid distributed services",
          context: "Cost.",
          decision: "Single Vercel deployment.",
          reversibility: "medium",
          cites: ["stance:s-cmp"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find(
      (i) => i.rule === "adr_missing_weight_or_stance_citation",
    );
    expect(issue).toBeUndefined();
  });

  it("passes when an ADR cites a bare stance id that exists in productState", () => {
    // Citation strings without the "stance:" prefix are accepted if they exactly
    // match an existing stance id — the linter consults productState.stanceBecauseClauses.
    const spec = baseSpec({
      adrs: [
        {
          id: "adr-bare-stance",
          title: "Local-first only",
          context: "Privacy.",
          decision: "No cloud upload.",
          reversibility: "low",
          cites: ["s-priv"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find(
      (i) => i.rule === "adr_missing_weight_or_stance_citation",
    );
    expect(issue).toBeUndefined();
  });

  it("flags each ADR independently — multiple bad ADRs each emit one issue", () => {
    const spec = baseSpec({
      adrs: [
        {
          id: "adr-bad-a",
          title: "Bad A",
          context: "x",
          decision: "y",
          reversibility: "medium",
          cites: ["random-string"],
        },
        {
          id: "adr-bad-b",
          title: "Bad B",
          context: "x",
          decision: "y",
          reversibility: "medium",
          cites: [],
        },
        {
          id: "adr-good",
          title: "Good",
          context: "x",
          decision: "y",
          reversibility: "medium",
          cites: ["security"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issues = result.issues.filter(
      (i) => i.rule === "adr_missing_weight_or_stance_citation",
    );
    expect(issues).toHaveLength(2);
    const refIds = issues.flatMap((i) => i.refs.map((r) => r.id));
    expect(refIds).toContain("adr-bad-a");
    expect(refIds).toContain("adr-bad-b");
    expect(refIds).not.toContain("adr-good");
  });

  it("recognizes the unacceptable_tradeoff token as a valid axis citation", () => {
    const spec = baseSpec({
      adrs: [
        {
          id: "adr-uat",
          title: "Add audit log v1",
          context: "Risk surface check",
          decision: "Ship audit log day-one.",
          reversibility: "low",
          cites: ["unacceptable_tradeoff:security"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState() });
    const issue = result.issues.find(
      (i) => i.rule === "adr_missing_weight_or_stance_citation",
    );
    expect(issue).toBeUndefined();
  });
});
