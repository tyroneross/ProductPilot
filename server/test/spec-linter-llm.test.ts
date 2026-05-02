/**
 * Spec linter — LLM-tier (Haiku) tests.
 *
 * Focus: the `lintSpec` async path that calls aiService.generateStructuredOutput.
 * Strategy: stub the AIService and the env key check, then assert that the linter
 *   - dispatches the call when a key is present,
 *   - filters hallucinated entity ids,
 *   - never emits severity='block' from the LLM tier (only deterministic blocks),
 *   - skips silently when no key is configured.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ProductStateSchema, SpecSchema } from "@shared/schema";

// We mock both the env key (so no real provider is hit) and the AIService
// instance the linter imports.
beforeEach(() => {
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = "test-key-12345";
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.unstubAllEnvs?.();
});

function buildSpec() {
  return SpecSchema.parse({
    id: "spec-llm",
    productName: "Mocked product",
    productDescription:
      "On-device runs locally; cloud sync optional. Designed to fail loudly when input is malformed.",
    platformTarget: "web",
    personas: [{ id: "per-1", name: "Solo runner", jobs: ["plan a route"] }],
    needs: [{ id: "need-1", title: "Plan a route quickly.", priority: "P0" }],
    features: [{ id: "feat-1", title: "Map waypoints", priority: "P0", needIds: ["need-1"] }],
    tests: [
      { id: "test-1", description: "Acceptance: plan a 10km route end-to-end.", needIds: ["need-1"], kind: "acceptance", testFramework: "Vitest" },
    ],
    nonGoals: [{ id: "ng-1", text: "No competitor parity.", because: "We differentiate on solo planning." }],
    risks: [{ id: "risk-1", text: "Map tile rate limit", mitigation: "Graceful degrade with cached tiles." }],
    uxFlows: [{ id: "flow-1", name: "First run", steps: ["open", "tap start"] }],
  });
}

function buildState() {
  return ProductStateSchema.parse({
    stanceBecauseClauses: [
      { id: "s-priv", category: "privacy_data", stance: "Local-first.", because: "Privacy and on-device matter." },
      { id: "s-cmp", category: "complexity", stance: "Simplify.", because: "Faster vs accuracy: speed wins." },
      { id: "s-cost", category: "cost", stance: "One-time purchase.", because: "Compete on price not on copy." },
    ],
  });
}

describe("spec-linter — LLM tier dispatch", () => {
  it("emits an info-severity issue when the LLM flags ambiguous_language", async () => {
    vi.doMock("../services/ai", async () => {
      const real = await vi.importActual<any>("../services/ai");
      return {
        ...real,
        aiService: {
          ...real.aiService,
          generateStructuredOutput: vi.fn(async () => [
            {
              category: "ambiguous_language",
              message: "Feature feat-1 'Map waypoints' implies a robust experience without naming what it must do.",
              refs: [{ kind: "feature", id: "feat-1" }],
            },
          ]),
        },
      };
    });
    const { lintSpec } = await import("../services/spec-linter");
    const result = await lintSpec({ spec: buildSpec(), productState: buildState() });
    const llmIssue = result.issues.find((i) => i.rule === "llm.ambiguous_language");
    expect(llmIssue).toBeDefined();
    expect(llmIssue?.severity).toBe("info");
    expect(llmIssue?.refs[0]?.id).toBe("feat-1");
    expect(result.llmRan).toBe(true);
  });

  it("emits a warn-severity issue when LLM flags unresolved_contradiction (never block)", async () => {
    vi.doMock("../services/ai", async () => {
      const real = await vi.importActual<any>("../services/ai");
      return {
        ...real,
        aiService: {
          ...real.aiService,
          generateStructuredOutput: vi.fn(async () => [
            {
              category: "unresolved_contradiction",
              message: "NonGoal ng-1 forbids competitor parity but Feature feat-1 is parity-seeking.",
              refs: [
                { kind: "non_goal", id: "ng-1" },
                { kind: "feature", id: "feat-1" },
              ],
            },
          ]),
        },
      };
    });
    const { lintSpec } = await import("../services/spec-linter");
    const result = await lintSpec({ spec: buildSpec(), productState: buildState() });
    const llmIssue = result.issues.find((i) => i.rule === "llm.unresolved_contradiction");
    expect(llmIssue).toBeDefined();
    expect(llmIssue?.severity).toBe("warn"); // NEVER 'block' from the LLM tier
  });

  it("emits no LLM issues when LLM returns []", async () => {
    vi.doMock("../services/ai", async () => {
      const real = await vi.importActual<any>("../services/ai");
      return {
        ...real,
        aiService: {
          ...real.aiService,
          generateStructuredOutput: vi.fn(async () => []),
        },
      };
    });
    const { lintSpec } = await import("../services/spec-linter");
    const result = await lintSpec({ spec: buildSpec(), productState: buildState() });
    expect(result.issues.find((i) => i.rule.startsWith("llm."))).toBeUndefined();
    expect(result.llmRan).toBe(true);
  });

  it("filters refs with hallucinated entity ids", async () => {
    vi.doMock("../services/ai", async () => {
      const real = await vi.importActual<any>("../services/ai");
      return {
        ...real,
        aiService: {
          ...real.aiService,
          generateStructuredOutput: vi.fn(async () => [
            {
              category: "ambiguous_language",
              message: "Some entity uses ambiguous language.",
              refs: [
                { kind: "feature", id: "ghost-not-in-spec" },
                { kind: "feature", id: "feat-1" }, // real
              ],
            },
          ]),
        },
      };
    });
    const { lintSpec } = await import("../services/spec-linter");
    const result = await lintSpec({ spec: buildSpec(), productState: buildState() });
    const llmIssue = result.issues.find((i) => i.rule === "llm.ambiguous_language");
    expect(llmIssue).toBeDefined();
    expect(llmIssue?.refs.map((r) => r.id)).toEqual(["feat-1"]);
  });

  it("skips the LLM tier silently when no key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.doMock("../services/ai", async () => {
      const real = await vi.importActual<any>("../services/ai");
      const generateStructuredOutput = vi.fn(async () => {
        throw new Error("should not have been called");
      });
      return {
        ...real,
        aiService: { ...real.aiService, generateStructuredOutput },
      };
    });
    const { lintSpec } = await import("../services/spec-linter");
    const result = await lintSpec({ spec: buildSpec(), productState: buildState(), llmConfig: null });
    expect(result.llmRan).toBe(false);
    expect(result.issues.find((i) => i.rule.startsWith("llm."))).toBeUndefined();
  });
});
