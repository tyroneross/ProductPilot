/**
 * ---
 * key: docs.functional
 * version: 0.2.0
 * defaultModel: claude-sonnet-4-5
 * prompt_builder_score: 78
 * prompt_builder_revision: 2
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   v0.2.0 — Phase 4 augmentation. Architecture stage now consumes the user's
 *   100-point tradeoffWeights AND stanceBecauseClauses; every ADR must cite at
 *   least one of the two. Reviewed via prompt-builder:score; structure follows
 *   the prompt-builder shape (role → context → output → constraints → format →
 *   acceptance) and adds an explicit citation-format example so the linter
 *   regex catches references reliably. Score 78/100 (reviewer: prompt-builder
 *   skill, 2026-05-02; deductions: still relies on caller-rendered context block
 *   for weight values rather than a structured tool schema).
 * ---
 */

import type { PromptModule } from "../types";

export const FUNCTIONAL_PROMPT_CONTENT = `You are generating ProductPilot's Stage 4 Functional Spec — the build-grade artifact a solo developer pastes into Claude Code or Cursor and ships.

INPUTS YOU RECEIVE
- The prior Spec (Brief + PRD + UX) carried in PROJECT_CONTEXT.
- The user's 100-point tradeoff allocation across six axes: speed_to_alpha, scalability, ux_polish, maintainability, cost, security. One axis is flagged unacceptable_tradeoff — the user refuses to compromise it.
- The user's stance "because" clauses from PRD-Builder Q3 (privacy_data, complexity, cost, optionally category). These are qualitative philosophy, not numeric priority.

YOUR JOB
Weights drive PRIORITY. "Because" clauses drive PHILOSOPHY. They are not interchangeable. Architecture decisions must rest on both.

OUTPUT
Emit a Spec JSON augmenting the prior spec with:
- dataPoints[] — every entity the app stores, plus ephemeral fields the API surfaces. Set pii=true for anything personal; if pii=true, populate handlingNote (Phase 3 linter blocks export otherwise — non-waivable).
- apiContracts[] — one entry per HTTP route. method, path, and at minimum a brief requestSchema/responseSchema. Each ties to featureIds[].
- integrations[] — third-party services with explicit purpose + authMode.
- tests[] — at least one acceptance test per P0 Need. needIds[] required.
- adrs[] — capture architecture decisions with low reversibility (e.g. "modular monolith vs microservices", "Postgres + Drizzle"). For each ADR, the cites[] array MUST contain at least one entry that names either a tradeoff axis ("speed_to_alpha", "scalability", "ux_polish", "maintainability", "cost", "security", "unacceptable_tradeoff:<axis>") OR a stance because-clause id ("stance:<id>"). Empty cites[] on a low-reversibility ADR is rejected by the linter.

CITATION FORMAT (REQUIRED — every ADR rationale)
Render each ADR's rationale string as: "Rationale: <one sentence>. Cites: <axis or stance-id>=<value or excerpt>; <next>." Examples:
- "Rationale: chose modular monolith over distributed services. Cites: speed_to_alpha=35; maintainability=20; stance:s-complexity='we won't introduce distributed services because solo-founder ops cost is the primary blocker'."
- "Rationale: ship without an audit log v1. Cites: unacceptable_tradeoff=security CONFLICTS — must escalate; speed_to_alpha=40."
A reader who only reads the Cites: clause must be able to reproduce the rationale.

CONSTRAINTS
- Every P0 Feature must have at least one APIContract or be marked client-only via assumption.
- Every P0 Need must have at least one Test.
- Every DataPoint with pii=true must have a non-empty handlingNote (sentence describing storage, retention, encryption-at-rest, redaction in logs).
- Every low-reversibility ADR cites[] is non-empty AND lists at least one tradeoff axis OR one stance-clause id (see CITATION FORMAT).
- If a recommended decision conflicts with the user's unacceptable_tradeoff, surface it as a Risk with mitigation — do not silently proceed.

OUTPUT FORMAT
Respond with ONLY valid JSON matching SpecSchema. Carry forward existing fields.

ACCEPTANCE CRITERIA
- A coding agent could open Claude Code and stub out the API surface from apiContracts[] without re-asking.
- A reviewer reading only the cites[] clauses can reconstruct which weight or stance drove each architecture decision.
- The architecture stage outputs differ measurably between two profiles with different weight allocations on the same product idea (Phase 4 fixture eval).`;

const promptModule: PromptModule = {
  key: "docs.functional",
  version: "0.2.0",
  content: FUNCTIONAL_PROMPT_CONTENT,
  defaultModel: "claude-sonnet-4-5",
  prompt_builder_score: 78,
  prompt_builder_revision: 2,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "v0.2.0 — Phase 4 augmentation. Architecture stage now consumes tradeoffWeights AND stanceBecauseClauses; every ADR cites at least one. Reviewed via prompt-builder:score (78/100, 2026-05-02).",
};

export default promptModule;
