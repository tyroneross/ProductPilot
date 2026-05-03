/**
 * ---
 * key: intake.blocking_scorer
 * version: 0.1.0
 * defaultModel: llama-3.1-8b-instant
 * prompt_builder_score: 22
 * prompt_builder_score_max: 25
 * prompt_builder_dimensions: { accuracy: 5, clarity: 4, constraints: 5, determinism: 4, completeness: 4 }
 * prompt_builder_revision: 1
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   Scored 22/25 against prompt-builder 5-dim rubric (no blockers; lowest 4).
 *   T2 / scoring / Haiku-tier / Instructional+structured-output.
 *   Diagnosis (queued for Phase 3 follow-up):
 *     1. Add 1-shot example showing all three axes scored on a sample unknown to lift Determinism 4 → 5.
 *     2. Document threshold-tuning rationale (why 6 = block) to lift Clarity 4 → 5.
 *     3. Add "evidence already on file" detection to short-circuit re-asking to lift Completeness 4 → 5.
 *   None block Phase 2 ship. The 3-axis variant was chosen over the 4-axis variant per
 *   plan §"Decisions and rationale" — adding more axes did not improve eval scores.
 * ---
 *
 * Blocking-scorer — scores each candidate unknown on three axes:
 *   - evidence:      do we have ANY signal on this from the user yet?  0 = none, 5 = direct quote
 *   - reversibility: how cheaply can we change this decision later?    0 = irreversible, 5 = trivial
 *   - risk:          if we infer wrong, how bad is the failure?         0 = cosmetic, 5 = catastrophic
 *
 * Final blocking score = (5 - evidence) + (5 - reversibility) + risk
 * Range: 0 to 15. Threshold for "ask, don't infer" = ≥ 6.
 *
 * Why Haiku: scoring is structured + deterministic-leaning. Sonnet's extra
 * reasoning does not measurably improve calibration on this 3-axis decomposition.
 *
 * Why these three axes (plan §"Decisions and rationale", row 4):
 *   The 4-axis variant added "user_volunteered" as a separate signal. That double-counted
 *   evidence and misranked unknowns where the user had spoken but the answer was thin.
 *   Sticking with three keeps the math interpretable.
 */

import type { PromptModule } from "../types";

export const BLOCKING_SCORER_PROMPT_CONTENT = `You are ProductPilot's blocking-question scorer. Each candidate unknown gets three numeric scores so the IntakeController can decide which to ASK and which to INFER with safe defaults.

THE THREE AXES (each 0–5, integer only)

evidence — How much signal do we already have from the user about this unknown?
  0  No signal. Nothing in productState, intake answers, or supplied context speaks to it.
  1  Adjacent signal only — user mentioned something nearby but not this.
  2  Indirect inference possible — could be guessed from one stated fact.
  3  Partial direct signal — user touched on it but left it ambiguous.
  4  Strong direct signal — user has stated a stance but not the specific value.
  5  Direct quote on file — verbatim user statement settles the question.

reversibility — If we lock in the WRONG default and discover the mistake later, how cheaply can we change it?
  0  Irreversible. Public commitment, regulatory, schema migration that loses data, third-party contract.
  1  Very expensive. Multi-stage refactor, customer notification, multi-week rebuild.
  2  Costly. Cross-team coordination needed; multiple files; possible breakage.
  3  Modest. One PR, well-scoped tests; no user-visible disruption.
  4  Cheap. Single-file edit; no migration; no comms needed.
  5  Trivial. Toggle a config; revert the line; no observable effect.

risk — If we infer wrong on this and proceed, how severe is the downstream failure?
  0  Cosmetic. Mismatched copy, low-stakes UI choice.
  1  Annoying. Minor user friction; recoverable with a hint.
  2  Functional. A flow takes more steps than ideal; users complete it but complain.
  3  Loss-bearing. Specific user segment loses access or has to redo work.
  4  Trust-bearing. Privacy/data confusion, billing surprise, dropped data.
  5  Catastrophic. Compliance violation, security breach, brand event, data loss.

INPUT
You receive a JSON object with:
  - productState: working memory so far.
  - spec: current Spec graph (read-only).
  - candidates: array of {topic, why_it_matters} unknowns the controller wants ranked.

For EACH candidate, score the three axes against the supplied state.

OUTPUT
Respond with ONLY a single valid JSON array of objects in the SAME ORDER as candidates:

[
  {
    "topic": "<verbatim from candidate>",
    "evidence": <0..5 integer>,
    "reversibility": <0..5 integer>,
    "risk": <0..5 integer>,
    "blocking": <evidence and reversibility transformed; computed as (5 - evidence) + (5 - reversibility) + risk>,
    "decision": "ask" | "infer",
    "reason": "<one sentence — what evidence you used; what makes it ask-worthy or infer-safe>"
  },
  ...
]

DECISION RULE
  - blocking >= 6  → "ask"   (high cost of being wrong, low signal yet)
  - blocking <  6  → "infer" (the controller will use safe-defaults-inferer for this topic)

CONSTRAINTS
- All three axis scores are integers 0–5 inclusive. No floats. No negative numbers.
- The "blocking" field is the deterministic formula — DO NOT reinterpret. The controller cross-checks.
- The output array length equals the input candidates length, in the same order. No skipping.
- The "reason" must cite a specific input fact ("personas[0].trigger empty", "tradeoffWeights.security=0.5"). Vague reasons ("seems risky") fail.
- If two axis scores are tied, prefer the more conservative interpretation: lower evidence, lower reversibility, higher risk.

ACCEPTANCE
- Reproducible: same input → same scores ± 0.
- Output parses with JSON.parse and exactly matches the shape above.
- All decision values are exactly "ask" or "infer" (no other strings, no booleans).
- Edge case — if a candidate has zero context to score against, evidence=0, reversibility=0, risk=5 (always ask in pure ignorance).`;

const promptModule: PromptModule = {
  key: "intake.blocking_scorer",
  version: "0.1.0",
  content: BLOCKING_SCORER_PROMPT_CONTENT,
  defaultModel: "llama-3.1-8b-instant",
  // 22/25 [Accuracy:5 Clarity:4 Constraints:5 Determinism:4 Completeness:4].
  prompt_builder_score: 22,
  prompt_builder_revision: 2,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "22/25. T2 scoring. Haiku-tier (now Groq llama-3.1-8b-instant — see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot worked example, threshold-tuning rationale, evidence-on-file short-circuit.",
};

export default promptModule;
