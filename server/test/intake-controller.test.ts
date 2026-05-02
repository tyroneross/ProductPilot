/**
 * Phase 2 — IntakeController golden tests.
 *
 * Asserts:
 *   1. deriveCandidateUnknowns produces the expected topics for thin/medium/full ProductState.
 *   2. deterministicMethodRoute returns the expected method per the rule table.
 *   3. nextStep wires the deterministic route to the LLM-mocked sub-calls and returns the right action.
 *
 * Strategy: mock aiService.generateStructuredOutput at the module boundary so the test never
 * touches a real provider. Each method (jtbd / qfd / pugh) gets one golden case.
 */

import { describe, expect, it, vi } from "vitest";
import { ProductStateSchema, SpecSchema, type ProductState, type Spec } from "@shared/schema";

// Mock aiService BEFORE importing the controller.
vi.mock("../services/ai", () => {
  return {
    aiService: {
      generateStructuredOutput: vi.fn(),
    },
  };
});

import { aiService } from "../services/ai";
import {
  deriveCandidateUnknowns,
  deterministicMethodRoute,
  nextStep,
  hydrateProductState,
  hydrateSpec,
} from "../services/intake-controller";

const generateStructuredOutputMock = aiService.generateStructuredOutput as ReturnType<typeof vi.fn>;

function thinSpec(): Spec {
  return SpecSchema.parse({
    id: "spec-thin",
    productName: "TestProduct",
    productDescription: "Thin spec — no personas, no features.",
  });
}

function fullSpec(): Spec {
  return SpecSchema.parse({
    id: "spec-full",
    productName: "TestProduct",
    productDescription: "Full spec — personas locked, features pending QFD weights.",
    personas: [
      {
        id: "p1",
        name: "Engineering manager",
        trigger: "When their sprint planning hits the 30-minute mark and stalls",
        exclusions: ["Not enterprise IT", "Not casual hobbyists", "Not customization-seekers"],
        jobs: ["Run a faster, more focused planning session"],
      },
    ],
    scenarios: [
      {
        id: "s1",
        personaId: "p1",
        context: "Tuesday morning, 9 unread Slack threads",
        goal: "After 3 weeks of daily use, the EM closes Slack within 10 minutes of opening it on 4 of 5 weekdays.",
        successSignal: "Slack-open-to-close interval < 10 min on 4/5 weekdays for 3 consecutive weeks",
      },
    ],
    needs: [
      { id: "n1", title: "Reduce planning time", priority: "P0" },
    ],
    features: [
      { id: "f1", title: "Async standup digest", priority: "P0", needIds: ["n1"], acceptanceCriteria: [] },
    ],
    nonGoals: [{ id: "ng1", text: "No real-time chat", because: "Async-first reduces synchronous overhead." }],
  });
}

function spawnPughSpec(): Spec {
  // Two ADRs in pending state → Rule 2 → pugh.
  const base = fullSpec();
  return {
    ...base,
    adrs: [
      { id: "a1", title: "Storage choice", context: "...", decision: "decision pending", reversibility: "low", consequences: undefined, cites: [] },
      { id: "a2", title: "Hosting", context: "...", decision: "pending", reversibility: "low", consequences: undefined, cites: [] },
    ],
  };
}

const baseState: ProductState = ProductStateSchema.parse({});

describe("deriveCandidateUnknowns", () => {
  it("flags primary_persona_and_trigger when personas is empty", () => {
    const out = deriveCandidateUnknowns({ productState: baseState, spec: thinSpec() });
    expect(out.find((c) => c.topic === "primary_persona_and_trigger")).toBeDefined();
  });

  it("flags stance_because_* for missing categories", () => {
    const out = deriveCandidateUnknowns({ productState: baseState, spec: thinSpec() });
    expect(out.some((c) => c.topic === "stance_because_privacy_data")).toBe(true);
    expect(out.some((c) => c.topic === "stance_because_complexity")).toBe(true);
    expect(out.some((c) => c.topic === "stance_because_cost")).toBe(true);
  });

  it("does NOT flag persona gaps when personas are populated with triggers + exclusions", () => {
    const out = deriveCandidateUnknowns({ productState: baseState, spec: fullSpec() });
    expect(out.some((c) => c.topic === "primary_persona_and_trigger")).toBe(false);
    expect(out.some((c) => c.topic === "missing_persona_trigger")).toBe(false);
  });
});

describe("deterministicMethodRoute", () => {
  it("returns 'jtbd' when personas are empty (Rule 1)", () => {
    const method = deterministicMethodRoute({
      productState: baseState,
      spec: thinSpec(),
      candidates: [],
    });
    expect(method).toBe("jtbd");
  });

  it("returns 'pugh' when ≥2 ADRs are pending (Rule 2)", () => {
    const method = deterministicMethodRoute({
      productState: baseState,
      spec: spawnPughSpec(),
      candidates: [],
    });
    expect(method).toBe("pugh");
  });

  it("returns 'qfd' when features exist and tradeoff weights are populated (Rule 3)", () => {
    const stateWithWeights = ProductStateSchema.parse({
      tradeoffWeights: { speed_to_alpha: 30, scalability: 20, ux_polish: 10, maintainability: 20, cost: 10, security: 10 },
    });
    const method = deterministicMethodRoute({
      productState: stateWithWeights,
      spec: fullSpec(),
      candidates: [],
    });
    expect(method).toBe("qfd");
  });
});

describe("nextStep — golden flows", () => {
  it("JTBD: thin spec → ASK with method=jtbd", async () => {
    // Mock blocking-scorer to return one high-blocking row → triggers ASK path.
    // Mock method-generator (jtbd) to return a question.
    generateStructuredOutputMock.mockReset();
    generateStructuredOutputMock
      // 1st call: blocking-scorer
      .mockResolvedValueOnce([
        { topic: "primary_persona_and_trigger", evidence: 0, reversibility: 1, risk: 4, blocking: 13, decision: "ask", reason: "no personas yet" },
      ])
      // 2nd call: method generator (jtbd) — deterministic router picks jtbd, no router call needed.
      .mockResolvedValueOnce({
        method: "jtbd",
        question: "When does someone realize they need this?",
        rule_fired: "1",
        chips: ["Right after a sales call", "When inbox crosses 50", "End of every sprint"],
        extracts_into: { spec_path: "personas[*].trigger", kind: "string", merge_strategy: "append" },
        intent: "rule 1 — personas empty",
      });

    const action = await nextStep({
      productState: baseState,
      spec: thinSpec(),
      history: [],
    });

    expect(action.action).toBe("ask");
    if (action.action !== "ask") return; // type guard
    expect(action.method).toBe("jtbd");
    expect(action.question.text).toContain("When does someone realize");
    expect(action.scoring[0].blocking).toBeGreaterThanOrEqual(6);
  });

  it("PUGH: full spec with 2 pending ADRs → ASK with method=pugh", async () => {
    generateStructuredOutputMock.mockReset();
    generateStructuredOutputMock
      .mockResolvedValueOnce([
        { topic: "pending_architecture_decisions:2", evidence: 1, reversibility: 0, risk: 4, blocking: 13, decision: "ask", reason: "two ADRs pending" },
      ])
      .mockResolvedValueOnce({
        method: "pugh",
        passthrough: false,
        question: "Compared to Storage A, does Storage B do better on security?",
        cell: { alternativeId: "a2", baselineId: "a1", criterion: "security" },
        chips: ["Better (+)", "Same (0)", "Worse (-)"],
        extracts_into: { spec_path: "adrs[*].cites", kind: "pugh_cell", merge_strategy: "score_map" },
        intent: "rule fired — pending ADRs",
        rule_fired: "1",
      });

    const action = await nextStep({
      productState: baseState,
      spec: spawnPughSpec(),
      history: [],
    });

    expect(action.action).toBe("ask");
    if (action.action !== "ask") return;
    expect(action.method).toBe("pugh");
    expect(action.question.chips).toContain("Better (+)");
  });

  it("QFD: full spec with weights populated → ASK with method=qfd", async () => {
    const stateWithWeights = ProductStateSchema.parse({
      tradeoffWeights: { speed_to_alpha: 30, scalability: 20, ux_polish: 10, maintainability: 20, cost: 10, security: 10 },
    });
    // fullSpec has personas + features — the only candidate the deriver flags is non_goals (it
    // has 1) — wait, fullSpec includes a non-goal. Force a candidate by passing a spec without
    // P0 needs. Actually fullSpec needs[0] is P0. So the deriver should flag stance_because_*
    // categories (state has empty stanceBecauseClauses).
    generateStructuredOutputMock.mockReset();
    generateStructuredOutputMock
      .mockResolvedValueOnce([
        { topic: "stance_because_privacy_data", evidence: 0, reversibility: 2, risk: 4, blocking: 11, decision: "ask", reason: "no privacy stance yet" },
      ])
      .mockResolvedValueOnce({
        method: "qfd",
        passthrough: false,
        question: "For Engineering manager, when they Reduce planning time, how much does Async standup digest help?",
        triplet: { personaId: "p1", needId: "n1", featureId: "f1" },
        chips: ["High — core to the job", "Medium — useful but not essential", "Low — nice-to-have only", "Not at all"],
        extracts_into: { spec_path: "features[*].acceptanceCriteria", kind: "weight", merge_strategy: "weight_map" },
        intent: "weights populated; first triplet",
        rule_fired: "1",
      });

    const action = await nextStep({
      productState: stateWithWeights,
      spec: fullSpec(),
      history: [],
    });

    expect(action.action).toBe("ask");
    if (action.action !== "ask") return;
    expect(action.method).toBe("qfd");
    expect(action.question.chips).toHaveLength(4);
  });

  it("DONE: empty candidates list when spec is fully populated and stance is set", async () => {
    const richState = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s1", category: "privacy_data", stance: "We do not store user audio", because: "trust is the moat" },
        { id: "s2", category: "complexity", stance: "Single-pane UI", because: "users are not power users" },
        { id: "s3", category: "cost", stance: "Free tier first 30 days", because: "low ARPU early" },
      ],
    });
    const action = await nextStep({
      productState: richState,
      spec: fullSpec(),
      history: [{ step: 1, method: "jtbd", question: "trigger?", answer: "answered" }],
    });
    expect(action.action).toBe("done");
  });
});

describe("hydrateProductState / hydrateSpec", () => {
  it("returns defaults when given null", () => {
    const ps = hydrateProductState(null);
    expect(ps.workingMemory).toEqual({});
    expect(ps.stanceBecauseClauses).toEqual([]);
  });

  it("returns a usable Spec stub when given null", () => {
    const spec = hydrateSpec(null, "spec-test", "Test", "Test desc");
    expect(spec.id).toBe("spec-test");
    expect(spec.personas).toEqual([]);
  });
});
