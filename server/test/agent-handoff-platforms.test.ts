/**
 * Phase 5 — agent-handoff platform-specific test scaffolding.
 *
 * One test per platform (web, vite-spa, ios, macos, claude-plugin). Each
 * asserts that the test scaffolding section emits the right framework
 * instruction + the right Need→Test mapping shape for that platform.
 *
 * Fixtures stay minimal — we set platformTarget + a single P0 Need + a
 * single Test with a platform-appropriate testFramework value, then check
 * the rendered scaffolding block.
 */

import { describe, expect, it } from "vitest";
import {
  SpecSchema,
  ProductStateSchema,
  type Spec,
  type ProductState,
  type PlatformTarget,
} from "@shared/schema";
import { generateHandoff } from "../services/agent-handoff";

function buildSpecForPlatform(
  platformTarget: PlatformTarget,
  testFramework: string,
  validatorRefs: string[] = [],
): Spec {
  return SpecSchema.parse({
    id: `spec-${platformTarget}`,
    productName: `${platformTarget} sample`,
    productDescription: `Minimal fixture for ${platformTarget} test scaffolding. Mentions Dynamic Type and VoiceOver and menu bar and toolbar so platform extras pass.`,
    platformTarget,
    needs: [
      {
        id: "U-12",
        title: "Users can complete the primary task",
        description: "Primary user-flow path.",
        priority: "P0",
      },
    ],
    tests: [
      {
        id: "T-19",
        description: "Primary task acceptance test",
        needIds: ["U-12"],
        featureIds: [],
        kind: "acceptance",
        testFramework,
        validatorRefs,
      },
    ],
    adrs: [],
    dataPoints: [],
    nonGoals: [],
    apiContracts: [],
    integrations: [],
    uxFlows: [],
    screens: [],
    personas: [],
    scenarios: [],
    features: [],
    assumptions: [],
    risks: [],
  });
}

const baseProductState: ProductState = ProductStateSchema.parse({
  version: 1,
  stanceBecauseClauses: [],
  pivotLog: [],
  tradeoffWeights: {
    speed_to_alpha: 30,
    scalability: 15,
    ux_polish: 15,
    maintainability: 20,
    cost: 10,
    security: 10,
    unacceptable_tradeoff: "security",
  },
  workingMemory: {},
});

describe("agent-handoff platform scaffolding", () => {
  it("web → references Vitest and `<repo>/test/` placement", () => {
    const out = generateHandoff(buildSpecForPlatform("web", "Vitest"), baseProductState);
    expect(out).toContain("## Test scaffolding — web (Vitest)");
    expect(out).toContain("Run `npm run test` (Vitest).");
    expect(out).toContain("`<repo>/test/`");
    expect(out).toMatch(/Need\s+`U-12`.*Test\s+`T-19`/s);
    expect(out).toContain("npm run test -- T-19");
  });

  it("vite-spa → references Vitest preferred + colocated tests", () => {
    const out = generateHandoff(buildSpecForPlatform("vite-spa", "Vitest"), baseProductState);
    expect(out).toContain("## Test scaffolding — vite-spa (Vitest, optional Playwright)");
    expect(out).toContain("Vitest preferred");
    expect(out).toContain("colocated");
    expect(out).toContain("Need `U-12`");
  });

  it("ios → references Swift Testing + xcodebuild + accessibility hooks", () => {
    const out = generateHandoff(buildSpecForPlatform("ios", "Swift Testing"), baseProductState);
    expect(out).toContain("## Test scaffolding — ios (Swift Testing + XCTest)");
    expect(out).toContain("xcodebuild test");
    expect(out).toContain("Swift Testing's `@Test` macro");
    expect(out).toContain("Dynamic Type");
    expect(out).toContain("VoiceOver");
    expect(out).toMatch(/-only-testing:<Scheme>Tests\/T-19/);
  });

  it("macos → references Swift Testing + menu-bar / toolbar / window-management notes", () => {
    const out = generateHandoff(buildSpecForPlatform("macos", "XCTest"), baseProductState);
    expect(out).toContain("## Test scaffolding — macos (Swift Testing + XCTest)");
    expect(out).toContain("xcodebuild test");
    expect(out).toContain("menu-bar");
    expect(out).toMatch(/toolbar/i);
    expect(out).toMatch(/window-management/i);
    expect(out).toMatch(/-only-testing:<Scheme>Tests\/T-19/);
  });

  it("claude-plugin → references plugin-builder validators and validatorRefs", () => {
    const out = generateHandoff(
      buildSpecForPlatform("claude-plugin", "plugin-builder", ["manifest-validator", "skill-validator"]),
      baseProductState,
    );
    expect(out).toContain("## Test scaffolding — claude-plugin (plugin-builder validators)");
    expect(out).toContain("plugin.json");
    expect(out).toContain("manifest-validator");
    expect(out).toContain("skill-validator");
    expect(out).toContain("RossLabs-AI-Toolkit/plugins/plugin-builder");
    // Need→Test line surfaces validatorRefs for this platform.
    expect(out).toMatch(/Need\s+`U-12`.*Test\s+`T-19`.*validators:/s);
  });

  it("flags claude-plugin Test with no validatorRefs (linter warning case)", () => {
    const out = generateHandoff(
      buildSpecForPlatform("claude-plugin", "plugin-builder", []),
      baseProductState,
    );
    expect(out).toContain("no validatorRefs declared (linter warning)");
  });
});
