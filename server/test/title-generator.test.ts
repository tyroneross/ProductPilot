/**
 * Defect #6b — title-generator coverage.
 *
 * Pure helper; verifies the selection ladder (persona+pain → ICP+pain → problem
 * statement → description) and the not-enough-signal predicate.
 */

import { describe, expect, it } from "vitest";
import {
  deriveProjectTitle,
  hasEnoughSignalForTitle,
} from "../services/title-generator";
import { ProductStateSchema, SpecSchema, type Spec, type ProductState } from "@shared/schema";

const baseState: ProductState = ProductStateSchema.parse({});

function stateWithAnswers(rows: Array<{ step: string; method?: string; question?: string; answer: string }>): ProductState {
  return ProductStateSchema.parse({
    workingMemory: { intakeAnswers: rows },
  });
}

const specWithPersona: Spec = SpecSchema.parse({
  id: "spec-1",
  productName: "P",
  productDescription: "D",
  personas: [{ id: "p1", name: "Solo founder", trigger: "loses hours patching CI failures", jobs: [] }],
});

describe("title-generator", () => {
  it("returns null when no signal is present", () => {
    const result = deriveProjectTitle({
      storedName: "Survey Draft - 10:37:03 AM",
      description: null,
      minimumDetails: null,
      productState: baseState,
      spec: null,
    });
    expect(result).toBeNull();
  });

  it("uses persona role + trigger when spec has a persona", () => {
    const result = deriveProjectTitle({
      storedName: "Survey Draft",
      description: null,
      minimumDetails: null,
      productState: baseState,
      spec: specWithPersona,
    });
    expect(result?.source).toBe("persona_pain");
    expect(result?.name).toContain("Solo founder");
    expect(result?.name).toContain("loses hours");
  });

  it("uses ICP + problem from intake answers when spec lacks personas", () => {
    const state = stateWithAnswers([
      { step: "icp", question: "Who is the primary user?", answer: "Independent developers" },
      { step: "problem", question: "What pain are they hitting?", answer: "Specs get stale between intake and code" },
    ]);
    const result = deriveProjectTitle({
      storedName: "Survey Draft",
      description: null,
      minimumDetails: null,
      productState: state,
      spec: null,
    });
    expect(result?.source).toBe("icp_pain");
    expect(result?.name).toContain("Independent developers");
    expect(result?.name).toContain("Specs get stale");
  });

  it("falls back to minimumDetails.problemStatement when no intake answers", () => {
    const result = deriveProjectTitle({
      storedName: "Survey Draft",
      description: null,
      minimumDetails: { problemStatement: "Teams cannot agree on a one-page spec" },
      productState: baseState,
      spec: null,
    });
    expect(result?.source).toBe("problem_statement");
    expect(result?.name).toContain("Teams cannot agree");
  });

  it("falls back to description when only description is set", () => {
    const result = deriveProjectTitle({
      storedName: "Survey Draft",
      description: "[context] A meeting summarizer tuned for product teams",
      minimumDetails: null,
      productState: baseState,
      spec: null,
    });
    expect(result?.source).toBe("description");
    expect(result?.name).toContain("meeting summarizer");
    // [context] prefix and the "A " filler are stripped
    expect(result?.name).not.toContain("[context]");
  });

  it("hasEnoughSignalForTitle is true when ICP + problem both exist", () => {
    const state = stateWithAnswers([
      { step: "icp", question: "Who?", answer: "PMs" },
      { step: "problem", question: "Pain?", answer: "Spec drift" },
    ]);
    expect(
      hasEnoughSignalForTitle({
        storedName: "Survey Draft",
        description: null,
        minimumDetails: null,
        productState: state,
        spec: null,
      }),
    ).toBe(true);
  });

  it("hasEnoughSignalForTitle is false when only ICP exists", () => {
    const state = stateWithAnswers([
      { step: "icp", question: "Who?", answer: "PMs" },
    ]);
    expect(
      hasEnoughSignalForTitle({
        storedName: "Survey Draft",
        description: null,
        minimumDetails: null,
        productState: state,
        spec: null,
      }),
    ).toBe(false);
  });

  it("hasEnoughSignalForTitle is true when spec has at least one persona", () => {
    expect(
      hasEnoughSignalForTitle({
        storedName: "Survey Draft",
        description: null,
        minimumDetails: null,
        productState: baseState,
        spec: specWithPersona,
      }),
    ).toBe(true);
  });

  it("derived names are bounded to ~60 chars", () => {
    const state = stateWithAnswers([
      { step: "icp", answer: "Marketing operations leads at mid-market SaaS companies" },
      { step: "problem", answer: "Cannot consistently brief the design team on long-form campaign mechanics across regions" },
    ]);
    const result = deriveProjectTitle({
      storedName: "Survey Draft",
      description: null,
      minimumDetails: null,
      productState: state,
      spec: null,
    });
    expect(result).not.toBeNull();
    expect(result!.name.length).toBeLessThanOrEqual(60);
  });
});
