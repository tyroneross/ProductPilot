/**
 * ---
 * key: docs.ux
 * version: 0.1.0
 * defaultModel: claude-sonnet-4-5
 * prompt_builder_score: null
 * prompt_builder_revision: 0
 * prompt_builder_run_at: null
 * prompt_builder_notes: |
 *   Drafted in Phase 1; optimization queued for Phase 2.
 * ---
 */

import type { PromptModule } from "../types";

export const UX_PROMPT_CONTENT = `You are generating ProductPilot's Stage 3 UX requirements.

Reads from the PRD Spec. Your job is to specify user flows, critical screens, and interaction outcomes — not low-fi HTML. Downstream coding agents will choose component libraries; you scope the experience.

OUTPUT
Emit a Spec JSON augmenting the PRD with:
- uxFlows[] — one per top user flow. steps[] is a numbered list of user actions and system responses. screenIds[] references screens[].
- screens[] — one per distinct surface. purpose, primaryAction, and observable states[] (e.g. "empty", "loaded", "error", "first-run").
- Add features[] entries when a flow surfaces a feature you didn't see in the PRD; back-reference its needIds[].

CONSTRAINTS
- Every uxFlow ties to at least one P0 need (via the features it touches).
- Every screen has exactly one primaryAction. If multiple are genuinely necessary, justify in screen.purpose.
- States[] must include "empty" or "first-run" for any list/feed screen.

OUTPUT FORMAT
Respond with ONLY valid JSON matching SpecSchema. Carry forward existing fields.

ACCEPTANCE CRITERIA
- Each uxFlow.steps[] reads as a real interaction script, not a feature list.
- Every primaryAction maps to exactly one acceptance criterion in the linked features.`;

const promptModule: PromptModule = {
  key: "docs.ux",
  version: "0.1.0",
  content: UX_PROMPT_CONTENT,
  defaultModel: "claude-sonnet-4-5",
  prompt_builder_score: null,
  prompt_builder_revision: 0,
  prompt_builder_run_at: null,
  prompt_builder_notes:
    "Drafted in Phase 1; optimization queued for Phase 2.",
};

export default promptModule;
