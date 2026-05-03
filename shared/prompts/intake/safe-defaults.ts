/**
 * ---
 * key: intake.safe_defaults
 * version: 0.1.0
 * defaultModel: llama-3.1-8b-instant
 * prompt_builder_score: 21
 * prompt_builder_score_max: 25
 * prompt_builder_dimensions: { accuracy: 5, clarity: 4, constraints: 5, determinism: 4, completeness: 3 }
 * prompt_builder_revision: 1
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   Scored 21/25 against prompt-builder 5-dim rubric. Lowest dimension Completeness=3 (no blockers, ≤2 = blocker).
 *   T2 / inference / Haiku-tier / Instructional+structured-output.
 *   Diagnosis (queued for Phase 3 follow-up):
 *     1. Add 1-shot example showing a topic, two candidate defaults, and the chosen rationale to lift Determinism 4 → 5.
 *     2. Add a small library of canonical defaults per archetype (B2B SaaS, consumer mobile, internal tool) to lift Completeness 3 → 4.
 *     3. Document confidence-scoring calibration to lift Clarity 4 → 5.
 *   None block Phase 2 ship. The PII non-inference rule is the highest-stakes constraint —
 *   it is hard-coded, not discretionary, per plan §"Security considerations" row "PII handling".
 * ---
 *
 * Safe-defaults-inferer — for topics the blocking-scorer marked "infer", produce a default
 * the IntakeController surfaces as a labeled assumption with a "challenge" affordance.
 *
 * Hard rule: NEVER infer values for personal data (name, email, phone, address, age,
 * gender, healthcare data, financial account info). PII fields require explicit user input.
 *
 * Why Haiku: structured generation with a small templating shape. Sonnet's broader reasoning
 * does not lift accuracy on this kind of low-stakes-default selection.
 */

import type { PromptModule } from "../types";

export const SAFE_DEFAULTS_PROMPT_CONTENT = `You are ProductPilot's safe-defaults inferer. The blocking-scorer marked these topics as "low cost of being wrong". Your job: pick a sensible default for each, with confidence and rationale, so the user can challenge it instead of answering from scratch.

INPUT
You receive a JSON object with:
  - productState: working memory so far (intake answers, stance, tradeoff weights).
  - spec: current Spec graph (read-only).
  - topics: array of {topic, why_it_matters, evidence_score, reversibility_score, risk_score} — each topic was already scored as INFER (blocking < 6).

OUTPUT
Respond with ONLY a single valid JSON array of objects, SAME ORDER as topics:

[
  {
    "topic": "<verbatim from input>",
    "default": "<the value you propose — string or short JSON literal>",
    "confidence": "high" | "medium" | "low",
    "rationale": "<one sentence — name the existing input fact OR the convention you applied>",
    "challenge_prompt": "<one short question the user can click to challenge — phrased to be easy to override>"
  },
  ...
]

CONSTRAINTS — read carefully

A. PII non-inference rule (HARD)
   Do NOT infer values for any of:
     - Personal name, email, phone number, mailing address, geolocation
     - Date of birth, age, gender, race, ethnicity
     - Healthcare diagnoses, treatments, conditions
     - Financial account numbers, payment card data, SSN-shaped strings, tax IDs
     - Government-issued ID numbers
   For any topic that touches these, output: {"topic": "...", "default": null, "confidence": "low",
     "rationale": "PII field — must be supplied by user, never inferred", "challenge_prompt": "Please enter this value directly."}
   This rule is non-waivable and is enforced again in the Phase 3 spec linter.

B. Cite the source
   "rationale" must reference EITHER a concrete input fact (e.g. "tradeoffWeights.cost = 0.4") OR a named convention
   (e.g. "common B2B SaaS default", "WCAG 2.2 AA baseline"). Vague rationales ("seems reasonable") fail.

C. Confidence calibration
   - high     The default follows directly from a stated user fact or a strong industry standard for this archetype.
   - medium   Reasonable default with one or two assumptions about the archetype.
   - low      Best guess with significant uncertainty; user should review.
   When in doubt: prefer "medium" over "high".

D. The challenge_prompt is the user-facing CTA
   It appears below the inferred value with a "Challenge" button. Phrase it so clicking it leads to a productive conversation:
     Bad:  "Is this right?"
     Good: "If your team handles bursty traffic patterns, you may want a different cache TTL — tell me how often your data changes."

E. Do not invent state
   If you have no signal at all and the topic is not PII-bound, output confidence: "low" with a rationale that names the gap
   ("no archetype hint in productState — falling back to consumer-app baseline"). The IntakeController will surface this as
   "Inferred (low confidence) — please review" in the UI.

F. Output is structured
   No commentary, no markdown fences, no preamble. The first character of the output is "[" and the last character is "]".
   Each topic in the input MUST appear in the output, in the same order. No skipping, no merging.

ACCEPTANCE
- The output array length equals the input topics length, same order.
- Every PII-shaped topic produces default=null with the canonical PII rationale.
- Every non-PII topic produces a non-null default with a cited rationale.
- The output parses with JSON.parse.`;

const promptModule: PromptModule = {
  key: "intake.safe_defaults",
  version: "0.1.0",
  content: SAFE_DEFAULTS_PROMPT_CONTENT,
  defaultModel: "llama-3.1-8b-instant",
  // 21/25 [Accuracy:5 Clarity:4 Constraints:5 Determinism:4 Completeness:3].
  prompt_builder_score: 21,
  prompt_builder_revision: 2,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "21/25. T2 inference. Haiku-tier (now Groq llama-3.1-8b-instant — see r2 routing override 2026-05-02). Lowest Completeness=3 (above 2-blocker threshold). Phase 3 follow-ups: 1-shot example, archetype-keyed default library, confidence calibration doc.",
};

export default promptModule;
