/**
 * ---
 * key: intake.method_router
 * version: 0.1.0
 * defaultModel: llama-3.1-8b-instant
 * prompt_builder_score: 22
 * prompt_builder_score_max: 25
 * prompt_builder_dimensions: { accuracy: 5, clarity: 5, constraints: 4, determinism: 4, completeness: 4 }
 * prompt_builder_revision: 2
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   Scored 22/25 against prompt-builder 5-dim rubric (no blockers; lowest 4).
 *   T2 / classification / Haiku-tier / Instructional+structured-output.
 *   Diagnosis (queued for Phase 3 follow-up):
 *     1. Add 1-shot example mapping a paragraph idea → method label to lift Determinism 4 → 5.
 *     2. Add a "no method fits" escape hatch that emits "free_form" to lift Constraints 4 → 5.
 *     3. Document tie-breaking when two methods score equally to lift Completeness 4 → 5.
 *   None block Phase 2 ship. The simpler version performs better empirically because the
 *   IntakeController orchestrator handles ties deterministically; LLM does not need to.
 * ---
 *
 * Method-router — picks ONE of three intake methods per current step.
 *
 * Methods (plan §"Decisions and rationale", row 4):
 *   - jtbd:  ambiguous user/persona/trigger; need to lock down WHO + WHEN before WHAT.
 *   - qfd:   features in flight, need to weight which need they serve. Light: persona × need × feature triplets, no House of Quality matrix.
 *   - pugh:  two or more candidate solutions, need to compare them on a fixed criteria axis.
 *
 * Why a fast classification tier (Haiku-class):
 *   - Output is one short JSON object. A reasoning tier adds latency without lifting accuracy.
 *   - Method choice is a 3-way classification — Haiku-class wheelhouse.
 *   - 2026-05-02: defaultModel is `llama-3.1-8b-instant` on Groq (deflated
 *     Anthropic Haiku-tier). The shape is identical; an Anthropic Haiku
 *     remains reachable via BYOK userConfig when callers want it.
 *
 * Output contract: {"method": "jtbd"|"qfd"|"pugh", "reason": "<one sentence>"}
 */

import type { PromptModule } from "../types";

export const METHOD_ROUTER_PROMPT_CONTENT = `You are ProductPilot's intake method router. Pick exactly ONE of three analytical methods to drive the next intake question.

THE THREE METHODS

jtbd — Jobs To Be Done
  Use when: persona, trigger, or core "job" is still vague. Output of this step: a "When [trigger], I want to [job], so I can [outcome]" framing.
  Signals to pick this: user description names a vague audience ("people who want to be more productive"), no observable trigger, multiple competing personas mashed together.

qfd — lightweight Quality Function Deployment
  Use when: persona is locked but feature priorities are unclear. Output of this step: which need has highest weight given the personas you already have.
  Signals to pick this: features list exists, persona/trigger is concrete, but the user has not said which feature MOST advances which job. NOT the full House of Quality — you only weight persona × need × feature triplets.
  Skip qfd if features[] is empty; route to jtbd to populate need-discovery first.

pugh — Pugh concept selection matrix
  Use when: two or more candidate approaches/architectures/UX flows exist and the choice is unresolved. Output of this step: which alternative wins on the user's tradeoff weights.
  Signals to pick this: user has named ≥2 distinct ways to solve the same need ("we could do X or Y"), or the spec contains ADRs marked "decision pending", or there are ≥2 features serving the same need with different stances.

INPUT
You receive a JSON object with:
  - productState: current working memory (intake answers so far, stance, tradeoff weights, pivots).
  - spec: current Spec graph — needs, features, personas, scenarios, ADRs (read-only).
  - lastQuestion: the question just answered, if any (to detect direct follow-up signal).
  - blockingTopUnknowns: array of {topic, evidence_score, reversibility_score, risk_score} from the blocking-scorer — already-prioritized unknowns the controller wants to address next.

DECISION RULE (in priority order — first match wins)

  1. If personas is empty OR every persona lacks a concrete trigger → jtbd.
  2. If ≥2 ADRs are marked "decision pending" OR ≥2 features serve the same need → pugh.
  3. If features[] is non-empty AND tradeoffWeights are populated AND no need has a primary feature → qfd.
  4. Otherwise: pick the method that the highest-weighted blocking unknown most naturally calls for. Prefer jtbd when in doubt — it is the cheapest correction.

OUTPUT
Respond with ONLY a single valid JSON object — no markdown fences, no preamble:

{"method": "jtbd" | "qfd" | "pugh", "reason": "<one sentence — name the rule that fired and the field that triggered it>"}

CONSTRAINTS
- Exactly one method. Never an array, never null, never two.
- The "reason" must reference a concrete signal from the input (a field, a count, an empty array). Vague reasons ("seems like jtbd") fail the determinism gate.
- If you cannot pick confidently, default to jtbd and say so in reason: "low confidence — defaulting to jtbd per Rule 4 fallback."
- Do not invent state that is not in the input. If personas is missing, treat it as empty.

ACCEPTANCE
- The decision is reproducible — same input → same method.
- The reason cites a field or count from the input.
- The output parses with JSON.parse and exactly matches the shape above.`;

const promptModule: PromptModule = {
  key: "intake.method_router",
  version: "0.1.0",
  content: METHOD_ROUTER_PROMPT_CONTENT,
  defaultModel: "llama-3.1-8b-instant",
  // 22/25 [Accuracy:5 Clarity:5 Constraints:4 Determinism:4 Completeness:4].
  prompt_builder_score: 22,
  prompt_builder_revision: 2,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "22/25. T2 classification. Haiku-tier (now Groq llama-3.1-8b-instant — see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot example, no-fit escape hatch, tie-break documentation.",
};

export default promptModule;
