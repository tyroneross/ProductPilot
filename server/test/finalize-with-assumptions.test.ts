/**
 * Defect #3 — finalizeWithAssumptions helper coverage.
 *
 * Pure helper; verifies the markers it sets on workingMemory and the
 * intakeAnswerCount it returns.
 */

import { describe, expect, it } from "vitest";
import { finalizeWithAssumptions } from "../services/intake-controller";
import { ProductStateSchema } from "@shared/schema";

describe("finalizeWithAssumptions", () => {
  it("sets user_chose_assumption_fill, assumption_fill_at, and adaptive_intake_finalized", () => {
    const state = ProductStateSchema.parse({});
    const { productState, finalizedAt } = finalizeWithAssumptions(state);
    expect(productState.workingMemory.user_chose_assumption_fill).toBe(true);
    expect(productState.workingMemory.adaptive_intake_finalized).toBe(true);
    expect(productState.workingMemory.assumption_fill_at).toBe(finalizedAt);
    // Timestamp is a valid ISO string
    expect(new Date(finalizedAt).toISOString()).toBe(finalizedAt);
  });

  it("returns the intakeAnswerCount from workingMemory", () => {
    const state = ProductStateSchema.parse({
      workingMemory: {
        intakeAnswers: [
          { step: 1, question: "Q1", answer: "A1" },
          { step: 2, question: "Q2", answer: "A2" },
          { step: 3, question: "Q3", answer: "A3" },
        ],
      },
    });
    const { intakeAnswerCount } = finalizeWithAssumptions(state);
    expect(intakeAnswerCount).toBe(3);
  });

  it("preserves prior workingMemory keys", () => {
    const state = ProductStateSchema.parse({
      workingMemory: {
        intakeAnswers: [{ step: 1, question: "Q", answer: "A" }],
        tradeoff_weights_assumed: true,
      },
    });
    const { productState } = finalizeWithAssumptions(state);
    expect(productState.workingMemory.tradeoff_weights_assumed).toBe(true);
    expect(productState.workingMemory.intakeAnswers).toHaveLength(1);
  });

  it("returns 0 for intakeAnswerCount when no answers exist", () => {
    const state = ProductStateSchema.parse({});
    expect(finalizeWithAssumptions(state).intakeAnswerCount).toBe(0);
  });
});
