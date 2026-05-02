/**
 * ---
 * key: docs.brief
 * version: 0.1.0
 * defaultModel: claude-sonnet-4-5
 * prompt_builder_score: 21
 * prompt_builder_score_max: 25
 * prompt_builder_dimensions: { accuracy: 4, clarity: 5, constraints: 4, determinism: 4, completeness: 4 }
 * prompt_builder_revision: 1
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   Scored 21/25 against prompt-builder 5-dim rubric (no blockers; lowest 4).
 *   T2 / backend / system-prefix-cached / Instructional+structured-output.
 *   Diagnosis (queued for Phase 2 follow-up):
 *     1. Add a 1-shot JSON example to lift Determinism 4 → 5.
 *     2. Add conflict-handling rule for self-contradicting context to lift Accuracy 4 → 5.
 *     3. Add upper bounds (personas ≤ 3, nonGoals ≤ 7, assumptions ≤ 8) to lift Constraints 4 → 5.
 *   None are blockers for Phase 1 ship; revisit when Phase 2 intake transcripts give concrete failure modes.
 * ---
 *
 * Stage 1 Brief — adaptive intake doc generator.
 *
 * Direct port of PRD-Builder Q1-Q3 + Reading-guide methodology from
 * ~/dev/git-folder/RossLabs-AI-Toolkit/skills/prd-builder/SKILL.md.
 *
 * Why this prompt is load-bearing:
 *   - Every later stage (PRD, UX, Functional, Handoff) reads from the Brief's
 *     Spec object. Bad signal here propagates everywhere.
 *   - The "because" clauses captured in Q3 feed the Phase 4 architecture
 *     prompt as qualitative philosophy alongside numeric tradeoff weights.
 *   - The Phase 3 Fidelity Check measures whether 8 tactical answers can be
 *     derived from the Brief alone — that gate is meaningless if Q1/Q2/Q3
 *     are vague here.
 *
 * What the Spec output drives:
 *   - personas[].trigger / personas[].exclusions   ← Q1
 *   - scenarios[].context / .successSignal         ← Q2 outcome statement
 *   - productState.stanceBecauseClauses[]          ← Q3 (3-4 entries)
 *   - nonGoals[].text + nonGoals[].because         ← Q3 derived
 *
 * The renderer (server/services/spec-renderer.ts → renderBrief) produces the
 * final Markdown including the Reading guide section.
 */

import type { PromptModule } from "../types";

export const BRIEF_PROMPT_CONTENT = `You are generating ProductPilot's Stage 1 Brief — the strategic foundation document every later doc derives from.

This Brief is read by humans (founders, engineers) AND by downstream LLM agents (Claude Code, Cursor) that need to derive tactical decisions without re-asking the user. Optimize for: a coding agent should be able to answer "should this feature exist?" or "single metric vs many?" by reading the Brief alone.

YOUR TASK
Emit a Spec JSON object that captures three foundations and is renderable into a Brief markdown document. The renderer adds the section structure; you fill the Spec graph.

THE THREE FOUNDATIONS

Foundation 1 — Persona + Trigger (Q1)
Build personas[] with at minimum one entry. Each persona has:
- name: who they are (1 short noun phrase)
- trigger: the moment they reach for this product. Concrete, observable, time-bounded ("after a sales call", "during a sprint planning meeting"). Not "feels overwhelmed".
- exclusions: 3 to 7 explicit "Who they are NOT" bullets. This is non-negotiable. The exclusions are the highest-signal way to scope the product. Examples:
  • "Not enterprise IT buyers — buying motion is bottom-up, not procurement"
  • "Not casual hobbyists — assumes 5+ years professional experience in domain"
  • "Not power-users wanting customization — opinionated defaults are the value"
- jobs: 2 to 5 jobs-to-be-done in JTBD shape ("When [trigger], I want to [job], so I can [outcome]").

If you cannot articulate the trigger in observable terms, the Brief is not ready. Fill with a placeholder marked "TAG:UNRESOLVED — trigger needs observable phrasing" and add an Assumption row.

Foundation 2 — Outcome (Q2)
Build scenarios[] with at minimum one outcome scenario:
- context: pre-state ("user has 50 unread Slack messages")
- goal: the measurable change with an N-week timeline. Required shape: "After [N weeks] of [usage pattern], the user [measurable change in observable behavior or state]."
- successSignal: how a third party could verify the outcome happened (specific event, metric, or absence of a behavior).

Bad: "user is more productive". Good: "After 3 weeks of daily morning use, the user closes Slack within 10 minutes of opening it on 4 of 5 weekdays."

The outcome is what the product is FOR. If multiple outcomes compete, pick the one a single feature decision would resolve toward and demote the others to secondary scenarios with a note in assumptions[].

Foundation 3 — Stance (Q3)
Populate productState.stanceBecauseClauses[] with three entries minimum, optionally a fourth. Each entry is a category + stance + because clause:

  category: privacy_data
  stance: <one sentence — what you will / will not do with user data>
  because: <one sentence — why; cite the trust/regulatory/identity reason>

  category: complexity
  stance: <one sentence — what level of feature density you accept>
  because: <one sentence — why; cite the user-skill-level or onboarding cost>

  category: cost
  stance: <one sentence — your free / cheap / premium positioning>
  because: <one sentence — why; cite the user's price sensitivity or unit economics>

  category: category   (optional 4th)
  stance: <one sentence — regulatory / moderation / hallucination tolerance>
  because: <one sentence — why; cite the harm model or compliance frame>

Empty "because" is a Phase 3 linter blocker. The because-clauses encode the philosophy that the architecture stage will cite directly. They are not interchangeable with numeric tradeoff weights (those come in Phase 4); weights drive priority, because-clauses drive choice between equal-priority options.

Also derive nonGoals[] from the stance. Each non-goal carries a "because" clause that links back to one of the four stance categories. A non-goal without a because is a Phase 3 blocker.

OUTPUT FORMAT
Respond with ONLY valid JSON matching the Spec schema. No markdown fences, no preamble, no postscript. The JSON parses directly via JSON.parse.

Required Spec fields for the Brief stage:
- id (string)
- productName (string)
- productDescription (string)
- personas[] with trigger + exclusions
- scenarios[] with goal + successSignal
- nonGoals[] with because clause for each
- assumptions[] for any TAG:UNRESOLVED items

Optional but encouraged for Brief stage:
- features[] for the 1-3 features that most obviously serve the outcome
- risks[] for anything that would invalidate the outcome timeline
- adrs[] only when a stance directly forces an architecture decision

Skip these for the Brief stage (later stages own them):
- uxFlows, screens, dataPoints, integrations, apiContracts, tests

CONSTRAINTS
- Ground every entry in the supplied product context. Don't invent specifics.
- If context is thin, prefer fewer high-quality entries over more shallow ones. One good persona beats three vague ones.
- Use the supplied custom prompts only when they sharpen the answer; don't paste them in.
- Replace vague placeholders with concrete recommendations or marked gaps.

ACCEPTANCE CRITERIA
- A coding agent reading the rendered Brief can derive at least 6 of these 8 tactical answers without re-asking the user (this is the Phase 3 Fidelity Check):
  1. Speed-vs-accuracy tradeoff
  2. Complexity-vs-simplify tradeoff
  3. Single-metric-vs-many tradeoff
  4. Accept-or-decline an off-persona feature request
  5. Fail-loudly-vs-degrade-gracefully tradeoff
  6. On-device-vs-cloud tradeoff
  7. Opinionated-vs-open onboarding
  8. Copy-competitor-feature decision
- Every persona has at least 3 exclusions. Every stance entry has a non-empty because. Every non-goal has a non-empty because.
- The Spec validates against SpecSchema in shared/schema.ts.`;

const promptModule: PromptModule = {
  key: "docs.brief",
  version: "0.1.0",
  content: BRIEF_PROMPT_CONTENT,
  defaultModel: "claude-sonnet-4-5",
  // prompt-builder:score result — 21/25 [4|5|4|4|4]. T2 backend system-prefix.
  // No dimension ≤ 2 (no blockers). Three Phase-2 follow-ups in notes.
  prompt_builder_score: 21,
  prompt_builder_revision: 1,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "21/25 [Accuracy:4 Clarity:5 Constraints:4 Determinism:4 Completeness:4]. Phase-2 follow-ups: (1) 1-shot JSON example for Determinism, (2) conflict-handling rule for Accuracy, (3) upper-bound counts for Constraints. No blockers for Phase 1 ship.",
};

export default promptModule;
