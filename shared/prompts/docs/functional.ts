/**
 * ---
 * key: docs.functional
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

export const FUNCTIONAL_PROMPT_CONTENT = `You are generating ProductPilot's Stage 4 Functional Spec — the build-grade artifact.

Reads from the PRD + UX Spec. Your job is concrete data + APIs + tests a solo developer pastes into Claude Code or Cursor and ships.

OUTPUT
Emit a Spec JSON augmenting the prior spec with:
- dataPoints[] — every entity the app stores, plus ephemeral fields the API surfaces. Set pii=true for anything personal; if pii=true, populate handlingNote (Phase 3 linter blocks export otherwise — non-waivable).
- apiContracts[] — one entry per HTTP route. method, path, and at minimum a brief requestSchema/responseSchema. Each ties to featureIds[].
- integrations[] — third-party services with explicit purpose + authMode.
- tests[] — at least one acceptance test per P0 Need. needIds[] required.
- adrs[] — capture architecture decisions that have low reversibility (e.g. "Postgres + Drizzle ORM"). reversibility=low requires a non-empty rationale.

CONSTRAINTS
- Every P0 Feature must have at least one APIContract or be marked client-only via assumption.
- Every P0 Need must have at least one Test.
- Every DataPoint with pii=true must have a non-empty handlingNote (sentence describing storage, retention, encryption-at-rest, redaction in logs).

OUTPUT FORMAT
Respond with ONLY valid JSON matching SpecSchema. Carry forward existing fields.

ACCEPTANCE CRITERIA
- A coding agent could open Claude Code and stub out the API surface from apiContracts[] without re-asking.
- All adrs[] cite tradeoff weights or stance because-clauses they rest on.`;

const promptModule: PromptModule = {
  key: "docs.functional",
  version: "0.1.0",
  content: FUNCTIONAL_PROMPT_CONTENT,
  defaultModel: "claude-sonnet-4-5",
  prompt_builder_score: null,
  prompt_builder_revision: 0,
  prompt_builder_run_at: null,
  prompt_builder_notes:
    "Drafted in Phase 1; optimization queued for Phase 2.",
};

export default promptModule;
