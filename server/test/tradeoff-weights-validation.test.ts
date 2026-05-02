/**
 * Phase 4 — TradeoffWeightsSchema Zod refinement coverage.
 *
 * Asserts the canonical 100-point allocation contract:
 *   - sum===100 across the six axes is required (refine fires)
 *   - negative weights rejected (z.number().int().min(0))
 *   - missing axis rejected (no .partial())
 *   - bad unacceptable_tradeoff enum rejected
 *   - valid balanced allocation passes
 *   - edge case: one axis = 100, all others = 0 still passes
 *   - edge case: non-integer (33.3) is rejected — we require integer points
 *   - missing unacceptable_tradeoff is rejected (no default)
 */

import { describe, it, expect } from "vitest";
import {
  TradeoffWeightsSchema,
  TRADEOFF_AXES,
  ProductStateSchema,
} from "@shared/schema";

const ALL_AXES_BALANCED = {
  speed_to_alpha: 30,
  scalability: 20,
  ux_polish: 10,
  maintainability: 20,
  cost: 10,
  security: 10,
  unacceptable_tradeoff: "security" as const,
};

describe("TradeoffWeightsSchema — sum===100 invariant", () => {
  it("rejects an allocation that sums to less than 100", () => {
    const result = TradeoffWeightsSchema.safeParse({
      ...ALL_AXES_BALANCED,
      cost: 5, // 100 - 5 = 95, not 100
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // The refine attaches the message under path: ["__sum"].
      const sumIssue = result.error.issues.find((i) =>
        i.path.includes("__sum"),
      );
      expect(sumIssue).toBeDefined();
      expect(sumIssue?.message).toMatch(/sum to exactly 100/i);
    }
  });

  it("rejects an allocation that sums to more than 100", () => {
    const result = TradeoffWeightsSchema.safeParse({
      ...ALL_AXES_BALANCED,
      cost: 25, // 100 + 15 = 115
    });
    expect(result.success).toBe(false);
  });

  it("accepts a balanced allocation that sums to exactly 100", () => {
    const result = TradeoffWeightsSchema.safeParse(ALL_AXES_BALANCED);
    expect(result.success).toBe(true);
  });

  it("accepts the edge case where one axis = 100 and others = 0", () => {
    const result = TradeoffWeightsSchema.safeParse({
      speed_to_alpha: 100,
      scalability: 0,
      ux_polish: 0,
      maintainability: 0,
      cost: 0,
      security: 0,
      unacceptable_tradeoff: "security",
    });
    expect(result.success).toBe(true);
  });
});

describe("TradeoffWeightsSchema — per-axis bounds", () => {
  it("rejects a negative weight on any axis", () => {
    const result = TradeoffWeightsSchema.safeParse({
      ...ALL_AXES_BALANCED,
      speed_to_alpha: -10,
      cost: 50, // keep the sum recoverable so the failure is the negative bound
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const negIssue = result.error.issues.find((i) =>
        i.path.includes("speed_to_alpha"),
      );
      expect(negIssue).toBeDefined();
    }
  });

  it("rejects a non-integer weight (we require integer points)", () => {
    const result = TradeoffWeightsSchema.safeParse({
      ...ALL_AXES_BALANCED,
      speed_to_alpha: 30.5,
      scalability: 19.5, // sum is still 100 but not integer
    });
    expect(result.success).toBe(false);
  });

  it("rejects a weight > 100 on any axis", () => {
    const result = TradeoffWeightsSchema.safeParse({
      speed_to_alpha: 150, // out of bounds
      scalability: -50,
      ux_polish: 0,
      maintainability: 0,
      cost: 0,
      security: 0,
      unacceptable_tradeoff: "security",
    });
    expect(result.success).toBe(false);
  });
});

describe("TradeoffWeightsSchema — required fields", () => {
  it("rejects a payload that is missing one of the six axes", () => {
    const partial: Record<string, unknown> = { ...ALL_AXES_BALANCED };
    delete partial.security;
    const result = TradeoffWeightsSchema.safeParse(partial);
    expect(result.success).toBe(false);
    if (!result.success) {
      const missingIssue = result.error.issues.find((i) =>
        i.path.includes("security"),
      );
      expect(missingIssue).toBeDefined();
    }
  });

  it("rejects a payload missing unacceptable_tradeoff", () => {
    const partial: Record<string, unknown> = { ...ALL_AXES_BALANCED };
    delete partial.unacceptable_tradeoff;
    const result = TradeoffWeightsSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it("rejects an unacceptable_tradeoff value not in the six-axis enum", () => {
    const result = TradeoffWeightsSchema.safeParse({
      ...ALL_AXES_BALANCED,
      unacceptable_tradeoff: "delivery_date" as unknown as "security",
    });
    expect(result.success).toBe(false);
  });

  it("accepts every axis as a valid unacceptable_tradeoff option", () => {
    for (const axis of TRADEOFF_AXES) {
      const result = TradeoffWeightsSchema.safeParse({
        ...ALL_AXES_BALANCED,
        unacceptable_tradeoff: axis,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("ProductState integration — tradeoffWeights remains optional at parent level", () => {
  it("accepts a ProductState with no tradeoffWeights set (Phase 1/2 backward compat)", () => {
    const result = ProductStateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tradeoffWeights).toBeUndefined();
    }
  });

  it("accepts a ProductState with a fully valid tradeoffWeights blob", () => {
    const result = ProductStateSchema.safeParse({
      tradeoffWeights: ALL_AXES_BALANCED,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a ProductState whose tradeoffWeights blob fails the sum invariant", () => {
    const result = ProductStateSchema.safeParse({
      tradeoffWeights: { ...ALL_AXES_BALANCED, cost: 50 }, // sum != 100
    });
    expect(result.success).toBe(false);
  });
});
