/**
 * Phase 4 — Architecture stage prompt citation coverage.
 *
 * Asserts the Stage-4 functional prompt + the buildDocumentGenerationBlocks
 * renderer surfaces both signals to the LLM:
 *   - tradeoffWeights numeric values per axis
 *   - stanceBecauseClauses with stance + because + id
 *
 * String-contains assertions (not snapshots) so a non-cosmetic prompt edit
 * doesn't silently break the contract.
 */

import { describe, it, expect } from "vitest";
import {
  buildDocumentGenerationBlocks,
  renderArchitectureContext,
} from "../prompt-builders";
import { ProductStateSchema, type Stage } from "@shared/schema";
import { FUNCTIONAL_PROMPT_CONTENT } from "@shared/prompts/docs/functional";

const STAGE_4: Stage = {
  id: "stage-4",
  projectId: "p1",
  stageNumber: 4,
  title: "Architecture & Functional Spec",
  status: "in_progress",
  progress: 50,
  generatedDocument: null,
  documentDetailLevel: "detailed",
  generatedDocumentRevisionCount: 0,
  generatedDocumentLastRevisedAt: null,
  generatedDocumentRevisionLog: [],
  createdAt: new Date(),
  updatedAt: new Date(),
} as Stage;

const STATE_WITH_PHASE4 = ProductStateSchema.parse({
  stanceBecauseClauses: [
    {
      id: "s-privacy",
      category: "privacy_data",
      stance: "we won't store user audio on our servers",
      because: "this is healthcare-adjacent and trust is the moat",
    },
    {
      id: "s-complexity",
      category: "complexity",
      stance: "we won't introduce distributed services",
      because: "solo-founder operational cost is the primary blocker",
    },
    {
      id: "s-cost",
      category: "cost",
      stance: "stay within Vercel free tier for first 90 days",
      because: "no revenue to absorb infrastructure spend yet",
    },
  ],
  tradeoffWeights: {
    speed_to_alpha: 35,
    scalability: 10,
    ux_polish: 15,
    maintainability: 20,
    cost: 10,
    security: 10,
    unacceptable_tradeoff: "security",
  },
});

describe("FUNCTIONAL_PROMPT_CONTENT — static prompt module", () => {
  it("instructs the model to consume tradeoffWeights AND stanceBecauseClauses", () => {
    expect(FUNCTIONAL_PROMPT_CONTENT).toMatch(/tradeoff/i);
    expect(FUNCTIONAL_PROMPT_CONTENT).toMatch(/stance/i);
    expect(FUNCTIONAL_PROMPT_CONTENT).toMatch(/because/i);
  });

  it("requires every ADR cites[] to reference at least one axis or stance id", () => {
    // The prompt's CITATION FORMAT block is the load-bearing constraint.
    expect(FUNCTIONAL_PROMPT_CONTENT).toMatch(/CITATION FORMAT/i);
    expect(FUNCTIONAL_PROMPT_CONTENT).toMatch(/cites\[\]/);
    // Mentions weight-and-philosophy duality so the model doesn't conflate them.
    expect(FUNCTIONAL_PROMPT_CONTENT.toLowerCase()).toContain("priority");
    expect(FUNCTIONAL_PROMPT_CONTENT.toLowerCase()).toContain("philosophy");
  });

  it("declares the six tradeoff axes by name so the model can cite by name", () => {
    for (const axis of [
      "speed_to_alpha",
      "scalability",
      "ux_polish",
      "maintainability",
      "cost",
      "security",
    ]) {
      expect(FUNCTIONAL_PROMPT_CONTENT).toContain(axis);
    }
  });
});

describe("renderArchitectureContext — block content", () => {
  it("renders every axis with its numeric value and the unacceptable_tradeoff axis", () => {
    const block = renderArchitectureContext(STATE_WITH_PHASE4);
    expect(block).toContain("<TRADEOFF_WEIGHTS>");
    expect(block).toContain("speed_to_alpha=35");
    expect(block).toContain("scalability=10");
    expect(block).toContain("ux_polish=15");
    expect(block).toContain("maintainability=20");
    expect(block).toContain("cost=10");
    expect(block).toContain("security=10");
    expect(block).toContain("unacceptable_tradeoff=security");
  });

  it("renders every stance clause with stance text + because + id reference", () => {
    const block = renderArchitectureContext(STATE_WITH_PHASE4);
    expect(block).toContain("<STANCE_BECAUSE_CLAUSES>");
    expect(block).toContain("[stance:s-privacy]");
    expect(block).toContain("solo-founder operational cost is the primary blocker");
    expect(block).toContain("trust is the moat");
    expect(block).toContain("no revenue to absorb infrastructure spend yet");
  });

  it("emits guidance that ADR cites[] must reference an axis or stance id", () => {
    const block = renderArchitectureContext(STATE_WITH_PHASE4);
    expect(block).toMatch(/ARCHITECTURE GUIDANCE/);
    expect(block).toMatch(/stance:/);
    expect(block).toMatch(/unacceptable_tradeoff/);
  });

  it("falls back gracefully when productState lacks weights or stance", () => {
    const empty = ProductStateSchema.parse({});
    const block = renderArchitectureContext(empty);
    expect(block).toContain("(not allocated)");
    expect(block).toContain("(none)");
  });
});

describe("buildDocumentGenerationBlocks — wiring", () => {
  it("includes the architecture context in the dynamic block when stageKind=functional", () => {
    const blocks = buildDocumentGenerationBlocks({
      stageKind: "functional",
      stage: STAGE_4,
      projectContext: "PRODUCT IDEA: a calendar tool",
      dynamicContext: "Survey responses: ...",
      productState: STATE_WITH_PHASE4,
    });

    expect(blocks).toHaveLength(3);
    // Block 0: stage instructions — the functional prompt content.
    expect(blocks[0].text).toContain("CITATION FORMAT");
    // Block 1: tenant-scoped project context with cache marker.
    expect(blocks[1].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1].text).toContain("PRODUCT IDEA: a calendar tool");
    // Block 2: dynamic context — must include the architecture context block.
    expect(blocks[2].text).toContain("speed_to_alpha=35");
    expect(blocks[2].text).toContain("[stance:s-privacy]");
    expect(blocks[2].text).toContain("Survey responses:");
  });

  it("does NOT inject architecture context into non-functional stages", () => {
    const blocks = buildDocumentGenerationBlocks({
      stageKind: "brief",
      stage: { ...STAGE_4, stageNumber: 1, title: "Brief" } as Stage,
      projectContext: "x",
      dynamicContext: "y",
      productState: STATE_WITH_PHASE4,
    });

    // dynamic block should NOT contain the architecture context for non-functional stages.
    expect(blocks[2].text).not.toContain("<TRADEOFF_WEIGHTS>");
    expect(blocks[2].text).not.toContain("[stance:s-privacy]");
  });
});
