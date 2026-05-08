/**
 * Spec linter — Stage-1 Fidelity Check tests.
 *
 * Verifies the deterministic 8-question Fidelity Check (PRD-Builder amendment,
 * 2026-05-02). A Brief that lets us derive ≥6/8 answers passes; <6/8 blocks.
 */

import { describe, expect, it } from "vitest";
import { ProductStateSchema, SpecSchema } from "@shared/schema";
import { runFidelityCheck, lintSpecSync } from "../services/spec-linter";

describe("spec-linter — Stage-1 Fidelity Check", () => {
  it("scores 8/8 on a fully populated brief", () => {
    const spec = SpecSchema.parse({
      id: "spec-rich",
      productName: "Rich",
      productDescription:
        "On-device pipeline runs locally; cloud sync optional. Designed to fail loudly when input is malformed.",
      platformTarget: "web",
      personas: [{ id: "per-1", name: "Solo runner", jobs: ["plan a route"] }],
      needs: [{ id: "need-1", title: "Plan quickly", priority: "P0" }],
      tests: [{ id: "test-1", description: "Plan", needIds: ["need-1"], kind: "acceptance", testFramework: "Vitest" }],
      uxFlows: [{ id: "flow-1", name: "First run", steps: ["open", "tap"] }],
      risks: [{ id: "risk-1", text: "Tile rate limit", mitigation: "Graceful degrade with cache." }],
      nonGoals: [{ id: "ng-1", text: "No competitor parity", because: "We differentiate on solo planning." }],
    });
    const state = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s-priv", category: "privacy_data", stance: "Local first.", because: "Privacy and on-device matter." },
        { id: "s-cmp", category: "complexity", stance: "Simplify.", because: "Speed beats accuracy when onboarding." },
        { id: "s-cost", category: "cost", stance: "One-time.", because: "We will not copy competitor parity features." },
      ],
    });
    const fc = runFidelityCheck(spec, state);
    expect(fc.derivedCount).toBe(8);
    expect(fc.passes).toBe(true);
    expect(fc.failures).toHaveLength(0);
  });

  it("scores ≥6/8 → linter does NOT emit stage1_fidelity_below_threshold", () => {
    // Drop the off-persona because-clause hint by removing nonGoal because, which
    // is one of the eight signals — pulling derived count to exactly 7.
    const spec = SpecSchema.parse({
      id: "spec-borderline",
      productName: "Borderline",
      productDescription:
        "On-device pipeline. Designed to fail loudly when input is malformed.",
      platformTarget: "web",
      personas: [{ id: "per-1", name: "Solo runner", jobs: ["plan"] }],
      needs: [{ id: "need-1", title: "Plan quickly", priority: "P0" }],
      tests: [{ id: "test-1", description: "Plan", needIds: ["need-1"], kind: "acceptance", testFramework: "Vitest" }],
      uxFlows: [{ id: "flow-1", name: "Run", steps: ["open"] }],
      risks: [{ id: "risk-1", text: "Tile limit", mitigation: "Degrade gracefully." }],
      nonGoals: [{ id: "ng-1", text: "No teams", because: "We focus on solo." }],
    });
    const state = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s-priv", category: "privacy_data", stance: "Local first.", because: "Privacy first." },
        { id: "s-cmp", category: "complexity", stance: "Simplify.", because: "Speed beats accuracy." },
        // No cost / category clause → drops the copy_competitor_feature signal.
      ],
    });
    const fc = runFidelityCheck(spec, state);
    expect(fc.derivedCount).toBeGreaterThanOrEqual(6);
    expect(fc.passes).toBe(true);

    const result = lintSpecSync({ spec, productState: state });
    expect(result.issues.find((i) => i.rule === "stage1_fidelity_below_threshold")).toBeUndefined();
  });

  it("scores <6/8 → linter emits stage1_fidelity_below_threshold as a block", () => {
    // Strip almost everything: no stance because clauses, no risks, no flows, no nonGoal.
    const spec = SpecSchema.parse({
      id: "spec-thin",
      productName: "Thin",
      productDescription: "Some app.",
      platformTarget: "web",
    });
    const state = ProductStateSchema.parse({});
    const fc = runFidelityCheck(spec, state);
    expect(fc.derivedCount).toBeLessThan(6);
    expect(fc.passes).toBe(false);

    const result = lintSpecSync({ spec, productState: state });
    const issue = result.issues.find((i) => i.rule === "stage1_fidelity_below_threshold");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
    expect(issue?.waivable).toBe(true); // waivable per spec — only PII is non-waivable
  });

  it("returns the failing question ids in the result", () => {
    const spec = SpecSchema.parse({
      id: "spec-thin2",
      productName: "Thin2",
      productDescription: "Plain app.",
      platformTarget: "web",
    });
    const state = ProductStateSchema.parse({});
    const fc = runFidelityCheck(spec, state);
    const failureIds = fc.failures.map((f) => f.id);
    // Without any signals these all fail; sanity-check at least 4 ids surface.
    expect(failureIds.length).toBeGreaterThanOrEqual(4);
    // Each failing entry has a human-readable question.
    for (const f of fc.failures) {
      expect(typeof f.question).toBe("string");
      expect(f.question.length).toBeGreaterThan(0);
    }
  });
});
