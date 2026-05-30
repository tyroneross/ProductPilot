/**
 * Test 1 — Zod schema validation for Spec and ProductState.
 *
 * Smoke-test that the schemas accept a minimally-valid Spec and reject
 * an obviously-invalid one. The point is not exhaustive schema testing;
 * it's a tripwire for accidental schema breakage during the Phase 1
 * refactor and a baseline that Phase 2/3 tests can build on.
 */
import { describe, expect, it } from "vitest";
import { SpecSchema, ProductStateSchema } from "@shared/schema";

describe("SpecSchema", () => {
  it("accepts a minimally valid spec", () => {
    const minimal = {
      id: "spec-1",
      productName: "Test Product",
      productDescription: "Tests the schema accepts a thin spec.",
    };
    const parsed = SpecSchema.parse(minimal);
    expect(parsed.id).toBe("spec-1");
    // Defaults populate every array.
    expect(parsed.personas).toEqual([]);
    expect(parsed.needs).toEqual([]);
    expect(parsed.adrs).toEqual([]);
  });

  it("rejects a spec missing required productName", () => {
    const invalid = {
      id: "spec-1",
      productDescription: "Has description but no name.",
    };
    expect(() => SpecSchema.parse(invalid)).toThrow();
  });

  it("validates nested DataPoint pii flag round-trips with handlingNote", () => {
    const spec = {
      id: "spec-2",
      productName: "Trace test",
      productDescription: "Checks data point PII flag round-trips through the parser.",
      dataPoints: [
        {
          id: "dp-1",
          name: "user_email",
          type: "string",
          pii: true,
          handlingNote: "Hashed at rest, redacted in audit logs.",
        },
      ],
    };
    const parsed = SpecSchema.parse(spec);
    expect(parsed.dataPoints[0].pii).toBe(true);
    expect(parsed.dataPoints[0].handlingNote).toContain("Hashed");
  });

  it("accepts an agent-system spec with tool contracts, guardrails, and evals", () => {
    const parsed = SpecSchema.parse({
      id: "spec-agent",
      productName: "Research Agent",
      productDescription: "A source-backed research assistant.",
      platformTarget: "agent-system",
      agentSystem: {
        mission: "Draft source-backed recommendations.",
        builderScale: "agent",
        architecturePattern: "single-agent",
        autonomyLevel: "human-in-loop",
        stateOwner: "Project workspace",
        stopCondition: "Every claim has evidence or an uncertainty label.",
        toolContracts: [
          {
            id: "tool-search",
            name: "Source search",
            purpose: "Read external sources.",
            permissionTier: "T2",
          },
        ],
        guardrails: [
          {
            id: "guardrail-citation",
            trigger: "Factual claim",
            check: "Claim has source evidence.",
            action: "Cite source or mark uncertain.",
          },
        ],
        evaluations: [
          {
            id: "eval-citation",
            name: "Citation coverage",
            metric: "All factual claims have citations.",
            blocking: true,
          },
        ],
      },
    });
    expect(parsed.platformTarget).toBe("agent-system");
    expect(parsed.agentSystem?.toolContracts[0].permissionTier).toBe("T2");
    expect(parsed.agentSystem?.guardrails[0].severity).toBe("warn");
  });
});

describe("ProductStateSchema", () => {
  it("accepts an empty product state", () => {
    const parsed = ProductStateSchema.parse({});
    expect(parsed.version).toBe(1);
    expect(parsed.stanceBecauseClauses).toEqual([]);
    expect(parsed.pivotLog).toEqual([]);
    expect(parsed.workingMemory).toEqual({});
  });

  it("accepts populated stance because-clauses", () => {
    const parsed = ProductStateSchema.parse({
      stanceBecauseClauses: [
        {
          id: "stance-priv",
          category: "privacy_data",
          stance: "We do not store user audio on our servers.",
          because: "Trust is the moat for healthcare-adjacent products.",
        },
      ],
    });
    expect(parsed.stanceBecauseClauses).toHaveLength(1);
    expect(parsed.stanceBecauseClauses[0].category).toBe("privacy_data");
  });

  it("accepts an in-progress agent profile", () => {
    const parsed = ProductStateSchema.parse({
      agentProfile: {
        mission: "Review user research and propose next questions.",
        builderScale: "skill",
        autonomyLevel: "draft-only",
        uiProtocol: {
          archetype: "data-research-tool",
          userResearchQuestions: ["Which respondent segment is underrepresented?"],
        },
      },
    });
    expect(parsed.agentProfile?.mission).toContain("Review user research");
    expect(parsed.agentProfile?.builderScale).toBe("skill");
    expect(parsed.agentProfile?.uiProtocol?.archetype).toBe("data-research-tool");
  });

  it("rejects an unknown stance category", () => {
    expect(() =>
      ProductStateSchema.parse({
        stanceBecauseClauses: [
          {
            id: "stance-bad",
            category: "marketing", // not in the enum
            stance: "Bad value",
            because: "Bad value",
          },
        ],
      }),
    ).toThrow();
  });
});
