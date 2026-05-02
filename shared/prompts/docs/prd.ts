/**
 * ---
 * key: docs.prd
 * version: 0.1.0
 * defaultModel: claude-sonnet-4-5
 * prompt_builder_score: null
 * prompt_builder_revision: 0
 * prompt_builder_run_at: null
 * prompt_builder_notes: |
 *   Drafted in Phase 1 to keep stages 1–6 routable end-to-end. Optimization
 *   queued for Phase 2 once intake controller transcripts are available to
 *   score against. Until then, server/prompt-builders.ts continues to use
 *   the legacy strings in shared/prompt-content.ts as fallback.
 * ---
 */

import type { PromptModule } from "../types";

export const PRD_PROMPT_CONTENT = `You are generating ProductPilot's Stage 2 PRD — the North Star document.

Reads from the Stage 1 Brief Spec (already produced). Your job is to widen the Brief into a PRD without restating it. The PRD is what every Stage 3+ LLM call cites to decide what is in scope.

OUTPUT
Emit a Spec JSON object that augments the Brief Spec. Required additions:
- needs[] — every job-to-be-done from personas[].jobs becomes one or more Need entries with a P0/P1/P2 priority and a source pointer back to a persona.id or scenario.id.
- features[] — fill in features[] that serve P0 needs first. Each Feature carries needIds[] back-reference. P0 features need at least one acceptance criterion line.
- assumptions[] / risks[] — anything that would invalidate the outcome from Stage 1.
- nonGoals[] — re-state with because clauses, may add new ones.

Do NOT regenerate personas, scenarios, or stanceBecauseClauses unless the user explicitly added new context. Carry them forward unchanged.

CONSTRAINTS
- A P0 Need without a Feature is allowed at PRD stage; Phase 3 linter flags it.
- A P0 Need without a Test is expected at PRD stage; Stage 4 produces tests.
- Group needs by persona where possible. Don't invent personas.

OUTPUT FORMAT
Respond with ONLY valid JSON matching SpecSchema. No markdown fences. Carry forward all fields from the input Spec; add or modify as described.

ACCEPTANCE CRITERIA
- Every Need has a source field pointing at an intake question id or a persona/scenario id.
- Every P0 Feature has at least one acceptance criterion.
- The Spec validates against SpecSchema.`;

const promptModule: PromptModule = {
  key: "docs.prd",
  version: "0.1.0",
  content: PRD_PROMPT_CONTENT,
  defaultModel: "claude-sonnet-4-5",
  prompt_builder_score: null,
  prompt_builder_revision: 0,
  prompt_builder_run_at: null,
  prompt_builder_notes:
    "Drafted in Phase 1; optimization queued for Phase 2 when transcripts are available.",
};

export default promptModule;
