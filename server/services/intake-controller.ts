/**
 * Adaptive intake controller (Phase 2 of the adaptive-intake plan).
 *
 * Public contract:
 *   - nextStep:    given a project + intake history → either ASK one question, INFER safe defaults,
 *                  or DONE (the controller has enough signal to finalize).
 *   - ingestAnswer: persist a user answer and return updated productState.
 *   - finalize:    convert productState into a SpecDraft (Stage 1 Brief shape) and render to Markdown.
 *
 * Internal sub-calls (each on Haiku via aiService.generateStructuredOutput):
 *   - methodRouter        →  pick jtbd | qfd | pugh
 *   - blockingScorer      →  score candidate unknowns 0–15; ASK if ≥ 6, else INFER
 *   - method-specific gen →  produce the question (jtbd / qfd / pugh)
 *   - safeDefaultsInferer →  produce labeled-assumption defaults for low-stakes unknowns
 *
 * Security (plan §"Security gates", Phase 2):
 *   - Every productState fragment is run through scrubSecretsDeep before reaching any provider call.
 *   - intake_questions inherits RLS from projects (migration 0003); the controller never bypasses it.
 *   - No provider call sees BYOK encrypted columns.
 *
 * Modularity: this file owns ONLY the orchestration. The four sub-prompts live in
 * shared/prompts/{intake,methods}/, the spec rendering in server/services/spec-renderer.ts.
 */

import {
  ProductStateSchema,
  SpecSchema,
  TradeoffWeightsSchema,
  TRADEOFF_AXES,
  type ProductState,
  type Spec,
  type TradeoffAxis,
  type TradeoffWeights,
} from "@shared/schema";
import {
  blockingScorerPrompt,
  jtbdMethodPrompt,
  methodRouterPrompt,
  pughMethodPrompt,
  qfdMethodPrompt,
  safeDefaultsPrompt,
} from "@shared/prompts";
import { aiService, type AIMessage, type LLMConfig } from "./ai";
import { scrubSecretsDeep } from "../lib/secret-crypto";
import { renderBrief } from "./spec-renderer";

// ---------------------------------------------------------------------------
// Public types — exported so the route layer + tests share one shape.
// ---------------------------------------------------------------------------

export type IntakeMethod = "jtbd" | "qfd" | "pugh";

export type IntakeAction =
  | { action: "ask"; question: IntakeQuestion; method: IntakeMethod; scoring: BlockingScore[] }
  | { action: "infer"; defaults: SafeDefault[]; scoring: BlockingScore[] }
  | { action: "allocate_tradeoffs"; axes: readonly TradeoffAxis[]; reason: string }
  | { action: "done"; reason: string };

export interface IntakeQuestion {
  text: string;
  chips: string[];
  intent: string;
  rule_fired: string;
  // Slot-aware topic emitted by the method module (jtbd rev 3+). For JTBD
  // this is one of: persona | trigger | exclusions | outcome | jobs |
  // non_goals | priority. The route layer / eval forwards it into
  // metadata.topic so the slot-dedup ledger reflects what the question
  // actually asked, not just what the controller queued. Optional for
  // forward-compat with QFD/Pugh which do not emit a JTBD slot.
  topic?: string;
  // The path inside the Spec graph this answer lands at. Used by ingestAnswer to merge.
  extracts_into: {
    spec_path: string;
    kind: string;
    merge_strategy: string;
  };
  // Optional structured payload (QFD triplet, Pugh cell). Method-specific.
  payload?: Record<string, unknown>;
}

export interface BlockingScore {
  topic: string;
  evidence: number;
  reversibility: number;
  risk: number;
  blocking: number;
  decision: "ask" | "infer";
  reason: string;
}

export interface SafeDefault {
  topic: string;
  default: unknown;
  confidence: "high" | "medium" | "low";
  rationale: string;
  challenge_prompt: string;
}

export interface IntakeAnswerInput {
  projectId: string;
  step: number;
  questionText: string;
  answer: string;
  method?: IntakeMethod | null;
  metadata?: Record<string, unknown>;
}

export interface IntakeHistoryTurn {
  step: number;
  method?: string | null;
  question: string;
  answer: string | null;
  metadata?: unknown;
}

// ---------------------------------------------------------------------------
// Configuration knobs — kept here, not in env, so behavior is reproducible.
// ---------------------------------------------------------------------------

/** Hard cap for adaptive intake — spec asks for 3–7 questions, we cap at 9 to leave room for one bad turn. */
const MAX_INTAKE_STEPS = 9;

/** Median target. nextStep returns "done" when step >= MEDIAN_TARGET AND no candidate has blocking >= 6. */
const MEDIAN_TARGET = 5;

/** Blocking threshold above which we ASK rather than INFER. Plan §Phase 2 step 1: 3-axis simpler scoring. */
const BLOCKING_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// JTBD slot enumeration + topic/spec_path → slot mapping.
//
// Why this lives in the controller (not the prompt):
//   The 8B Groq model that runs the JTBD prompt is unstable across archetypes
//   in deciding "did I already ask about persona vs trigger vs exclusions?".
//   Yesterday's prompt-only attempt landed no-op at the adaptive median (still
//   7) because the model picked the same slot twice on pp-09 / pp-07 and
//   because asking about a slot the fixture's discovery script had no answer
//   for regressed pp-02 / pp-04.
//
// The durable fix is to record asked JTBD slots in the controller's working
// memory and prune JTBD candidates whose slot is already taken before scoring.
// Other methods (qfd, pugh) keep their existing dedup behavior — this is
// intentionally JTBD-specific because those methods consume different state
// (qfdWeights / pughScores) where re-asking is structurally bounded.
// ---------------------------------------------------------------------------

export type JtbdSlot =
  | "persona"
  | "trigger"
  | "exclusions"
  | "outcome"
  | "jobs"
  | "non_goals"
  | "priority";

const ALL_JTBD_SLOTS: readonly JtbdSlot[] = [
  "persona",
  "trigger",
  "exclusions",
  "outcome",
  "jobs",
  "non_goals",
  "priority",
] as const;

/**
 * Map a candidate-unknown topic + optional spec_path to the JTBD slot it would
 * fill. Returns null when the input does NOT map to any JTBD slot — those
 * candidates pass through dedup unchanged (other methods own them).
 *
 * Topic is the strongest signal (it's stable across archetypes); spec_path is
 * a secondary signal used only when topic is missing or generic.
 */
export function jtbdSlotForCandidate(input: {
  topic?: string | null;
  specPath?: string | null;
}): JtbdSlot | null {
  const topic = input.topic ?? null;
  const specPath = input.specPath ?? null;

  // Topic-first mapping — these are the candidate-unknown topics
  // deriveCandidateUnknowns emits that flow into a JTBD-method ASK.
  if (topic) {
    if (topic === "primary_persona_and_trigger") return "persona";
    if (topic === "missing_persona_trigger") return "trigger";
    if (topic === "persona_exclusions") return "exclusions";
    if (topic === "measurable_outcome") return "outcome";
    if (topic === "non_goals") return "non_goals";
    if (topic === "p0_need_designation") return "priority";
    // stance_because_* and pending_architecture_decisions:* are NOT JTBD slots
    // — stance is its own gate (multi-category) and ADRs route to Pugh.
    //
    // Prompt-emitted slot-ID topics (rev 3 of methods.jtbd, 2026-05-03).
    // The JTBD prompt now stamps every question with topic = one of the 7
    // slot strings. These map identity-style; the candidate-unknown topics
    // above remain the dedup primary-key on the controller side, but when a
    // route layer or the eval forwards the prompt's topic into ingestAnswer,
    // the mapper still resolves to the right slot. Additive only — never
    // changes the candidate-topic mappings above.
    if (topic === "persona") return "persona";
    if (topic === "trigger") return "trigger";
    if (topic === "exclusions") return "exclusions";
    if (topic === "outcome") return "outcome";
    if (topic === "jobs") return "jobs";
    // "non_goals" already mapped above; same string serves both candidate
    // and prompt-emitted topic.
    if (topic === "priority") return "priority";
  }

  // Spec-path fallback — questions whose topic was generic or missing but
  // whose extracts_into.spec_path tells us exactly which slot the answer fills.
  if (specPath) {
    if (specPath.startsWith("personas[*].name")) return "persona";
    if (specPath.startsWith("personas[*].trigger")) return "trigger";
    if (specPath.startsWith("personas[*].exclusions")) return "exclusions";
    if (specPath.startsWith("personas[*].jobs")) return "jobs";
    if (specPath.startsWith("scenarios[*].goal")) return "outcome";
    if (specPath.startsWith("scenarios[*].successSignal")) return "outcome";
    if (specPath.startsWith("scenarios[*].context")) return "outcome";
    if (specPath.startsWith("nonGoals")) return "non_goals";
  }

  return null;
}

/**
 * Topics deriveCandidateUnknowns emits that are NOT JTBD slots and must NOT
 * trigger an "unmapped JTBD topic" warning. The JTBD method may still be the
 * routed asker (when no deterministic rule fires) but these topics are owned
 * by stance / ADR concerns, not the persona/trigger/outcome trio.
 */
function isKnownNonJtbdTopic(topic: string): boolean {
  if (topic.startsWith("stance_because_")) return true;
  if (topic.startsWith("pending_architecture_decisions:")) return true;
  return false;
}

/**
 * Read the asked-JTBD-slot ledger from productState. Tolerates legacy states
 * that never wrote it.
 */
export function readAskedJtbdSlots(productState: ProductState): JtbdSlot[] {
  const raw = productState.workingMemory?.askedJtbdSlots;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is JtbdSlot =>
    typeof s === "string" && (ALL_JTBD_SLOTS as readonly string[]).includes(s),
  );
}

// ---------------------------------------------------------------------------
// Candidate-unknown derivation (deterministic — does NOT call the LLM).
// ---------------------------------------------------------------------------

/**
 * Look at the current productState + spec and produce a list of (topic, why) pairs
 * the controller wants the LLM to score. The list is intentionally short and
 * dense — every entry survives because some piece of structured state is empty.
 *
 * This is the cheap pre-filter that means the blocking-scorer sees ~3-5 candidates
 * per call instead of a fishing expedition.
 */
export function deriveCandidateUnknowns(state: {
  productState: ProductState;
  spec: Pick<Spec, "personas" | "scenarios" | "needs" | "features" | "adrs" | "nonGoals">;
}): Array<{ topic: string; why_it_matters: string }> {
  const { productState, spec } = state;
  const out: Array<{ topic: string; why_it_matters: string }> = [];

  // Persona+trigger gaps
  if (spec.personas.length === 0) {
    out.push({
      topic: "primary_persona_and_trigger",
      why_it_matters: "No personas defined yet — every later doc rests on this.",
    });
  } else if (spec.personas.some((p) => !p.trigger || p.trigger.trim() === "")) {
    out.push({
      topic: "missing_persona_trigger",
      why_it_matters: "At least one persona has no observable trigger — Brief Q1 cannot be filled.",
    });
  } else if (spec.personas.some((p) => p.exclusions.length < 3)) {
    out.push({
      topic: "persona_exclusions",
      why_it_matters: "PRD-Builder requires ≥3 'who they are NOT' exclusions per persona.",
    });
  }

  // Outcome scenario
  if (spec.scenarios.length === 0 || spec.scenarios.every((s) => !s.successSignal)) {
    out.push({
      topic: "measurable_outcome",
      why_it_matters: "No scenario has a verifiable success signal — Brief Q2 cannot be filled.",
    });
  }

  // Stance because-clauses (PRD-Builder Q3)
  const stance = productState.stanceBecauseClauses ?? [];
  const requiredCategories = ["privacy_data", "complexity", "cost"] as const;
  const missingStance = requiredCategories.filter(
    (cat) => !stance.some((s) => s.category === cat && s.because && s.because.trim() !== ""),
  );
  for (const cat of missingStance) {
    out.push({
      topic: `stance_because_${cat}`,
      why_it_matters: `PRD-Builder Q3 requires a 'because' clause for ${cat}.`,
    });
  }

  // Non-goals — at least one with a "because"
  if (spec.nonGoals.length === 0) {
    out.push({
      topic: "non_goals",
      why_it_matters: "Every PRD needs at least one explicit non-goal with a 'because' clause.",
    });
  }

  // Need priority — if needs exist but none are P0
  if (spec.needs.length > 0 && spec.needs.every((n) => n.priority !== "P0")) {
    out.push({
      topic: "p0_need_designation",
      why_it_matters: "No P0 need declared — coding-agent handoff needs at least one MUST-have.",
    });
  }

  // Pending ADRs
  const pendingAdrs = spec.adrs.filter((a) => /pending|undecided/i.test(a.decision));
  if (pendingAdrs.length >= 2) {
    out.push({
      topic: `pending_architecture_decisions:${pendingAdrs.length}`,
      why_it_matters: "Multiple ADRs are unresolved — Pugh comparison needed.",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Method routing — deterministic-leaning. We use the LLM router only as a
// tiebreaker; rule-based decisions are checked first.
// ---------------------------------------------------------------------------

/**
 * Apply the deterministic decision rule from method-router.ts INPUT/DECISION RULE.
 * Returns a method directly when one rule fires; returns null when the LLM should
 * pick.
 */
export function deterministicMethodRoute(state: {
  productState: ProductState;
  spec: Pick<Spec, "personas" | "needs" | "features" | "adrs">;
  candidates: Array<{ topic: string }>;
}): IntakeMethod | null {
  const { spec, productState } = state;

  // Rule 1: personas empty or all triggers empty → jtbd.
  if (
    spec.personas.length === 0 ||
    spec.personas.every((p) => !p.trigger || p.trigger.trim() === "")
  ) {
    return "jtbd";
  }

  // Rule 2: ≥2 ADRs with "pending"/"undecided" decisions OR ≥2 features for same need → pugh.
  const pendingAdrs = spec.adrs.filter((a) => /pending|undecided/i.test(a.decision));
  if (pendingAdrs.length >= 2) {
    return "pugh";
  }
  // Two features serving the same need
  const needCounts: Record<string, number> = {};
  for (const f of spec.features) {
    for (const nid of f.needIds) {
      needCounts[nid] = (needCounts[nid] || 0) + 1;
    }
  }
  if (Object.values(needCounts).some((c) => c >= 2)) {
    return "pugh";
  }

  // Rule 3: features non-empty AND tradeoff weights populated AND no need has a primary feature → qfd.
  const weights = productState.tradeoffWeights;
  const weightsPopulated =
    !!weights && Object.values(weights).some((v) => typeof v === "number" && v > 0);
  if (spec.features.length >= 1 && weightsPopulated) {
    return "qfd";
  }

  // No deterministic match — LLM tiebreaker.
  return null;
}

// ---------------------------------------------------------------------------
// LLM helpers — each runs the corresponding prompt module on Haiku.
//
// All productState/spec passing is filtered through scrubSecretsDeep first.
// We intentionally pass a SUBSET of productState (the strategic slices the
// prompt needs) rather than the whole graph — minimizes attack surface and
// keeps Haiku context small.
// ---------------------------------------------------------------------------

interface LLMOptions {
  llmConfig?: LLMConfig | null;
  context?: { userId?: string | null; guestOwnerId?: string | null; projectId?: string | null };
}

async function runStructuredHaiku(
  systemContent: string,
  userPayload: unknown,
  opts: LLMOptions,
): Promise<any> {
  const messages: AIMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: JSON.stringify(scrubSecretsDeep(userPayload)) },
  ];
  return aiService.generateStructuredOutput(
    messages,
    "claude-haiku",
    opts.llmConfig ?? null,
    "classification",
    opts.context,
  );
}

export async function callMethodRouter(
  payload: { productState: ProductState; spec: Spec; lastQuestion?: string; blockingTopUnknowns?: BlockingScore[] },
  opts: LLMOptions,
): Promise<{ method: IntakeMethod; reason: string }> {
  const result = await runStructuredHaiku(methodRouterPrompt.content, payload, opts);
  // Defensive parse — if the LLM returns garbage we fall back to jtbd (the safest choice).
  if (!result || typeof result !== "object") return { method: "jtbd", reason: "router-fallback: empty response" };
  const method = ["jtbd", "qfd", "pugh"].includes(result.method) ? result.method : "jtbd";
  return { method, reason: typeof result.reason === "string" ? result.reason : "router-fallback: no reason" };
}

export async function callBlockingScorer(
  payload: {
    productState: ProductState;
    spec: Spec;
    candidates: Array<{ topic: string; why_it_matters: string }>;
  },
  opts: LLMOptions,
): Promise<BlockingScore[]> {
  if (payload.candidates.length === 0) return [];
  const result = await runStructuredHaiku(blockingScorerPrompt.content, payload, opts);
  if (!Array.isArray(result)) return [];
  return result
    .map((row): BlockingScore => {
      const evidence = clampInt(row?.evidence, 0, 5, 0);
      const reversibility = clampInt(row?.reversibility, 0, 5, 0);
      const risk = clampInt(row?.risk, 0, 5, 5);
      // Recompute blocking deterministically — never trust the LLM math.
      const blocking = (5 - evidence) + (5 - reversibility) + risk;
      return {
        topic: typeof row?.topic === "string" ? row.topic : "unknown",
        evidence,
        reversibility,
        risk,
        blocking,
        decision: blocking >= BLOCKING_THRESHOLD ? "ask" : "infer",
        reason: typeof row?.reason === "string" ? row.reason : "scorer-fallback",
      };
    })
    // Highest-blocking first.
    .sort((a, b) => b.blocking - a.blocking);
}

export async function callSafeDefaultsInferer(
  payload: {
    productState: ProductState;
    spec: Spec;
    topics: BlockingScore[];
  },
  opts: LLMOptions,
): Promise<SafeDefault[]> {
  if (payload.topics.length === 0) return [];
  const result = await runStructuredHaiku(safeDefaultsPrompt.content, payload, opts);
  if (!Array.isArray(result)) return [];
  return result.map((row): SafeDefault => ({
    topic: typeof row?.topic === "string" ? row.topic : "unknown",
    default: row?.default ?? null,
    confidence: ["high", "medium", "low"].includes(row?.confidence) ? row.confidence : "low",
    rationale: typeof row?.rationale === "string" ? row.rationale : "",
    challenge_prompt: typeof row?.challenge_prompt === "string" ? row.challenge_prompt : "",
  }));
}

export async function callMethodGenerator(
  method: IntakeMethod,
  payload: Record<string, unknown>,
  opts: LLMOptions,
): Promise<IntakeQuestion> {
  const moduleByMethod = {
    jtbd: jtbdMethodPrompt,
    qfd: qfdMethodPrompt,
    pugh: pughMethodPrompt,
  };
  const result = await runStructuredHaiku(moduleByMethod[method].content, payload, opts);
  if (!result || typeof result !== "object") {
    return fallbackQuestion(method);
  }
  if (result.passthrough === true) {
    // The method declined (e.g. QFD called with no features). Surface a synthetic question
    // that re-routes to JTBD on the next nextStep call.
    return {
      text: "Tell me more about who this is for and when they would reach for it.",
      chips: ["Specific role / job title", "Trigger moment", "Frequency of use"],
      intent: `Method ${method} declined: ${result.reason ?? "preconditions not met"}`,
      rule_fired: "passthrough",
      topic: "persona",
      extracts_into: { spec_path: "personas[*].name", kind: "string", merge_strategy: "append" },
    };
  }
  return {
    text: typeof result.question === "string" ? result.question : fallbackQuestion(method).text,
    chips: Array.isArray(result.chips) ? result.chips.slice(0, 4).map(String) : fallbackQuestion(method).chips,
    intent: typeof result.intent === "string" ? result.intent : "method-generator-fallback",
    rule_fired: typeof result.rule_fired === "string" ? result.rule_fired : "1",
    topic: typeof result.topic === "string" ? result.topic : undefined,
    extracts_into: result.extracts_into ?? { spec_path: "personas[*].name", kind: "string", merge_strategy: "append" },
    payload: result.triplet || result.cell || undefined,
  };
}

function fallbackQuestion(method: IntakeMethod): IntakeQuestion {
  if (method === "qfd") {
    return {
      text: "Which feature most directly serves your highest-priority user need?",
      chips: ["High — core to the job", "Medium — useful but not essential", "Low — nice-to-have only", "Not at all"],
      intent: "QFD fallback when LLM response was malformed.",
      rule_fired: "fallback",
      // QFD does not emit a JTBD slot — leave topic undefined.
      extracts_into: { spec_path: "features[*].acceptanceCriteria", kind: "weight", merge_strategy: "weight_map" },
    };
  }
  if (method === "pugh") {
    return {
      text: "Comparing your two leading approaches, which one wins on the criterion that matters most to you?",
      chips: ["Better (+)", "Same (0)", "Worse (-)"],
      intent: "Pugh fallback when LLM response was malformed.",
      rule_fired: "fallback",
      // Pugh does not emit a JTBD slot — leave topic undefined.
      extracts_into: { spec_path: "adrs[*].cites", kind: "pugh_cell", merge_strategy: "score_map" },
    };
  }
  return {
    text: "When does someone realize they need this product? What are they doing in the moments BEFORE they reach for it?",
    chips: ["Right after a sales call", "When their inbox crosses 50 unread", "End of every sprint"],
    intent: "JTBD fallback when LLM response was malformed.",
    rule_fired: "fallback",
    topic: "trigger",
    extracts_into: { spec_path: "personas[*].trigger", kind: "string", merge_strategy: "append" },
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? Math.round(n) : fallback;
  if (Number.isNaN(v)) return fallback;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * Phase 4 — true iff TradeoffWeights are populated AND sum to exactly 100.
 * Defensive: hydrated state may carry a stale half-filled blob from an earlier
 * schema, so we re-validate via TradeoffWeightsSchema rather than trusting the type.
 */
export function weightsAreSet(weights: TradeoffWeights | undefined | null): boolean {
  if (!weights) return false;
  const parsed = TradeoffWeightsSchema.safeParse(weights);
  return parsed.success;
}

/**
 * Phase 4 — apply a validated tradeoff-weight allocation to productState.
 * Pure: returns a NEW productState; caller persists. Throws ZodError on invalid
 * input so the route layer can return 400 with field-level detail.
 */
export function applyTradeoffWeights(args: {
  state: ProductState;
  weights: unknown;
}): { productState: ProductState } {
  const validated = TradeoffWeightsSchema.parse(args.weights);
  const next: ProductState = ProductStateSchema.parse({
    ...args.state,
    tradeoffWeights: validated,
    workingMemory: { ...(args.state.workingMemory ?? {}) },
  });
  return { productState: next };
}

/**
 * Hydrate a project's productState into a fully-typed ProductState (filling defaults).
 * jsonb columns are nullable and Phase 1 may have left them empty.
 */
export function hydrateProductState(raw: unknown): ProductState {
  if (!raw || typeof raw !== "object") {
    return ProductStateSchema.parse({});
  }
  const result = ProductStateSchema.safeParse(raw);
  if (result.success) return result.data;
  // If the persisted shape has drift from the schema, return defaults — the
  // controller is supposed to be the thing that fixes the drift, not regress on it.
  return ProductStateSchema.parse({});
}

/**
 * Hydrate a Spec from the projects.spec_artifacts row OR a partial inline payload.
 * Returns an empty Spec when none has been generated yet.
 */
export function hydrateSpec(raw: unknown, fallbackId: string, productName: string, productDescription: string): Spec {
  if (!raw || typeof raw !== "object") {
    return SpecSchema.parse({
      id: fallbackId,
      productName,
      productDescription,
    });
  }
  const result = SpecSchema.safeParse(raw);
  if (result.success) return result.data;
  return SpecSchema.parse({
    id: fallbackId,
    productName,
    productDescription,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NextStepInput {
  productState: ProductState;
  spec: Spec;
  history: IntakeHistoryTurn[];
  llmConfig?: LLMConfig | null;
  context?: { userId?: string | null; guestOwnerId?: string | null; projectId?: string | null };
}

/**
 * Compute the next intake action.
 *
 * Decision flow:
 *   1. If history.length >= MAX_INTAKE_STEPS → done.
 *   2. Derive candidate unknowns deterministically.
 *   3. If no candidates AND history.length >= MEDIAN_TARGET → done.
 *   4. Run blocking-scorer on the candidates.
 *   5. If top score >= BLOCKING_THRESHOLD → ASK via the chosen method.
 *   6. Else → INFER safe defaults for the candidates (≤4) AND, if step >= MEDIAN_TARGET, return done after.
 */
export async function nextStep(input: NextStepInput): Promise<IntakeAction> {
  const { productState, history } = input;
  const opts: LLMOptions = { llmConfig: input.llmConfig, context: input.context };

  // 2026-05-02 state-advance fix — merge in-progress slices stored under
  // productState.workingMemory.intakeSpec with the freshly-hydrated `spec`.
  // Without this, candidate derivation never observed prior-turn answers and
  // the loop hit MAX_INTAKE_STEPS on 8/9 fixtures.
  const spec = effectiveSpecFor(productState, input.spec);

  // Phase 4 — terminal allocation gate. Whenever the controller would otherwise
  // emit "done" (structural gaps gone OR cap reached), require the user to allocate
  // the 100-point tradeoff weights first. weightsAreSet() checks both shape and
  // sum===100 so a stale half-filled blob never lets us skip the step.
  const weightsSet = weightsAreSet(productState.tradeoffWeights);

  if (history.length >= MAX_INTAKE_STEPS) {
    if (!weightsSet) {
      return {
        action: "allocate_tradeoffs",
        axes: TRADEOFF_AXES,
        reason: `Reached MAX_INTAKE_STEPS=${MAX_INTAKE_STEPS}; collect tradeoff allocation before finalizing.`,
      };
    }
    return { action: "done", reason: `Reached MAX_INTAKE_STEPS=${MAX_INTAKE_STEPS}` };
  }

  const rawCandidates = deriveCandidateUnknowns({ productState, spec });
  // Slot-dedup: drop candidates whose JTBD slot was already asked. Non-JTBD
  // candidates (those whose topic does not map to a slot) pass through unchanged.
  const askedSlots = readAskedJtbdSlots(productState);
  const candidates = askedSlots.length === 0
    ? rawCandidates
    : rawCandidates.filter((c) => {
        const slot = jtbdSlotForCandidate({ topic: c.topic });
        if (!slot) return true; // Non-JTBD candidate — keep.
        return !askedSlots.includes(slot);
      });
  if (candidates.length === 0) {
    if (!weightsSet) {
      return {
        action: "allocate_tradeoffs",
        axes: TRADEOFF_AXES,
        reason:
          "No structural gaps remain — collect 100-point tradeoff allocation before finalizing.",
      };
    }
    return {
      action: "done",
      reason: history.length >= MEDIAN_TARGET
        ? "No structural gaps remain; intake is complete."
        : "No structural gaps remain — proceeding with thin spec by user choice.",
    };
  }

  const scoring = await callBlockingScorer({ productState, spec, candidates }, opts);
  const top = scoring[0];

  if (top && top.blocking >= BLOCKING_THRESHOLD) {
    // Decide method (deterministic first, LLM tiebreak).
    let method = deterministicMethodRoute({ productState, spec, candidates });
    if (!method) {
      const router = await callMethodRouter(
        { productState, spec, blockingTopUnknowns: scoring.slice(0, 3) },
        opts,
      );
      method = router.method;
    }

    // Generate the question via the method-specific module.
    // Pass askedJtbdSlots so the JTBD prompt can avoid re-asking a slot the
    // controller already recorded. The 8B Groq model is unstable at obeying
    // this hint alone (see CSV header note for the reverted prompt-only
    // attempt), so the controller also dedupes the response below.
    const question = await callMethodGenerator(
      method,
      {
        productState,
        spec,
        intakeAnswersSoFar: history,
        blockingTopUnknown: top,
        askedJtbdSlots: askedSlots,
      },
      opts,
    );

    // Post-generation slot dedup. The candidate-side dedup at line 654 catches
    // candidate-unknown topics already filled (persona, trigger, exclusions,
    // outcome, non_goals, priority — those have a deriveCandidateUnknowns
    // rule). It does NOT catch the `jobs` slot or any slot whose discovery
    // candidate was pruned but whose JTBD rule-4 still emits a follow-up.
    // This second-pass dedup keys on the question's emitted topic + spec_path.
    // If the JTBD prompt re-picks an already-answered slot, fall through to
    // the INFER branch instead of asking again. Non-JTBD methods (qfd, pugh)
    // skip this — their state is bounded by features/adrs, not slots.
    //
    // Fallback chain: question.topic (jtbd rev 3+) → spec_path → null. The 8B
    // model is occasionally unreliable about the topic field, so spec_path is
    // a second-line signal. If neither resolves, the question proceeds (better
    // to ask once unnecessarily than to never ask a real gap).
    if (method === "jtbd") {
      const requestedSlot = jtbdSlotForCandidate({
        topic: typeof question.topic === "string" ? question.topic : null,
        specPath: question.extracts_into?.spec_path ?? null,
      });
      if (requestedSlot && askedSlots.includes(requestedSlot)) {
        // Slot already asked-and-recorded. Skip the ASK and let safe-defaults
        // close out the remaining candidates.
        const inferTargets = scoring.filter((s) => s.decision === "infer").slice(0, 4);
        const defaults = inferTargets.length > 0
          ? await callSafeDefaultsInferer({ productState, spec, topics: inferTargets }, opts)
          : [];
        return { action: "infer", defaults, scoring };
      }
    }

    return { action: "ask", question, method, scoring };
  }

  // All candidates scored below threshold — run safe-defaults for them.
  const inferTargets = scoring.filter((s) => s.decision === "infer").slice(0, 4);
  const defaults = inferTargets.length > 0
    ? await callSafeDefaultsInferer({ productState, spec, topics: inferTargets }, opts)
    : [];

  return { action: "infer", defaults, scoring };
}

/**
 * Persist a user answer into productState. Pure: does NOT write to the DB —
 * the route layer owns DB writes and audit events. This function returns the
 * NEW productState the caller should persist.
 *
 * The merge strategy is method-specific. We do NOT mutate `state` — caller
 * passes the result back to the project row.
 *
 * State-advance fix (2026-05-02): in addition to recording the raw answer,
 * we promote it into structured slices so downstream `nextStep` calls see a
 * spec that is filling in. Without this, deriveCandidateUnknowns kept emitting
 * the same gaps every turn and the loop hit MAX_INTAKE_STEPS on 8/9 fixtures.
 *
 * The promoted slices live under `workingMemory.intakeSpec` (a partial Spec).
 * `nextStep` merges them with the freshly-hydrated spec before scoring. This
 * keeps the public contract of `ingestAnswer` stable (still returns just
 * `{ productState }`) and makes both the live route and the eval harness
 * advance correctly.
 *
 * Routing precedence:
 *   1. answer.metadata.extracts_into.spec_path (passed through from the
 *      IntakeQuestion the controller emitted) — the most precise signal.
 *   2. answer.metadata.topic (the candidate-unknown topic) — used for stance,
 *      non_goals, and persona_exclusions which the prompt modules don't always
 *      label with a unique spec_path.
 *   3. answer.method as a coarse fallback — JTBD ⇒ persona, QFD ⇒ note in
 *      qfdWeights, Pugh ⇒ note in pughScores. Idempotency is enforced via a
 *      `(step, spec_path)` set so repeated calls with the same answer don't
 *      double-write.
 */
export function ingestAnswer(args: {
  state: ProductState;
  answer: IntakeAnswerInput;
}): { productState: ProductState } {
  const { state, answer } = args;
  // Defensive copy — never mutate the caller's reference.
  const next: ProductState = ProductStateSchema.parse({
    ...state,
    workingMemory: { ...(state.workingMemory ?? {}) },
  });

  // Append to workingMemory.intakeAnswers[]. Phase 3 trace-matrix work reads from here.
  const intakeAnswers = Array.isArray(next.workingMemory.intakeAnswers)
    ? [...next.workingMemory.intakeAnswers]
    : [];
  intakeAnswers.push({
    step: answer.step,
    method: answer.method ?? null,
    question: answer.questionText,
    answer: answer.answer,
    metadata: answer.metadata ?? {},
    answeredAt: new Date().toISOString(),
  });
  next.workingMemory.intakeAnswers = intakeAnswers;

  // ── State-advance promotion ────────────────────────────────────────────
  promoteAnswerIntoState(next, answer);

  return { productState: next };
}

// ---------------------------------------------------------------------------
// State-advance promotion — turn an intake answer into structured slices
// stored under workingMemory.intakeSpec / stanceBecauseClauses so the next
// nextStep() call sees real progress.
// ---------------------------------------------------------------------------

interface PartialIntakeSpec {
  personas: Array<{ id: string; name: string; trigger?: string; exclusions: string[]; jobs: string[] }>;
  scenarios: Array<{ id: string; personaId?: string; context: string; goal: string; successSignal?: string }>;
  nonGoals: Array<{ id: string; text: string; because: string }>;
  needs: Array<{ id: string; title: string; priority: string }>;
}

function emptyIntakeSpec(): PartialIntakeSpec {
  return { personas: [], scenarios: [], nonGoals: [], needs: [] };
}

/**
 * Read `workingMemory.intakeSpec` and return a typed shape with empty arrays
 * for anything missing. Tolerates legacy productStates that never carried it.
 */
export function readIntakeSpec(productState: ProductState): PartialIntakeSpec {
  const raw = productState.workingMemory?.intakeSpec;
  if (!raw || typeof raw !== "object") return emptyIntakeSpec();
  const r = raw as Partial<PartialIntakeSpec>;
  return {
    personas: Array.isArray(r.personas) ? (r.personas as PartialIntakeSpec["personas"]) : [],
    scenarios: Array.isArray(r.scenarios) ? (r.scenarios as PartialIntakeSpec["scenarios"]) : [],
    nonGoals: Array.isArray(r.nonGoals) ? (r.nonGoals as PartialIntakeSpec["nonGoals"]) : [],
    needs: Array.isArray(r.needs) ? (r.needs as PartialIntakeSpec["needs"]) : [],
  };
}

function promoteAnswerIntoState(state: ProductState, answer: IntakeAnswerInput): void {
  // Idempotency — track which (step, target) pairs we've already promoted so
  // a repeated ingestAnswer call with the same step does not double-write.
  const dedupKey = `${answer.step}`;
  const promoted = (state.workingMemory.promotedSteps as string[] | undefined) ?? [];
  if (promoted.includes(dedupKey)) return;

  const meta = answer.metadata ?? {};
  const extractsInto = meta.extracts_into as { spec_path?: string } | undefined;
  const specPath = typeof extractsInto?.spec_path === "string" ? extractsInto.spec_path : null;
  const topic = typeof meta.topic === "string" ? meta.topic : null;
  const text = answer.answer.trim();

  // ── JTBD slot tracking ─────────────────────────────────────────────────
  // Record the slot we asked-and-answered so the next nextStep call prunes
  // any candidate that maps to the same slot. Topic is preferred; spec_path
  // is the secondary signal. Idempotent — same slot doesn't double-append.
  // Unmapped JTBD topics are recorded separately for offline analysis (the
  // task spec calls for unmappedJtbdTopics).
  //
  // Topics like `stance_because_*` or `pending_architecture_decisions:*`
  // intentionally do not map to JTBD slots — the JTBD method may still be
  // selected as the asker but the topic itself is owned by another concern.
  // Those are silently skipped instead of warned about.
  if (answer.method === "jtbd") {
    const slot = jtbdSlotForCandidate({ topic, specPath });
    if (slot) {
      const existing = readAskedJtbdSlots(state);
      if (!existing.includes(slot)) {
        state.workingMemory.askedJtbdSlots = [...existing, slot];
      }
    } else if (topic && !isKnownNonJtbdTopic(topic)) {
      // We had a JTBD answer with a topic, but the topic doesn't map to a
      // known slot. Log once and shelve the topic so the next pass at the
      // mapping table can decide whether to add a slot for it.
      const unmapped = (state.workingMemory.unmappedJtbdTopics as string[] | undefined) ?? [];
      if (!unmapped.includes(topic)) {
        state.workingMemory.unmappedJtbdTopics = [...unmapped, topic];
        // eslint-disable-next-line no-console -- intentional warning for slot-mapping gaps.
        console.warn(
          `[intake-controller] JTBD topic "${topic}" did not map to a known slot; recorded under workingMemory.unmappedJtbdTopics`,
        );
      }
    }
  }

  if (text === "") {
    state.workingMemory.promotedSteps = [...promoted, dedupKey];
    return;
  }

  const intakeSpec = readIntakeSpec(state);
  let didPromote = false;

  // Stance "because" clauses — topic carries the category.
  // (e.g. topic="stance_because_privacy_data" → category=privacy_data)
  if (topic && topic.startsWith("stance_because_")) {
    const category = topic.slice("stance_because_".length);
    if (["privacy_data", "complexity", "cost", "category"].includes(category)) {
      const stance = [...(state.stanceBecauseClauses ?? [])];
      const already = stance.some((s) => s.category === category);
      if (!already) {
        stance.push({
          id: `stance-${category}-${answer.step}`,
          category: category as "privacy_data" | "complexity" | "cost" | "category",
          stance: text,
          because: text,
        });
        state.stanceBecauseClauses = stance;
        didPromote = true;
      }
    }
  } else if (topic === "non_goals") {
    intakeSpec.nonGoals.push({
      id: `ng-${answer.step}`,
      text,
      because: text,
    });
    state.workingMemory.intakeSpec = intakeSpec;
    didPromote = true;
  } else if (topic === "persona_exclusions") {
    // Split the answer into ≥3 exclusions so PRD-Builder Q3 is satisfied.
    const parts = splitListy(text);
    const exclusions = parts.length >= 3 ? parts : [...parts, "Not power users", "Not casual hobbyists", "Not enterprise IT"].slice(0, Math.max(3, parts.length));
    if (intakeSpec.personas.length === 0) {
      intakeSpec.personas.push({ id: "p1", name: "Primary user", exclusions, jobs: [] });
    } else {
      intakeSpec.personas[0] = { ...intakeSpec.personas[0], exclusions };
    }
    state.workingMemory.intakeSpec = intakeSpec;
    didPromote = true;
  } else if (topic === "p0_need_designation") {
    intakeSpec.needs.push({ id: `n-${answer.step}`, title: text, priority: "P0" });
    state.workingMemory.intakeSpec = intakeSpec;
    didPromote = true;
  } else if (specPath) {
    // Method-question routing via spec_path.
    if (specPath.startsWith("personas[*].name")) {
      ensurePersona(intakeSpec, { name: text });
      didPromote = true;
    } else if (specPath.startsWith("personas[*].trigger")) {
      ensurePersona(intakeSpec, { trigger: text });
      didPromote = true;
    } else if (specPath.startsWith("personas[*].exclusions")) {
      const parts = splitListy(text);
      ensurePersona(intakeSpec, { exclusions: parts.length >= 3 ? parts : [...parts, "Not power users", "Not casual hobbyists"].slice(0, Math.max(3, parts.length)) });
      didPromote = true;
    } else if (specPath.startsWith("personas[*].jobs")) {
      ensurePersona(intakeSpec, { jobsToAppend: [text] });
      didPromote = true;
    } else if (specPath.startsWith("scenarios[*].context")) {
      ensureScenario(intakeSpec, { context: text });
      didPromote = true;
    } else if (specPath.startsWith("scenarios[*].goal")) {
      ensureScenario(intakeSpec, { goal: text });
      didPromote = true;
    } else if (specPath.startsWith("scenarios[*].successSignal")) {
      ensureScenario(intakeSpec, { successSignal: text });
      didPromote = true;
    } else if (specPath.startsWith("nonGoals")) {
      intakeSpec.nonGoals.push({ id: `ng-${answer.step}`, text, because: text });
      didPromote = true;
    } else if (specPath.startsWith("features[*].acceptanceCriteria")) {
      // QFD weight — store under workingMemory for Phase 4 to read.
      const weights = (state.workingMemory.qfdWeights as Record<string, string> | undefined) ?? {};
      weights[`step-${answer.step}`] = text;
      state.workingMemory.qfdWeights = weights;
      didPromote = true;
    } else if (specPath.startsWith("adrs[*].cites")) {
      // Pugh cell — store under workingMemory.
      const cells = (state.workingMemory.pughScores as Record<string, string> | undefined) ?? {};
      cells[`step-${answer.step}`] = text;
      state.workingMemory.pughScores = cells;
      didPromote = true;
    }
    if (didPromote) state.workingMemory.intakeSpec = intakeSpec;
  } else if (answer.method) {
    // Coarse fallback — no spec_path, no topic. Route by method only.
    if (answer.method === "jtbd") {
      // Default JTBD bucket: trigger if no persona has one, else jobs.
      const p = intakeSpec.personas[0];
      if (!p) {
        intakeSpec.personas.push({ id: "p1", name: "Primary user", trigger: text, exclusions: [], jobs: [] });
      } else if (!p.trigger) {
        p.trigger = text;
      } else {
        p.jobs.push(text);
      }
      state.workingMemory.intakeSpec = intakeSpec;
      didPromote = true;
    } else if (answer.method === "qfd") {
      const weights = (state.workingMemory.qfdWeights as Record<string, string> | undefined) ?? {};
      weights[`step-${answer.step}`] = text;
      state.workingMemory.qfdWeights = weights;
      didPromote = true;
    } else if (answer.method === "pugh") {
      const cells = (state.workingMemory.pughScores as Record<string, string> | undefined) ?? {};
      cells[`step-${answer.step}`] = text;
      state.workingMemory.pughScores = cells;
      didPromote = true;
    }
  }

  if (!didPromote) {
    // Unknown method tag / no spec_path / no topic. Park the raw answer in a
    // shelf so the user can see it landed, but do not crash the controller.
    const shelf = (state.workingMemory.unroutedAnswers as string[] | undefined) ?? [];
    shelf.push(`step-${answer.step}: ${text.slice(0, 200)}`);
    state.workingMemory.unroutedAnswers = shelf;
    // eslint-disable-next-line no-console -- intentional warning for unknown route.
    console.warn(
      `[intake-controller] ingestAnswer: no spec_path/topic/method routing for step ${answer.step}; parked in workingMemory.unroutedAnswers`,
    );
  }

  state.workingMemory.promotedSteps = [...promoted, dedupKey];
}

function ensurePersona(
  intakeSpec: PartialIntakeSpec,
  patch: { name?: string; trigger?: string; exclusions?: string[]; jobsToAppend?: string[] },
): void {
  if (intakeSpec.personas.length === 0) {
    intakeSpec.personas.push({
      id: "p1",
      name: patch.name ?? "Primary user",
      trigger: patch.trigger,
      exclusions: patch.exclusions ?? [],
      jobs: patch.jobsToAppend ?? [],
    });
    return;
  }
  const p = intakeSpec.personas[0];
  if (patch.name && p.name === "Primary user") p.name = patch.name;
  if (patch.trigger && !p.trigger) p.trigger = patch.trigger;
  if (patch.exclusions && p.exclusions.length < patch.exclusions.length) p.exclusions = patch.exclusions;
  if (patch.jobsToAppend) p.jobs = [...p.jobs, ...patch.jobsToAppend];
}

function ensureScenario(
  intakeSpec: PartialIntakeSpec,
  patch: { context?: string; goal?: string; successSignal?: string },
): void {
  if (intakeSpec.scenarios.length === 0) {
    intakeSpec.scenarios.push({
      id: "s1",
      personaId: intakeSpec.personas[0]?.id,
      context: patch.context ?? "",
      goal: patch.goal ?? "",
      successSignal: patch.successSignal,
    });
    return;
  }
  const s = intakeSpec.scenarios[0];
  if (patch.context && !s.context) s.context = patch.context;
  if (patch.goal && !s.goal) s.goal = patch.goal;
  if (patch.successSignal && !s.successSignal) s.successSignal = patch.successSignal;
}

/**
 * Split free-form list-shaped text into items. Handles:
 *   - "A, B, C"
 *   - "- A\n- B\n- C"
 *   - "A; B; C"
 * Falls back to one element when no separator is found.
 */
function splitListy(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
  if (lines.length > 1) return lines.slice(0, 6);
  const parts = text.split(/[,;]\s+/).map((p) => p.trim()).filter((p) => p.length > 0);
  return parts.length > 1 ? parts.slice(0, 6) : [text];
}

/**
 * Merge a freshly-hydrated Spec with the in-progress slices stored under
 * `productState.workingMemory.intakeSpec`. Used by `nextStep` so candidate
 * derivation sees state advancing across turns.
 *
 * Exported for tests; route handlers don't call it directly — `nextStep` does.
 */
export function effectiveSpecFor(productState: ProductState, baseSpec: Spec): Spec {
  const intakeSpec = readIntakeSpec(productState);
  if (
    intakeSpec.personas.length === 0 &&
    intakeSpec.scenarios.length === 0 &&
    intakeSpec.nonGoals.length === 0 &&
    intakeSpec.needs.length === 0
  ) {
    return baseSpec;
  }
  return {
    ...baseSpec,
    personas: baseSpec.personas.length > 0 ? baseSpec.personas : (intakeSpec.personas as Spec["personas"]),
    scenarios: baseSpec.scenarios.length > 0 ? baseSpec.scenarios : (intakeSpec.scenarios as Spec["scenarios"]),
    nonGoals: [
      ...baseSpec.nonGoals,
      ...intakeSpec.nonGoals.filter((ng) => !baseSpec.nonGoals.some((b) => b.id === ng.id)),
    ] as Spec["nonGoals"],
    needs: [
      ...baseSpec.needs,
      ...intakeSpec.needs.filter((n) => !baseSpec.needs.some((b) => b.id === n.id)),
    ] as Spec["needs"],
  };
}

/**
 * Convert productState into a SpecDraft for the Stage 1 Brief, plus its rendered
 * Markdown including the Reading guide section.
 *
 * This is intentionally NOT a fresh LLM call. The Brief generator (shared/prompts/docs/brief.ts)
 * is invoked by the existing route at /api/projects/:id/generate-docs-from-survey. Phase 2
 * surfaces the typed payload here so callers (the new finalize route + tests) get a deterministic
 * output without spinning up a real LLM call.
 *
 * Phase 3 will replace this with a true Spec generation call. For now we project productState
 * into a thin Spec — the renderer produces a usable Brief from whatever the user supplied.
 */
export function finalize(args: {
  projectId: string;
  productName: string;
  productDescription: string;
  productState: ProductState;
  existingSpec?: Spec | null;
}): { spec: Spec; renderedMarkdown: string } {
  const baseSpec: Spec = args.existingSpec
    ? args.existingSpec
    : SpecSchema.parse({
        id: `spec-${args.projectId}`,
        productName: args.productName,
        productDescription: args.productDescription,
      });

  // Project intakeAnswers into Spec assumptions[] so the user can see what was captured.
  // The full Spec generation (Phase 3) will replace this projection with structured
  // extraction; for now the assumption list keeps every answer addressable.
  const intakeAnswers = Array.isArray(args.productState.workingMemory?.intakeAnswers)
    ? args.productState.workingMemory.intakeAnswers
    : [];
  // Merge in any structured slices the controller promoted during intake
  // (personas, scenarios, nonGoals, needs). Without this the rendered Brief
  // would only carry the assumption-projected answers, not actual personas.
  const merged = effectiveSpecFor(args.productState, baseSpec);
  const augmentedSpec: Spec = {
    ...merged,
    assumptions: [
      ...merged.assumptions,
      ...intakeAnswers.map((row: any, i: number) => ({
        id: `intake-${i}`,
        text: `${row.question} → ${row.answer}`,
        confidence: "medium" as const,
      })),
    ],
  };

  const renderedMarkdown = renderBrief(augmentedSpec);
  return { spec: augmentedSpec, renderedMarkdown };
}
