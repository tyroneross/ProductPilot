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
      extracts_into: { spec_path: "personas[*].name", kind: "string", merge_strategy: "append" },
    };
  }
  return {
    text: typeof result.question === "string" ? result.question : fallbackQuestion(method).text,
    chips: Array.isArray(result.chips) ? result.chips.slice(0, 4).map(String) : fallbackQuestion(method).chips,
    intent: typeof result.intent === "string" ? result.intent : "method-generator-fallback",
    rule_fired: typeof result.rule_fired === "string" ? result.rule_fired : "1",
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
      extracts_into: { spec_path: "features[*].acceptanceCriteria", kind: "weight", merge_strategy: "weight_map" },
    };
  }
  if (method === "pugh") {
    return {
      text: "Comparing your two leading approaches, which one wins on the criterion that matters most to you?",
      chips: ["Better (+)", "Same (0)", "Worse (-)"],
      intent: "Pugh fallback when LLM response was malformed.",
      rule_fired: "fallback",
      extracts_into: { spec_path: "adrs[*].cites", kind: "pugh_cell", merge_strategy: "score_map" },
    };
  }
  return {
    text: "When does someone realize they need this product? What are they doing in the moments BEFORE they reach for it?",
    chips: ["Right after a sales call", "When their inbox crosses 50 unread", "End of every sprint"],
    intent: "JTBD fallback when LLM response was malformed.",
    rule_fired: "fallback",
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
  const { productState, spec, history } = input;
  const opts: LLMOptions = { llmConfig: input.llmConfig, context: input.context };

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

  const candidates = deriveCandidateUnknowns({ productState, spec });
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
    const question = await callMethodGenerator(
      method,
      { productState, spec, intakeAnswersSoFar: history, blockingTopUnknown: top },
      opts,
    );

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

  return { productState: next };
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
  const augmentedSpec: Spec = {
    ...baseSpec,
    assumptions: [
      ...baseSpec.assumptions,
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
