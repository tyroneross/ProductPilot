/**
 * Phase 2 — blocking-scorer threshold edge cases.
 *
 * Asserts:
 *   - High-risk irreversible question crosses threshold → decision="ask".
 *   - Low-stakes reversible question stays below threshold → decision="infer".
 *   - The deterministic blocking formula is what the controller cross-checks (not the LLM math).
 */

import { describe, expect, it, vi } from "vitest";
import { ProductStateSchema, SpecSchema, type Spec } from "@shared/schema";

vi.mock("../services/ai", () => ({
  aiService: { generateStructuredOutput: vi.fn() },
}));

import { aiService } from "../services/ai";
import { callBlockingScorer } from "../services/intake-controller";

const generateStructuredOutputMock = aiService.generateStructuredOutput as ReturnType<typeof vi.fn>;

const baseState = ProductStateSchema.parse({});
const baseSpec: Spec = SpecSchema.parse({
  id: "s",
  productName: "x",
  productDescription: "y",
});

describe("callBlockingScorer — threshold edge cases", () => {
  it("HIGH risk + LOW reversibility + LOW evidence → ask (blocking >= 6)", async () => {
    // evidence=0, reversibility=0, risk=5 → blocking = (5-0) + (5-0) + 5 = 15
    generateStructuredOutputMock.mockResolvedValueOnce([
      {
        topic: "irreversible_pii_decision",
        evidence: 0,
        reversibility: 0,
        risk: 5,
        blocking: 99, // LLM returned a wrong number — controller MUST recompute.
        decision: "infer", // LLM disagreed — controller MUST override.
        reason: "PII storage choice",
      },
    ]);

    const result = await callBlockingScorer(
      { productState: baseState, spec: baseSpec, candidates: [{ topic: "irreversible_pii_decision", why_it_matters: "compliance" }] },
      {},
    );

    expect(result).toHaveLength(1);
    expect(result[0].blocking).toBe(15);
    expect(result[0].decision).toBe("ask"); // controller recomputed, not LLM-trusted.
  });

  it("LOW risk + HIGH reversibility + HIGH evidence → infer (blocking < 6)", async () => {
    // evidence=4, reversibility=4, risk=1 → blocking = (5-4) + (5-4) + 1 = 3
    generateStructuredOutputMock.mockResolvedValueOnce([
      {
        topic: "ui_copy_tone",
        evidence: 4,
        reversibility: 4,
        risk: 1,
        blocking: 3,
        decision: "infer",
        reason: "user already said tone is professional",
      },
    ]);

    const result = await callBlockingScorer(
      { productState: baseState, spec: baseSpec, candidates: [{ topic: "ui_copy_tone", why_it_matters: "phrasing" }] },
      {},
    );

    expect(result[0].blocking).toBe(3);
    expect(result[0].decision).toBe("infer");
  });

  it("clamps out-of-range LLM scores (negatives, > 5)", async () => {
    // LLM returns wild values; controller clamps to [0, 5].
    generateStructuredOutputMock.mockResolvedValueOnce([
      { topic: "weird", evidence: -3, reversibility: 99, risk: 7, blocking: 0, decision: "infer", reason: "" },
    ]);

    const result = await callBlockingScorer(
      { productState: baseState, spec: baseSpec, candidates: [{ topic: "weird", why_it_matters: "" }] },
      {},
    );

    expect(result[0].evidence).toBe(0);
    expect(result[0].reversibility).toBe(5);
    expect(result[0].risk).toBe(5);
    // Recomputed blocking = (5-0) + (5-5) + 5 = 10 → ask
    expect(result[0].blocking).toBe(10);
    expect(result[0].decision).toBe("ask");
  });

  it("empty candidates → empty result without an LLM call", async () => {
    generateStructuredOutputMock.mockReset();
    const result = await callBlockingScorer(
      { productState: baseState, spec: baseSpec, candidates: [] },
      {},
    );
    expect(result).toEqual([]);
    expect(generateStructuredOutputMock).not.toHaveBeenCalled();
  });

  it("threshold boundary: blocking==6 → ask; blocking==5 → infer", async () => {
    generateStructuredOutputMock.mockResolvedValueOnce([
      // evidence=2, reversibility=2, risk=3 → (5-2)+(5-2)+3 = 9 — wait, that's 9. Let me pick a real boundary.
      // evidence=3, reversibility=3, risk=2 → (5-3)+(5-3)+2 = 6 → ask.
      { topic: "boundary_ask", evidence: 3, reversibility: 3, risk: 2, blocking: 0, decision: "infer", reason: "" },
      // evidence=3, reversibility=3, risk=1 → (5-3)+(5-3)+1 = 5 → infer.
      { topic: "boundary_infer", evidence: 3, reversibility: 3, risk: 1, blocking: 0, decision: "infer", reason: "" },
    ]);

    const result = await callBlockingScorer(
      {
        productState: baseState,
        spec: baseSpec,
        candidates: [
          { topic: "boundary_ask", why_it_matters: "" },
          { topic: "boundary_infer", why_it_matters: "" },
        ],
      },
      {},
    );

    // Sorted highest-blocking first.
    expect(result[0].topic).toBe("boundary_ask");
    expect(result[0].blocking).toBe(6);
    expect(result[0].decision).toBe("ask");
    expect(result[1].topic).toBe("boundary_infer");
    expect(result[1].blocking).toBe(5);
    expect(result[1].decision).toBe("infer");
  });
});
