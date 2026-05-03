/**
/**
 * Test 3 — cache breakpoint placement.
 *
 * Plan §"Security considerations": the Anthropic prompt-cache breakpoint
 * (cache_control: ephemeral) must be placed AFTER buildProjectContext. The
 * project context is tenant-scoped via RLS and storage.withActor; placing the
 * breakpoint after it means the cache prefix only contains data the current
 * actor is allowed to see. Placing the breakpoint BEFORE the project context
 * would allow cache hits to leak across tenants.
 *
 * 2026-05-02 routing override: alpha defaults route through Groq, which
 * does NOT support prompt caching. The cache_control markers are silently
 * dropped at runtime on the Groq path. This test still passes because the
 * SystemBlock structure is provider-agnostic — Anthropic uses the marker,
 * Groq ignores it. The test guards correctness for the day Anthropic
 * routing is re-enabled (BYOK or default flip).
 *
 * This test asserts:
 *   1. There is exactly one cache_control marker in the system blocks.
 *   2. The marker is on a block whose text contains <PROJECT_CONTEXT>.
 *   3. Blocks AFTER the marker do not carry cache_control.
 */
import { describe, expect, it } from "vitest";
import { buildDocumentGenerationBlocks } from "../prompt-builders";
import type { Stage } from "@shared/schema";

const fakeStage: Stage = {
  id: "stage-1",
  projectId: "proj-1",
  stageNumber: 1,
  title: "Brief",
  description: "Stage 1",
  progress: 0,
  isUnlocked: true,
  systemPrompt: "stub",
  aiModel: null,
  outputs: null,
  keyInsights: null,
  completedInsights: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("buildDocumentGenerationBlocks", () => {
  const blocks = buildDocumentGenerationBlocks({
    stageKind: "brief",
    stage: fakeStage,
    projectContext: "PRODUCT IDEA: a tool for founders\nINTAKE: solo, US-based",
    dynamicContext: "Survey responses: {...}\nCustom prompts: ...",
  });

  it("emits at least three blocks (instruction, context, dynamic)", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });

  it("places exactly one cache_control marker", () => {
    const withMarker = blocks.filter((b) => b.cache_control);
    expect(withMarker).toHaveLength(1);
  });

  it("places the cache marker on the project-context block", () => {
    const marked = blocks.find((b) => b.cache_control);
    expect(marked).toBeDefined();
    expect(marked!.text).toContain("<PROJECT_CONTEXT>");
  });

  it("does not place cache_control before the project context", () => {
    const idx = blocks.findIndex((b) => b.text.includes("<PROJECT_CONTEXT>"));
    expect(idx).toBeGreaterThanOrEqual(1); // instruction block precedes context
    for (let i = 0; i < idx; i++) {
      expect(blocks[i].cache_control).toBeUndefined();
    }
  });

  it("does not place cache_control after the project context", () => {
    const idx = blocks.findIndex((b) => b.text.includes("<PROJECT_CONTEXT>"));
    for (let i = idx + 1; i < blocks.length; i++) {
      expect(blocks[i].cache_control).toBeUndefined();
    }
  });
});
