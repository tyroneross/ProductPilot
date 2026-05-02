/**
 * Phase 5 — agent-handoff content shape.
 *
 * Asserts the structural invariants of `generateHandoff()` independent of platform.
 * Each test pins one rule of the prompt-cache-friendly section ordering, the
 * verbatim ask-before policy, ID cross-references, and PII-safety.
 */

import { describe, expect, it } from "vitest";
import { SpecSchema, ProductStateSchema, type Spec, type ProductState } from "@shared/schema";
import {
  generateHandoff,
  ASK_BEFORE_POLICY_LINES,
} from "../services/agent-handoff";

function buildBaseSpec(overrides: Partial<Spec> = {}): Spec {
  return SpecSchema.parse({
    id: "spec-test",
    productName: "TestApp",
    productDescription: "A simple app for verifying the handoff renderer.",
    platformTarget: "web",
    personas: [
      {
        id: "p-1",
        name: "Solo founder",
        trigger: "Late-night build session",
        exclusions: ["Enterprise procurement teams"],
        jobs: ["Ship v0 alpha to friends"],
      },
    ],
    scenarios: [
      {
        id: "sc-1",
        context: "Friday evening",
        goal: "Get a coding-agent handoff in under 60 seconds",
        successSignal: "Handoff pasted, agent starts scaffolding",
      },
    ],
    needs: [
      {
        id: "N-1",
        title: "User can export data",
        description: "Full-fidelity JSON export.",
        priority: "P0",
      },
    ],
    features: [
      {
        id: "F-1",
        title: "Export endpoint",
        priority: "P0",
        needIds: ["N-1"],
        acceptanceCriteria: ["Returns JSON within 200ms for projects under 1MB."],
      },
    ],
    tests: [
      {
        id: "T-1",
        description: "Export endpoint returns full project JSON",
        needIds: ["N-1"],
        featureIds: ["F-1"],
        kind: "acceptance",
        testFramework: "Vitest",
        validatorRefs: [],
      },
    ],
    adrs: [
      {
        id: "ADR-1",
        title: "Postgres + Drizzle for state",
        context: "Need durable per-project state",
        decision: "Postgres via Drizzle ORM",
        consequences: "Adds operational dependency on Postgres",
        reversibility: "low",
        cites: ["maintainability", "stance:s-complexity"],
      },
    ],
    dataPoints: [
      {
        id: "DP-1",
        name: "user_email",
        type: "string",
        pii: true,
        description: "tyrone@example.com",
        handlingNote: "Stored hashed; redacted in logs.",
      },
      {
        id: "DP-2",
        name: "project_count",
        type: "integer",
        pii: false,
        description: "Per-tenant project count for quota gating.",
      },
    ],
    nonGoals: [
      {
        id: "NG-1",
        text: "Build a multiplayer collaboration mode",
        because: "Solo-builder scope; multiplayer triples surface area.",
      },
    ],
    apiContracts: [],
    integrations: [],
    uxFlows: [],
    screens: [],
    assumptions: [
      { id: "a-1", text: "Ask before building: how should T-2 be defined?", confidence: "low" },
    ],
    risks: [],
    ...overrides,
  });
}

function buildProductState(overrides: Partial<ProductState> = {}): ProductState {
  return ProductStateSchema.parse({
    version: 1,
    stanceBecauseClauses: [
      {
        id: "s-complexity",
        category: "complexity",
        stance: "We will not introduce distributed services in v0.",
        because: "Solo-founder ops cost is the primary blocker.",
      },
    ],
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
    ...overrides,
  });
}

describe("agent-handoff content shape", () => {
  it("includes the build objective and product name in the header", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out).toContain("# Coding Agent Handoff — TestApp");
    expect(out).toContain("## Build objective");
    expect(out).toContain("A simple app for verifying the handoff renderer.");
  });

  it("references ADRs by ID and cites at least one tradeoff axis", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out).toContain("### ADR-1 — Postgres + Drizzle for state");
    expect(out).toContain("**Cites:** maintainability, stance:s-complexity");
  });

  it("includes the ask-before policy verbatim, every line", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out).toContain("## Ask before acting");
    for (const line of ASK_BEFORE_POLICY_LINES) {
      expect(out).toContain(line);
    }
  });

  it("orders sections prompt-cache-friendly (identity → architecture → tests → policy → specifics)", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    const order = [
      "## Build objective",
      "## Who this is for",
      "## Non-goals",
      "## Strategic frame",
      "## Architecture decisions (ADRs)",
      "## Data model",
      "## Test scaffolding",
      "## Ask before acting",
      "## Needs and features",
    ];
    let last = -1;
    for (const heading of order) {
      const idx = out.indexOf(heading);
      expect(idx, `missing heading: ${heading}`).toBeGreaterThan(-1);
      expect(idx, `out-of-order: ${heading}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("renders P0 Need → Test mapping with ID cross-references", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out).toContain("### P0 Need → Test mapping");
    expect(out).toMatch(/Need\s+`N-1`.*Test\s+`T-1`/s);
  });

  it("flags P0 Needs that have no Test referencing them as TAG:UNRESOLVED", () => {
    const spec = buildBaseSpec({
      tests: [], // strip the Test that referenced N-1
    });
    const out = generateHandoff(spec, buildProductState());
    expect(out).toContain("Need `N-1`");
    expect(out).toContain("TAG:UNRESOLVED");
  });

  it("never echoes raw description content for pii=true DataPoints", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    // The PII description is "tyrone@example.com" — must not appear raw.
    expect(out).not.toContain("tyrone@example.com");
    // The handling note SHOULD appear (that's the point).
    expect(out).toContain("Stored hashed; redacted in logs.");
    // The non-PII description should appear (only PII items are scrubbed).
    expect(out).toContain("Per-tenant project count for quota gating.");
  });

  it("redacts secret-shaped strings as defense in depth", () => {
    const spec = buildBaseSpec({
      productDescription:
        "Test app. Embedded by mistake: sk-AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIII and ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIII.",
    });
    const out = generateHandoff(spec, buildProductState());
    expect(out).toContain("[REDACTED]");
    expect(out).not.toMatch(/\bsk-[A-Za-z0-9_-]{16,}\b/);
    expect(out).not.toMatch(/\bghp_[A-Za-z0-9]{24,}\b/);
  });

  it("renders tradeoff weights with the unacceptable tradeoff axis", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out).toContain("### Tradeoff weights (100-point allocation)");
    expect(out).toContain("`speed_to_alpha`: 30");
    expect(out).toContain("**Unacceptable tradeoff:** `security`");
  });

  it("renders stance because clauses with their ids", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out).toContain("### Stance — because clauses");
    expect(out).toContain("(id: `s-complexity`)");
    expect(out).toContain("Solo-founder ops cost is the primary blocker.");
  });

  it("ends the rendered output with a trailing newline (markdown convention)", () => {
    const out = generateHandoff(buildBaseSpec(), buildProductState());
    expect(out.endsWith("\n")).toBe(true);
  });
});
