/**
 * Spec linter — per-platform deterministic rules.
 *
 * Verifies the cross-platform expansion (Phase 3 cross-platform addition,
 * 2026-05-02). For each platformTarget value, we assert:
 *   - a Test referencing the right framework passes,
 *   - a Test referencing the wrong framework fails with test_framework_platform_mismatch,
 *   - any platform-specific extras (iOS HIG, macOS HIG, claude-plugin manifest) trigger.
 */

import { describe, expect, it } from "vitest";
import { ProductStateSchema, SpecSchema, type Spec } from "@shared/schema";
import { lintSpecSync } from "../services/spec-linter";

function specForPlatform(platform: Spec["platformTarget"], extra: Partial<Spec> = {}): Spec {
  // A spec that meets the Stage-1 Fidelity threshold + non-platform deterministic rules,
  // so each test isolates the platform rule under inspection.
  const base: Spec = SpecSchema.parse({
    id: `spec-${platform}`,
    productName: `${platform} fixture`,
    productDescription:
      "On-device pipeline runs locally; cloud sync optional. Designed to fail loudly when input is malformed. Uses Dynamic Type and VoiceOver for accessibility. Menu-bar utility with NSStatusItem. plugin.json declares commands.",
    platformTarget: platform,
    personas: [{ id: "per-1", name: "Solo runner", jobs: ["plan a route"] }],
    needs: [{ id: "need-1", title: "Plan a route quickly.", priority: "P0" }],
    features: [],
    uxFlows: [{ id: "flow-1", name: "First run", steps: ["open", "tap start"] }],
    screens: [],
    dataPoints: [],
    integrations: [],
    apiContracts: [],
    tests: [],
    adrs: [],
    assumptions: [],
    risks: [
      { id: "risk-1", text: "Tile rate limit", mitigation: "Graceful degrade with cached fallback." },
    ],
    nonGoals: [{ id: "ng-1", text: "No competitor parity.", because: "We differentiate on solo planning." }],
    ...extra,
  });
  return base;
}

const fullState = ProductStateSchema.parse({
  stanceBecauseClauses: [
    { id: "s-priv", category: "privacy_data", stance: "Local-first.", because: "Privacy on-device matters." },
    { id: "s-cmp", category: "complexity", stance: "Simplify.", because: "Speed beats accuracy in onboarding." },
    { id: "s-cost", category: "cost", stance: "One-time purchase.", because: "Compete with cheaper copy-cat features." },
  ],
});

describe("spec-linter — platform: web", () => {
  it("passes a Test that names Vitest", () => {
    const spec = specForPlatform("web", {
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "Vitest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeUndefined();
  });
});

describe("spec-linter — platform: vite-spa", () => {
  it("passes Vitest", () => {
    const spec = specForPlatform("vite-spa", {
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "Vitest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeUndefined();
  });

  it("rejects Jest (vite-spa accepts only Vitest or Playwright)", () => {
    const spec = specForPlatform("vite-spa", {
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "Jest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeDefined();
  });
});

describe("spec-linter — platform: ios", () => {
  it("rejects an iOS spec that lists Vitest", () => {
    const spec = specForPlatform("ios", {
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "Vitest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeDefined();
  });

  it("accepts XCTest", () => {
    const spec = specForPlatform("ios", {
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "XCTest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeUndefined();
  });

  it("blocks when the iOS HIG accessibility notes are missing", () => {
    const spec = specForPlatform("ios", {
      // Strip Dynamic Type + VoiceOver mentions from the description.
      productDescription: "Local-first iOS journaling. Fails loudly on malformed input.",
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "XCTest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "ios.accessibility_notes")).toBeDefined();
  });
});

describe("spec-linter — platform: macos", () => {
  it("accepts Swift Testing", () => {
    const spec = specForPlatform("macos", {
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "Swift Testing", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeUndefined();
  });

  it("blocks when window-management/menu-bar conventions are missing", () => {
    const spec = specForPlatform("macos", {
      productDescription: "A simple macOS app. Local-first, fails loudly when input invalid.",
      tests: [
        { id: "t-1", description: "x", needIds: ["need-1"], featureIds: [], kind: "acceptance", testFramework: "XCTest", validatorRefs: [] },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "macos.window_management_notes")).toBeDefined();
  });
});

describe("spec-linter — platform: claude-plugin", () => {
  it("accepts plugin-builder validator references", () => {
    const spec = specForPlatform("claude-plugin", {
      tests: [
        {
          id: "t-1",
          description: "manifest validates",
          needIds: ["need-1"],
          featureIds: [],
          kind: "acceptance",
          testFramework: "manifest-validator",
          validatorRefs: ["manifest-validator", "command-validator"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeUndefined();
    expect(result.issues.find((i) => i.rule === "claude_plugin.validator_ref_missing")).toBeUndefined();
  });

  it("rejects Vitest for a claude-plugin spec", () => {
    const spec = specForPlatform("claude-plugin", {
      tests: [
        {
          id: "t-1",
          description: "x",
          needIds: ["need-1"],
          featureIds: [],
          kind: "acceptance",
          testFramework: "Vitest",
          validatorRefs: [],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "test_framework_platform_mismatch")).toBeDefined();
  });

  it("blocks when no plugin manifest is referenced anywhere", () => {
    const spec = specForPlatform("claude-plugin", {
      productDescription: "A generic developer plugin. Uses local resources only.",
      // no integrations, no ADR mentioning manifest, no nonGoal mentioning manifest
      integrations: [],
      adrs: [],
      nonGoals: [{ id: "ng-1", text: "No telemetry", because: "Privacy stance: data stays local." }],
      tests: [
        {
          id: "t-1",
          description: "x",
          needIds: ["need-1"],
          featureIds: [],
          kind: "acceptance",
          testFramework: "manifest-validator",
          validatorRefs: ["manifest-validator"],
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    expect(result.issues.find((i) => i.rule === "claude_plugin.manifest_required")).toBeDefined();
  });

  it("warns when a Test is missing validatorRefs[]", () => {
    const spec = specForPlatform("claude-plugin", {
      tests: [
        {
          id: "t-1",
          description: "x",
          needIds: ["need-1"],
          featureIds: [],
          kind: "acceptance",
          testFramework: "manifest-validator",
          validatorRefs: [], // empty — should warn
        },
      ],
    });
    const result = lintSpecSync({ spec, productState: fullState });
    const issue = result.issues.find((i) => i.rule === "claude_plugin.validator_ref_missing");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warn");
  });
});
