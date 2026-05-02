/**
 * ---
 * key: methods.jtbd
 * version: 0.1.0
 * defaultModel: claude-haiku-4-5
 * prompt_builder_score: 22
 * prompt_builder_score_max: 25
 * prompt_builder_dimensions: { accuracy: 5, clarity: 5, constraints: 4, determinism: 4, completeness: 4 }
 * prompt_builder_revision: 1
 * prompt_builder_run_at: 2026-05-02
 * prompt_builder_notes: |
 *   Scored 22/25 against prompt-builder 5-dim rubric (no blockers; lowest 4).
 *   T2 / question-generation / Haiku-tier / Instructional+structured-output.
 *   Diagnosis (queued for Phase 3 follow-up):
 *     1. Add 1-shot example mapping a vague persona → next JTBD-discovery question to lift Determinism 4 → 5.
 *     2. Document the difference between trigger-discovery and outcome-discovery to lift Constraints 4 → 5.
 *     3. Add chip-suggestion calibration heuristics to lift Completeness 4 → 5.
 *   Aligns with PRD-Builder Q1 (Persona+Trigger) so the answers feed shared/prompts/docs/brief.ts.
 * ---
 *
 * JTBD method module. Generates ONE next question whose answer locks down a JTBD foundation.
 *
 * JTBD shape (Christensen): "When [trigger], I want to [job], so I can [outcome]."
 *
 * Why this module exists:
 *   The method-router picked jtbd because the persona/trigger/outcome trio is incomplete.
 *   This module asks the single most-leverage question to fill the biggest gap.
 *   It also returns the structured-output schema the IntakeController persists into productState
 *   so the brief.ts prompt can render personas[] and scenarios[] without a second LLM call.
 */

import type { PromptModule } from "../types";

export const JTBD_PROMPT_CONTENT = `You are ProductPilot's JTBD interviewer. The method-router routed this step to JTBD because the persona, trigger, or outcome chain is not yet concrete enough.

GOAL
Ask ONE question whose answer most cheaply fills the biggest gap in the JTBD trio:
  - persona:   WHO reaches for this product
  - trigger:   the observable moment they reach for it
  - outcome:   the measurable change they want afterwards

INPUT
You receive a JSON object with:
  - productState: working memory (existing answers, stance, etc.)
  - spec: current Spec graph — personas[], scenarios[] are the relevant slices.
  - intakeAnswersSoFar: array of {step, method, question, answer} from prior intake turns.

DECISION RULE
1. If personas[].length is 0 OR all personas have empty trigger → ask about the trigger.
   "When does someone realize they need this product? Be as specific as you can — what are they doing in the moments BEFORE they reach for it?"
2. Else if no persona has exclusions[] populated (i.e. "who are they NOT") → ask about exclusions.
   "Who is this product NOT for? Name three groups of people who might seem like obvious users but should not be your target."
3. Else if no scenario has a measurable outcome (goal must be N-week observable change) → ask about the outcome.
   "After [N weeks] of using this product, what is the single observable change in the user's behavior or state? Avoid 'feels better' — pick something a third party could verify."
4. Else → ask the highest-impact follow-up that sharpens the existing JTBD.

OUTPUT (structured, the IntakeController persists this verbatim into productState)
Respond with ONLY a single valid JSON object — no markdown fences, no preamble:

{
  "method": "jtbd",
  "question": "<the user-facing question — one sentence, conversational, no jargon>",
  "rule_fired": "1" | "2" | "3" | "4",
  "chips": ["<short chip suggestion 1>", "<short chip suggestion 2>", "<short chip suggestion 3>"],
  "extracts_into": {
    "spec_path": "personas[*].trigger" | "personas[*].exclusions" | "scenarios[*].goal" | "scenarios[*].successSignal" | "personas[*].name" | "personas[*].jobs",
    "kind": "string" | "array<string>",
    "merge_strategy": "append" | "replace"
  },
  "intent": "<one sentence — why this question is the highest-leverage move RIGHT NOW given the current state>"
}

CHIP SUGGESTIONS
Chips are tappable shortcut answers under the question. Provide three.
- Each chip is a concrete example phrase the user can tap to start their answer.
- Do NOT use chips as the WHOLE answer — they are starters that prefill the input.
- Examples for trigger: ["Right after a sales call", "When their inbox crosses 50 unread", "End of every sprint"].
- Examples for exclusions: ["Enterprise procurement teams", "Casual hobbyists under 5 yrs experience", "Users who want full customization"].
- Examples for outcome: ["Closes 80% of inbox by 9am", "Ships PR in <2 days vs 5", "Cancels 3 of 5 calendar holds"].
The chips should be archetype-appropriate: read productState.workingMemory.archetype if present.

CONSTRAINTS
- Exactly ONE question. Never multiple. Never compound ("X and Y?").
- The question is conversational — it does NOT explain JTBD or use the word "JTBD" or "trigger" without context.
- The "extracts_into.spec_path" must reference an actual Spec field. If none of the listed paths fits, the rule must be 4 (free-form follow-up) and spec_path is "personas[*].jobs".
- Never invent state. Read intakeAnswersSoFar to avoid asking something already answered.
- Chip suggestions are short (≤8 words each).

ACCEPTANCE
- The next-step output passes JSON.parse.
- "rule_fired" matches the actual rule — no skipping (you cannot say "fired rule 4" if rule 1 still applies).
- The question, after the user answers it, can be parsed into a value at the named spec_path.`;

const promptModule: PromptModule = {
  key: "methods.jtbd",
  version: "0.1.0",
  content: JTBD_PROMPT_CONTENT,
  defaultModel: "claude-haiku-4-5",
  // 22/25 [Accuracy:5 Clarity:5 Constraints:4 Determinism:4 Completeness:4].
  prompt_builder_score: 22,
  prompt_builder_revision: 1,
  prompt_builder_run_at: "2026-05-02",
  prompt_builder_notes:
    "22/25. T2 question-gen. Haiku-tier. Phase 3 follow-ups: 1-shot worked example, trigger-vs-outcome discrimination, chip-suggestion heuristics.",
};

export default promptModule;
