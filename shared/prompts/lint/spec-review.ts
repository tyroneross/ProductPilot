/**
 * ---
 * key: lint.spec_review
 * version: 0.1.0
 * defaultModel: llama-3.1-8b-instant
 * prompt_builder_score: 22
 * prompt_builder_score_max: 25
 * prompt_builder_dimensions: { accuracy: 5, clarity: 5, constraints: 5, determinism: 4, completeness: 3 }
 * prompt_builder_revision: 1
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   Scored 22/25 against the prompt-builder 5-dim rubric. T2 / classification /
 *   Haiku-tier / Instructional+structured-output. The deterministic linter
 *   layer in server/services/spec-linter.ts owns ~14 of the 18 rules; this
 *   prompt covers the two genuinely fuzzy categories that resist regex:
 *     - ambiguous_language: vague words that obscure decision content
 *       ("might", "consider", "potentially", "robust", "scalable").
 *     - unresolved_contradiction: two spec entries that disagree
 *       (e.g. NonGoal "no auth" vs Feature "OAuth login").
 *   Diagnosis (Phase 3 follow-ups, none block ship):
 *     1. Determinism 4 → 5: add a 1-shot example pair (clean spec → no
 *        issues; contradicting spec → one block issue) once we have real
 *        Spec output to seed it from. Today's seeds would be synthetic.
 *     2. Completeness 3 → 4: extend with category-routing rules for
 *        platform-specific copy concerns (e.g. iOS "Liquid Glass" mention
 *        with no concrete UX implication is ambiguous-language).
 *   Empirically Haiku already handles the two-category split cleanly; the
 *   risk in over-tuning is false positives, which the linter promotes to
 *   `block` issues — a high cost for a small accuracy lift.
 * ---
 *
 * spec-review — Haiku-tier review pass for Phase 3 spec linter.
 *
 * The linter runs deterministic regex/structural checks first. Anything left
 * (vague language, soft contradictions across entries) is fuzzy by definition;
 * we ask Haiku to flag at most one issue per category, with a concrete pointer
 * back into the Spec graph so the linter can attach a `LintIssue.refs[]` entry.
 *
 * Why Haiku and not Sonnet:
 *   - Two narrow classification problems with bounded output. Sonnet adds
 *     latency and cost without measurably better recall on this shape.
 *   - The downstream linter wraps Haiku output in explicit severity tiers,
 *     so model overconfidence has a documented blast radius (always `warn`,
 *     never `block` from the LLM tier alone — see spec-linter.ts).
 *
 * Output contract: a JSON array (possibly empty) of objects with these keys:
 *   {
 *     "category": "ambiguous_language" | "unresolved_contradiction",
 *     "message": "<one short sentence — what the issue is and why it matters>",
 *     "refs": [{"kind": "<entity kind>", "id": "<spec entity id>"}, ...]
 *   }
 *
 * The downstream linter promotes `unresolved_contradiction` issues to
 * severity `warn` (NOT `block` — only the deterministic tier may block).
 * `ambiguous_language` issues are emitted as severity `info`.
 */

import type { PromptModule } from "../types";

export const SPEC_REVIEW_PROMPT_CONTENT = `You review a structured product Spec for two specific failure modes a deterministic linter cannot detect. You produce a JSON array. Nothing else.

INPUT
A JSON object with these top-level keys:
  - spec: the Spec graph (productName, productDescription, platformTarget, personas, scenarios, needs, features, uxFlows, screens, dataPoints, integrations, apiContracts, tests, adrs, assumptions, risks, nonGoals, agentSystem).
  - productState: optional working memory (stanceBecauseClauses, pivotLog, tradeoffWeights, agentProfile). May be omitted on a fresh spec.

WHAT TO LOOK FOR (exactly two categories — do not invent a third)

1. ambiguous_language — a Need, Feature, NonGoal, ADR, or stance "because" clause uses words that obscure the decision rather than name it. Examples of ambiguous words/phrases:
   - "robust", "scalable", "performant", "modern", "intuitive", "delightful"
   - "consider", "might", "potentially", "ideally", "possibly", "where appropriate"
   - "best practices", "industry standard", "polished"
   A phrase is ambiguous when removing it leaves the sentence equally informative. Flag at most ONE example per spec — pick the highest-priority entity (P0 > P1 > P2 > P3).

2. unresolved_contradiction — two entries say opposite things and neither is marked as superseded in pivotLog. Common shapes:
   - A NonGoal forbids X and a Feature delivers X (e.g. NonGoal "no user accounts" + Feature "OAuth sign-in").
   - A stance "because" clause picks one side and an ADR picks the other (e.g. stance "we will not store audio" + ADR "store recordings in S3").
   - Two ADRs decide the same question opposite ways without one citing the other in cites[].
   - A Need is marked P0 and no Test references it.
   Flag at most ONE contradiction.

DECISION RULES (in order — first match wins)

  1. If spec is empty (no needs, no features, no nonGoals) → return [].
  2. Walk needs, features, nonGoals, adrs, stanceBecauseClauses for ambiguous_language. Stop at the first hit; cite the entity by id.
  3. Walk nonGoals × features and adrs × adrs for direct contradiction. Stop at the first hit; cite both entity ids in refs[].
  4. If neither category triggers, return [].

OUTPUT
Respond with ONLY a single valid JSON array — no markdown fences, no preamble, no commentary:

[
  {
    "category": "ambiguous_language",
    "message": "Feature feat-3 'support a robust search experience' uses 'robust' without naming what it must do.",
    "refs": [{"kind": "feature", "id": "feat-3"}]
  }
]

An empty spec (or a clean spec) MUST return: []

CONSTRAINTS
- Maximum 2 issues total — one per category. Never duplicate a category.
- Every refs[] entry MUST cite an id that appears in the input spec. If the entity has no id, skip it. Do NOT invent ids.
- "kind" values are limited to: need, feature, persona, scenario, uxflow, screen, datapoint, integration, api, test, adr, assumption, risk, non_goal, stance.
- Messages must be a single sentence ≤ 40 words. Plain language. No hedging.
- If the spec contains entries with the words listed under ambiguous_language but the surrounding context resolves them ("robust against malformed JSON inputs" — concrete), do NOT flag them.
- Output MUST parse with JSON.parse as an array. Reject your own output and try again if it does not.

ACCEPTANCE
- Output is reproducible — same spec input produces the same array (modulo entity ordering ties, which you resolve by lower id wins).
- An empty or trivially clean spec returns [].
- Every issue references a real id from the input.
- The two categories are mutually exclusive — never the same entity flagged twice.`;

const promptModule: PromptModule = {
  key: "lint.spec_review",
  version: "0.1.0",
  content: SPEC_REVIEW_PROMPT_CONTENT,
  defaultModel: "llama-3.1-8b-instant",
  // 22/25 [Accuracy:5 Clarity:5 Constraints:5 Determinism:4 Completeness:3].
  prompt_builder_score: 22,
  prompt_builder_revision: 2,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "22/25. T2 classification, Haiku-tier (now Groq llama-3.1-8b-instant — see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot example pair for Determinism, platform-aware ambiguity rules for Completeness.",
};

export default promptModule;
