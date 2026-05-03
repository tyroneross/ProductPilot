/**
 * JTBD slot-dedup in the controller (2026-05-02).
 *
 * Background:
 *   Adaptive eval median sat at 7 questions even after the state-advance fix
 *   because the JTBD prompt — running on Groq's 8B model (llama-3.1-8b-instant)
 *   — was unstable across archetypes in deciding which JTBD slot to ask next.
 *   Yesterday's prompt-only attempt landed no-op at the median and regressed
 *   pp-02 + pp-04 (the model picked slots whose answers the fixture's
 *   discovery script didn't have). Reverted.
 *
 * What this file asserts:
 *   1. Same-slot JTBD candidate from consecutive turns is filtered after first answer.
 *   2. Different-slot JTBD candidates pass through (no over-filtering).
 *   3. Multi-method runs: a QFD candidate is not affected by JTBD slot tracking.
 *   4. askedJtbdSlots persists across ingestAnswer → nextStep cycles.
 *   5. Repeated ingestAnswer for the same slot doesn't double-append.
 *   6. Unmapped JTBD topic logs warning, doesn't crash, and is recorded in
 *      workingMemory.unmappedJtbdTopics.
 *
 * Strategy: most cases are pure-function — ingestAnswer + jtbdSlotForCandidate
 * are deterministic and synchronous. nextStep is exercised through the mocked
 * aiService.generateStructuredOutput boundary used elsewhere in the suite.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ProductStateSchema,
  SpecSchema,
  type ProductState,
  type Spec,
} from "@shared/schema";

// Mock aiService BEFORE importing the controller (mirror pattern of intake-controller.test.ts).
vi.mock("../services/ai", () => {
  return {
    aiService: {
      generateStructuredOutput: vi.fn(),
    },
  };
});

import { aiService } from "../services/ai";
import {
  ingestAnswer,
  jtbdSlotForCandidate,
  readAskedJtbdSlots,
  nextStep,
  type JtbdSlot,
} from "../services/intake-controller";

const generateStructuredOutputMock = aiService.generateStructuredOutput as ReturnType<typeof vi.fn>;

const BASE_STATE: ProductState = ProductStateSchema.parse({});
const THIN_SPEC: Spec = SpecSchema.parse({
  id: "spec-slot-dedup",
  productName: "TestProduct",
  productDescription: "Verifies slot-dedupe across turns.",
});

// ---------------------------------------------------------------------------
// Pure mapping table — confirms the slot enumeration we ship.
// ---------------------------------------------------------------------------

describe("jtbdSlotForCandidate", () => {
  it("maps known JTBD topics to their slots", () => {
    expect(jtbdSlotForCandidate({ topic: "primary_persona_and_trigger" })).toBe("persona");
    expect(jtbdSlotForCandidate({ topic: "missing_persona_trigger" })).toBe("trigger");
    expect(jtbdSlotForCandidate({ topic: "persona_exclusions" })).toBe("exclusions");
    expect(jtbdSlotForCandidate({ topic: "measurable_outcome" })).toBe("outcome");
    expect(jtbdSlotForCandidate({ topic: "non_goals" })).toBe("non_goals");
    expect(jtbdSlotForCandidate({ topic: "p0_need_designation" })).toBe("priority");
  });

  it("returns null for non-JTBD topics (stance, ADRs)", () => {
    expect(jtbdSlotForCandidate({ topic: "stance_because_privacy_data" })).toBeNull();
    expect(jtbdSlotForCandidate({ topic: "pending_architecture_decisions:2" })).toBeNull();
  });

  it("falls back to spec_path when topic is missing", () => {
    expect(jtbdSlotForCandidate({ specPath: "personas[*].name" })).toBe("persona");
    expect(jtbdSlotForCandidate({ specPath: "personas[*].trigger" })).toBe("trigger");
    expect(jtbdSlotForCandidate({ specPath: "personas[*].exclusions" })).toBe("exclusions");
    expect(jtbdSlotForCandidate({ specPath: "personas[*].jobs" })).toBe("jobs");
    expect(jtbdSlotForCandidate({ specPath: "scenarios[*].goal" })).toBe("outcome");
    expect(jtbdSlotForCandidate({ specPath: "scenarios[*].successSignal" })).toBe("outcome");
  });

  it("returns null when neither topic nor spec_path resolves", () => {
    expect(jtbdSlotForCandidate({})).toBeNull();
    expect(jtbdSlotForCandidate({ topic: "garbage_topic_made_up" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ingestAnswer slot-tracking
// ---------------------------------------------------------------------------

describe("ingestAnswer — JTBD slot tracking", () => {
  it("appends the persona slot when a JTBD persona-name answer lands", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "p",
        step: 1,
        questionText: "Who is your primary user?",
        answer: "Senior PMs at mid-market SaaS",
        method: "jtbd",
        metadata: {
          topic: "primary_persona_and_trigger",
          extracts_into: { spec_path: "personas[*].name" },
        },
      },
    });

    expect(readAskedJtbdSlots(productState)).toContain("persona");
  });

  it("repeated ingestAnswer for the same slot does not double-append", () => {
    let state = BASE_STATE;
    for (let i = 1; i <= 3; i++) {
      const { productState } = ingestAnswer({
        state,
        answer: {
          projectId: "p",
          step: i,
          questionText: "Who?",
          answer: `Engineering managers ${i}`,
          method: "jtbd",
          metadata: {
            topic: "primary_persona_and_trigger",
            extracts_into: { spec_path: "personas[*].name" },
          },
        },
      });
      state = productState;
    }
    const slots = readAskedJtbdSlots(state);
    expect(slots.filter((s) => s === "persona")).toHaveLength(1);
  });

  it("non-JTBD methods do not add to askedJtbdSlots", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "p",
        step: 1,
        questionText: "How much does feature X help?",
        answer: "High",
        method: "qfd",
        metadata: {
          extracts_into: { spec_path: "features[*].acceptanceCriteria" },
        },
      },
    });
    expect(readAskedJtbdSlots(productState)).toEqual([]);
  });

  it("unmapped JTBD topic warns and records under unmappedJtbdTopics without crashing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { productState } = ingestAnswer({
        state: BASE_STATE,
        answer: {
          projectId: "p",
          step: 1,
          questionText: "Free-form JTBD-ish question",
          answer: "Some answer",
          method: "jtbd",
          metadata: { topic: "totally_invented_topic_no_slot_for_this" },
        },
      });

      expect(productState.workingMemory.unmappedJtbdTopics).toBeDefined();
      const recorded = productState.workingMemory.unmappedJtbdTopics as string[];
      expect(recorded).toContain("totally_invented_topic_no_slot_for_this");
      expect(readAskedJtbdSlots(productState)).toEqual([]);
      // Warning includes the topic name and references the workingMemory key.
      expect(warnSpy).toHaveBeenCalled();
      const warnArg = String(warnSpy.mock.calls[0]?.[0] ?? "");
      expect(warnArg).toContain("totally_invented_topic_no_slot_for_this");
      expect(warnArg).toContain("unmappedJtbdTopics");
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// nextStep dedup wiring
// ---------------------------------------------------------------------------

describe("nextStep — slot-dedup pruning", () => {
  beforeEach(() => {
    generateStructuredOutputMock.mockReset();
  });
  afterEach(() => {
    generateStructuredOutputMock.mockReset();
  });

  it("does NOT re-emit a JTBD candidate whose slot was already answered", async () => {
    // Stage: simulate a state where the persona slot has been asked-and-answered.
    const { productState: afterPersonaTurn } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "p",
        step: 1,
        questionText: "Who is your primary user?",
        answer: "Senior PMs at mid-market SaaS",
        method: "jtbd",
        metadata: {
          topic: "primary_persona_and_trigger",
          extracts_into: { spec_path: "personas[*].name" },
        },
      },
    });

    // Sanity: the slot is recorded.
    expect(readAskedJtbdSlots(afterPersonaTurn)).toContain("persona");

    // Now the underlying spec still has no formal trigger / exclusions, so
    // deriveCandidateUnknowns will emit topics that DO map to other JTBD
    // slots (missing_persona_trigger → trigger, persona_exclusions →
    // exclusions). Those should pass through dedup. But because the persona
    // we just answered created intakeSpec.personas[0] without a trigger, the
    // controller will derive candidates for trigger/exclusions/stance/etc.
    // None of those should be the persona slot.

    // Mock the scorer to return the candidate it's given (controller recomputes
    // blocking deterministically). We only need to inspect what reaches it.
    let scorerSawCandidates: Array<{ topic: string; why_it_matters: string }> = [];
    generateStructuredOutputMock.mockImplementationOnce(async (_messages, _model, _config, _kind, _ctx) => {
      // The scorer call is the first call inside nextStep after deriveCandidateUnknowns.
      // The user payload is the second message; we read what it received.
      const userMsg = _messages.find((m: { role: string }) => m.role === "user");
      const parsed = JSON.parse(userMsg.content);
      scorerSawCandidates = parsed.candidates ?? [];
      // Return one row per candidate with low-blocking so we route to INFER (avoids method-gen call).
      return parsed.candidates.map((c: { topic: string }) => ({
        topic: c.topic,
        evidence: 4,
        reversibility: 4,
        risk: 1,
        blocking: 0, // overridden by controller
        decision: "infer",
        reason: "test",
      }));
    });
    // safeDefaultsInferer is the second call when blocking < threshold.
    generateStructuredOutputMock.mockResolvedValueOnce([]);

    await nextStep({
      productState: afterPersonaTurn,
      spec: THIN_SPEC,
      history: [{ step: 1, method: "jtbd", question: "Who?", answer: "Senior PMs" }],
    });

    // The scorer should NOT have been asked about a candidate whose JTBD slot is "persona".
    const personaCandidates = scorerSawCandidates.filter(
      (c) => jtbdSlotForCandidate({ topic: c.topic }) === "persona",
    );
    expect(personaCandidates).toEqual([]);
  });

  it("different-slot JTBD candidates pass through unchanged", async () => {
    // No prior asked slots — scorer should see the full candidate set.
    let scorerSawCandidates: Array<{ topic: string; why_it_matters: string }> = [];
    generateStructuredOutputMock.mockImplementationOnce(async (_messages) => {
      const userMsg = _messages.find((m: { role: string }) => m.role === "user");
      const parsed = JSON.parse(userMsg.content);
      scorerSawCandidates = parsed.candidates ?? [];
      return parsed.candidates.map((c: { topic: string }) => ({
        topic: c.topic,
        evidence: 4,
        reversibility: 4,
        risk: 1,
        blocking: 0,
        decision: "infer",
        reason: "test",
      }));
    });
    generateStructuredOutputMock.mockResolvedValueOnce([]);

    await nextStep({
      productState: BASE_STATE,
      spec: THIN_SPEC,
      history: [],
    });

    // Thin spec with empty state derives at least primary_persona_and_trigger
    // plus stance_because_* topics. Confirm persona candidate is present
    // (i.e. dedup did not over-prune).
    expect(
      scorerSawCandidates.some((c) => c.topic === "primary_persona_and_trigger"),
    ).toBe(true);
  });

  it("askedJtbdSlots persists across ingestAnswer → nextStep cycles", async () => {
    // Cycle 1: ingest a persona answer.
    const { productState: afterT1 } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "p",
        step: 1,
        questionText: "Who?",
        answer: "Senior PMs",
        method: "jtbd",
        metadata: {
          topic: "primary_persona_and_trigger",
          extracts_into: { spec_path: "personas[*].name" },
        },
      },
    });
    expect(readAskedJtbdSlots(afterT1)).toEqual(["persona"]);

    // Cycle 2: run nextStep — slot tracking must be readable from the same state.
    generateStructuredOutputMock.mockResolvedValueOnce([]);
    generateStructuredOutputMock.mockResolvedValueOnce([]);
    await nextStep({
      productState: afterT1,
      spec: THIN_SPEC,
      history: [{ step: 1, method: "jtbd", question: "Who?", answer: "Senior PMs" }],
    });
    // afterT1 was not mutated by nextStep; the ledger persists in the same object.
    expect(readAskedJtbdSlots(afterT1)).toEqual(["persona"]);

    // Cycle 3: ingest a trigger answer. Both slots now present.
    const { productState: afterT2 } = ingestAnswer({
      state: afterT1,
      answer: {
        projectId: "p",
        step: 2,
        questionText: "When?",
        answer: "After their inbox crosses 50",
        method: "jtbd",
        metadata: {
          topic: "missing_persona_trigger",
          extracts_into: { spec_path: "personas[*].trigger" },
        },
      },
    });
    expect(readAskedJtbdSlots(afterT2).sort()).toEqual(["persona", "trigger"]);
  });

  it("QFD candidates are unaffected by JTBD slot tracking", async () => {
    // Force a state with all JTBD slots already asked (extreme over-saturation).
    const allSlots: JtbdSlot[] = [
      "persona", "trigger", "exclusions", "outcome", "jobs", "non_goals", "priority",
    ];
    const stateWithAllSlots: ProductState = ProductStateSchema.parse({
      ...BASE_STATE,
      workingMemory: { askedJtbdSlots: allSlots },
    });

    let scorerSawCandidates: Array<{ topic: string; why_it_matters: string }> = [];
    generateStructuredOutputMock.mockImplementationOnce(async (_messages) => {
      const userMsg = _messages.find((m: { role: string }) => m.role === "user");
      const parsed = JSON.parse(userMsg.content);
      scorerSawCandidates = parsed.candidates ?? [];
      return parsed.candidates.map((c: { topic: string }) => ({
        topic: c.topic,
        evidence: 4,
        reversibility: 4,
        risk: 1,
        blocking: 0,
        decision: "infer",
        reason: "test",
      }));
    });
    generateStructuredOutputMock.mockResolvedValueOnce([]);

    // Use a thin spec — deriver still emits stance_because_* (QFD/non-JTBD).
    await nextStep({
      productState: stateWithAllSlots,
      spec: THIN_SPEC,
      history: [],
    });

    // Stance topics map to no slot → they survive dedup even though every JTBD
    // slot is exhausted. This is the proof that dedup is JTBD-only.
    const stanceCandidates = scorerSawCandidates.filter((c) =>
      c.topic.startsWith("stance_because_"),
    );
    expect(stanceCandidates.length).toBeGreaterThan(0);
  });

  it("when all JTBD candidates are pruned and no other candidates remain, controller gracefully handles it", async () => {
    // State with persona + trigger + exclusions all asked, and a spec that has
    // no other gaps (full personas, scenarios, stance, weights). The controller
    // must not crash; it should reach the allocate_tradeoffs or done gate.
    const fullSpec: Spec = SpecSchema.parse({
      id: "spec-saturated",
      productName: "TestProduct",
      productDescription: "Fully populated spec with no remaining gaps.",
      personas: [
        {
          id: "p1",
          name: "Engineering manager",
          trigger: "When sprint planning stalls",
          exclusions: ["Not enterprise IT", "Not casual hobbyists", "Not customization-seekers"],
          jobs: ["Run a faster planning session"],
        },
      ],
      scenarios: [
        {
          id: "s1",
          personaId: "p1",
          context: "Tuesday morning",
          goal: "Reduce planning time from 60 to 30 minutes within 2 weeks",
          successSignal: "Planning time < 30 min on 4 of 5 sessions",
        },
      ],
      needs: [{ id: "n1", title: "Reduce planning time", priority: "P0" }],
      features: [{ id: "f1", title: "Async digest", priority: "P0", needIds: ["n1"], acceptanceCriteria: [] }],
      nonGoals: [{ id: "ng1", text: "No real-time chat", because: "Async-first." }],
    });
    const richState: ProductState = ProductStateSchema.parse({
      stanceBecauseClauses: [
        { id: "s1", category: "privacy_data", stance: "No audio storage", because: "trust" },
        { id: "s2", category: "complexity", stance: "Single-pane UI", because: "non-power users" },
        { id: "s3", category: "cost", stance: "Free 30 days", because: "low ARPU early" },
      ],
      workingMemory: {
        askedJtbdSlots: ["persona", "trigger", "exclusions", "outcome", "non_goals"],
      },
    });

    const action = await nextStep({
      productState: richState,
      spec: fullSpec,
      history: [{ step: 1, method: "jtbd", question: "Q", answer: "A" }],
    });

    // No tradeoff weights yet → allocate_tradeoffs is the right next move.
    expect(["allocate_tradeoffs", "done"]).toContain(action.action);
  });
});
