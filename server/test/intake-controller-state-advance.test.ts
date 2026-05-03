/**
 * State-advance fix (2026-05-02) — verifies that ingestAnswer promotes user
 * answers into structured spec slices so deriveCandidateUnknowns sees the
 * loop progressing turn over turn.
 *
 * Background:
 *   The first live Groq adaptive eval (commit 2415b0b) hit median
 *   questions_asked=9 across 9 fixtures because the controller wrote answers
 *   only to workingMemory.intakeAnswers[] and never into spec.personas /
 *   scenarios / nonGoals / stanceBecauseClauses. The candidate deriver re-emitted
 *   the same gaps every turn until MAX_INTAKE_STEPS hard-stopped the loop.
 *
 * What this file asserts:
 *   1. JTBD answer with spec_path=personas[*].name promotes into intakeSpec.personas.
 *   2. JTBD answer with spec_path=personas[*].trigger sets persona.trigger.
 *   3. QFD answer (spec_path=features[*].acceptanceCriteria) lands in qfdWeights.
 *   4. Pugh answer (spec_path=adrs[*].cites) lands in pughScores.
 *   5. After several answers across methods, deriveCandidateUnknowns returns
 *      a smaller set than after zero answers.
 *   6. Repeated ingestAnswer with the same step is idempotent.
 *   7. Unknown method tag + no spec_path + no topic falls back gracefully —
 *      no crash, parks the answer in workingMemory.unroutedAnswers and warns.
 *   8. topic="stance_because_privacy_data" promotes into stanceBecauseClauses.
 *   9. topic="non_goals" promotes into intakeSpec.nonGoals.
 *  10. topic="persona_exclusions" populates persona.exclusions with ≥3 items.
 *
 * Strategy: pure-function tests. We don't mock the LLM — ingestAnswer is
 * deterministic and synchronous. effectiveSpecFor + deriveCandidateUnknowns
 * are pure too. No AI service touched.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ProductStateSchema,
  SpecSchema,
  type ProductState,
  type Spec,
} from "@shared/schema";

import {
  ingestAnswer,
  deriveCandidateUnknowns,
  effectiveSpecFor,
  readIntakeSpec,
} from "../services/intake-controller";

const BASE_STATE: ProductState = ProductStateSchema.parse({});
const BASE_SPEC: Spec = SpecSchema.parse({
  id: "spec-state-advance",
  productName: "TestProduct",
  productDescription: "Verifies state advances across turns.",
});

describe("ingestAnswer — spec-slice promotion", () => {
  it("JTBD primary user (spec_path=personas[*].name) promotes into intakeSpec.personas[0]", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-1",
        step: 1,
        questionText: "Who is your primary user?",
        answer: "Senior product managers at mid-market SaaS companies",
        method: "jtbd",
        metadata: {
          extracts_into: { spec_path: "personas[*].name" },
          topic: "primary_persona_and_trigger",
        },
      },
    });

    const intakeSpec = readIntakeSpec(productState);
    expect(intakeSpec.personas).toHaveLength(1);
    expect(intakeSpec.personas[0].name).toBe(
      "Senior product managers at mid-market SaaS companies",
    );
  });

  it("JTBD trigger (spec_path=personas[*].trigger) sets persona.trigger", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-2",
        step: 1,
        questionText: "When do they reach for this?",
        answer: "After their inbox crosses 50 unread messages",
        method: "jtbd",
        metadata: {
          extracts_into: { spec_path: "personas[*].trigger" },
        },
      },
    });

    const intakeSpec = readIntakeSpec(productState);
    expect(intakeSpec.personas).toHaveLength(1);
    expect(intakeSpec.personas[0].trigger).toBe(
      "After their inbox crosses 50 unread messages",
    );
  });

  it("scenarios[*].goal answer sets scenarios[0].goal", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-3",
        step: 1,
        questionText: "What measurable outcome does the user need?",
        answer: "Reduce sprint planning from 60 to 30 minutes within 2 weeks",
        method: "jtbd",
        metadata: {
          extracts_into: { spec_path: "scenarios[*].goal" },
          topic: "measurable_outcome",
        },
      },
    });

    const intakeSpec = readIntakeSpec(productState);
    expect(intakeSpec.scenarios).toHaveLength(1);
    expect(intakeSpec.scenarios[0].goal).toContain("60 to 30");
  });

  it("QFD answer (spec_path=features[*].acceptanceCriteria) lands in workingMemory.qfdWeights", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-4",
        step: 2,
        questionText: "How much does Async digest help Reduce planning time?",
        answer: "High — core to the job",
        method: "qfd",
        metadata: {
          extracts_into: { spec_path: "features[*].acceptanceCriteria" },
        },
      },
    });

    expect(productState.workingMemory.qfdWeights).toMatchObject({
      "step-2": "High — core to the job",
    });
  });

  it("Pugh answer (spec_path=adrs[*].cites) lands in workingMemory.pughScores", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-5",
        step: 3,
        questionText: "Compared to Storage A, does Storage B do better on security?",
        answer: "Better (+)",
        method: "pugh",
        metadata: {
          extracts_into: { spec_path: "adrs[*].cites" },
        },
      },
    });

    expect(productState.workingMemory.pughScores).toMatchObject({
      "step-3": "Better (+)",
    });
  });

  it("topic=stance_because_privacy_data promotes into stanceBecauseClauses", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-6",
        step: 1,
        questionText: "What is your privacy stance and why?",
        answer: "We do not store user audio because trust is the moat",
        method: "jtbd",
        metadata: {
          topic: "stance_because_privacy_data",
        },
      },
    });

    expect(productState.stanceBecauseClauses).toHaveLength(1);
    expect(productState.stanceBecauseClauses[0].category).toBe("privacy_data");
    expect(productState.stanceBecauseClauses[0].because).toContain("audio");
  });

  it("topic=non_goals promotes into intakeSpec.nonGoals", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-7",
        step: 1,
        questionText: "What is explicitly out of scope?",
        answer: "No real-time chat — async-first reduces synchronous overhead",
        method: "jtbd",
        metadata: {
          topic: "non_goals",
        },
      },
    });

    const intakeSpec = readIntakeSpec(productState);
    expect(intakeSpec.nonGoals).toHaveLength(1);
    expect(intakeSpec.nonGoals[0].text).toContain("real-time chat");
  });

  it("topic=persona_exclusions populates persona.exclusions with ≥3 items even when answer has fewer", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-8",
        step: 1,
        questionText: "Who are they NOT?",
        answer: "Not enterprise IT, not casual hobbyists",
        method: "jtbd",
        metadata: {
          topic: "persona_exclusions",
        },
      },
    });

    const intakeSpec = readIntakeSpec(productState);
    expect(intakeSpec.personas).toHaveLength(1);
    expect(intakeSpec.personas[0].exclusions.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ingestAnswer — idempotency + degradation", () => {
  it("repeated ingestAnswer for the same step does not double-write", () => {
    const first = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-idempotent",
        step: 1,
        questionText: "Who is your user?",
        answer: "Engineering managers",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "personas[*].name" } },
      },
    });
    const second = ingestAnswer({
      state: first.productState,
      answer: {
        projectId: "proj-idempotent",
        step: 1,
        questionText: "Who is your user?",
        answer: "Engineering managers",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "personas[*].name" } },
      },
    });

    const intakeSpec = readIntakeSpec(second.productState);
    expect(intakeSpec.personas).toHaveLength(1);
    // intakeAnswers DOES grow because that's a raw log; the promotion does not.
    expect(second.productState.workingMemory.intakeAnswers).toHaveLength(2);
  });

  it("falls back gracefully when method is unknown and no spec_path/topic provided", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { productState } = ingestAnswer({
        state: BASE_STATE,
        answer: {
          projectId: "proj-unknown",
          step: 1,
          questionText: "Free-form question",
          answer: "Free-form answer",
          // method intentionally undefined
          metadata: {},
        },
      });

      // Did not crash. The answer was parked in unroutedAnswers and warned.
      expect(productState.workingMemory.unroutedAnswers).toBeDefined();
      expect((productState.workingMemory.unroutedAnswers as string[])[0]).toContain("Free-form answer");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("empty answer string does not crash and does not promote", () => {
    const { productState } = ingestAnswer({
      state: BASE_STATE,
      answer: {
        projectId: "proj-empty",
        step: 1,
        questionText: "Who is your user?",
        answer: "   ",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "personas[*].name" } },
      },
    });

    const intakeSpec = readIntakeSpec(productState);
    expect(intakeSpec.personas).toHaveLength(0);
  });
});

describe("deriveCandidateUnknowns — shrinks as state advances", () => {
  it("returns a smaller set after 4 well-routed answers than after 0", () => {
    const beforeCount = deriveCandidateUnknowns({
      productState: BASE_STATE,
      spec: BASE_SPEC,
    }).length;

    // Simulate 4 turns: persona+trigger, exclusions, scenario goal, stance privacy.
    let state = BASE_STATE;
    state = ingestAnswer({
      state,
      answer: {
        projectId: "p",
        step: 1,
        questionText: "Who is your primary user?",
        answer: "Senior PMs",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "personas[*].name" }, topic: "primary_persona_and_trigger" },
      },
    }).productState;
    state = ingestAnswer({
      state,
      answer: {
        projectId: "p",
        step: 2,
        questionText: "When do they reach for this?",
        answer: "After their backlog crosses 50 items",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "personas[*].trigger" } },
      },
    }).productState;
    state = ingestAnswer({
      state,
      answer: {
        projectId: "p",
        step: 3,
        questionText: "What measurable outcome do they need?",
        answer: "Cut planning meeting time in half within 2 weeks",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "scenarios[*].successSignal" }, topic: "measurable_outcome" },
      },
    }).productState;
    state = ingestAnswer({
      state,
      answer: {
        projectId: "p",
        step: 4,
        questionText: "Privacy stance?",
        answer: "We never persist customer data on third-party servers",
        method: "jtbd",
        metadata: { topic: "stance_because_privacy_data" },
      },
    }).productState;

    const merged = effectiveSpecFor(state, BASE_SPEC);
    const afterCount = deriveCandidateUnknowns({ productState: state, spec: merged }).length;

    expect(afterCount).toBeLessThan(beforeCount);
  });
});

describe("effectiveSpecFor — merge semantics", () => {
  it("returns baseSpec unchanged when intakeSpec is empty", () => {
    const merged = effectiveSpecFor(BASE_STATE, BASE_SPEC);
    expect(merged).toEqual(BASE_SPEC);
  });

  it("populates personas / scenarios / nonGoals from workingMemory.intakeSpec when baseSpec is empty", () => {
    let state = BASE_STATE;
    state = ingestAnswer({
      state,
      answer: {
        projectId: "p",
        step: 1,
        questionText: "Who is your user?",
        answer: "Engineers",
        method: "jtbd",
        metadata: { extracts_into: { spec_path: "personas[*].name" } },
      },
    }).productState;
    state = ingestAnswer({
      state,
      answer: {
        projectId: "p",
        step: 2,
        questionText: "Out of scope?",
        answer: "No real-time video",
        method: "jtbd",
        metadata: { topic: "non_goals" },
      },
    }).productState;

    const merged = effectiveSpecFor(state, BASE_SPEC);
    expect(merged.personas).toHaveLength(1);
    expect(merged.personas[0].name).toBe("Engineers");
    expect(merged.nonGoals).toHaveLength(1);
    expect(merged.nonGoals[0].text).toContain("real-time video");
  });
});
