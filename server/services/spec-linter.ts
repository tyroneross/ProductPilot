/**
 * spec-linter — Phase 3 (and cross-platform expansion, 2026-05-02).
 *
 * Two-tier review:
 *
 *   1. Deterministic checks (this file). Regex/structural rules that never
 *      need an LLM. Cheap pre-filter that catches the majority of issues.
 *      These rules can produce `block` severity. Some are non-waivable.
 *
 *   2. LLM-tier checks (shared/prompts/lint/spec-review.ts). Haiku-tier
 *      classification for two fuzzy categories — ambiguous_language and
 *      unresolved_contradiction. These rules NEVER produce `block`; only the
 *      deterministic tier may block. The LLM emits at most 2 issues per spec.
 *
 * Per-platform rules ride on top of the deterministic tier. Each platform
 * declares the test-framework regex its tests must match; failure → block.
 *
 *     web | vite-spa  → /vitest|jest|playwright/i
 *     ios | macos     → /xctest|swift testing/i
 *     claude-plugin   → /plugin-builder|manifest-validator|skill-validator|hook-validator|command-validator/i
 *
 * Severity ladder: `block` > `warn` > `info`. Only `block` gates export.
 *
 * Waiver model: most blockers can be waived with a written reason (logged to
 * audit_events). The PII-without-handling-note rule is non-waivable —
 * rule.waivable === false on every issue it emits, and the route layer enforces
 * server-side.
 */

import { aiService, type AIMessage } from "./ai";
import type { LLMConfig } from "./ai";
import { scrubSecretsDeep } from "../lib/secret-crypto";
import specReviewPromptModule, {
  SPEC_REVIEW_PROMPT_CONTENT,
} from "@shared/prompts/lint/spec-review";
import {
  type Spec,
  type LintIssue,
  type ProductState,
  type PlatformTarget,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LintInput {
  spec: Spec;
  productState?: ProductState | null;
  // The linter falls back to deterministic-only when llmConfig is omitted
  // (keeps it usable in tests without an Anthropic key).
  llmConfig?: LLMConfig | null;
  // Optional context — propagated to the AIService for cost attribution.
  context?: { userId?: string | null; guestOwnerId?: string | null; projectId?: string | null };
}

export interface LintResult {
  issues: LintIssue[];
  /**
   * Internal categorization for the route layer:
   *   - blockerCount: count of severity='block' issues regardless of waivability.
   *   - nonWaivableCount: count of issues with waivable=false (always blockers).
   *   - llmRan: whether the Haiku-tier pass executed (false on missing key/error).
   */
  blockerCount: number;
  nonWaivableCount: number;
  llmRan: boolean;
}

// ---------------------------------------------------------------------------
// Per-platform test-framework patterns. Drives the platform-specific lint rule.
// ---------------------------------------------------------------------------

interface PlatformRules {
  /** Regex tested against Test.testFramework. */
  testFrameworkPattern: RegExp;
  /** Human-readable expectation, surfaced in the lint message. */
  expectedFrameworks: string;
  /** Extra deterministic checks beyond the framework pattern. */
  extras?: (spec: Spec, push: (issue: LintIssue) => void) => void;
}

const PLATFORM_RULES: Record<PlatformTarget, PlatformRules> = {
  web: {
    testFrameworkPattern: /vitest|jest|playwright/i,
    expectedFrameworks: "Vitest, Jest, or Playwright",
  },
  "vite-spa": {
    testFrameworkPattern: /vitest|playwright/i,
    expectedFrameworks: "Vitest (preferred) or Playwright",
  },
  ios: {
    testFrameworkPattern: /xctest|swift\s*testing/i,
    expectedFrameworks: "XCTest or Swift Testing",
    extras: (spec, push) => {
      // Apple HIG hooks — Dynamic Type + VoiceOver mention required somewhere
      // in the UX surface (uxFlows steps OR screen states OR product description).
      const haystack = [
        spec.productDescription,
        ...spec.screens.flatMap((s) => [s.purpose, ...s.states]),
        ...spec.uxFlows.flatMap((f) => f.steps),
      ]
        .join(" \n ")
        .toLowerCase();
      const mentionsDynamicType = /dynamic\s*type/.test(haystack);
      const mentionsVoiceOver = /voiceover|voice over|voice-over/.test(haystack);
      if (!mentionsDynamicType || !mentionsVoiceOver) {
        push(makeIssue({
          rule: "ios.accessibility_notes",
          severity: "block",
          waivable: true,
          message:
            "iOS spec must reference Dynamic Type and VoiceOver in UX flows, screen states, or product description. " +
            (mentionsDynamicType ? "" : "Missing: Dynamic Type. ") +
            (mentionsVoiceOver ? "" : "Missing: VoiceOver."),
          refs: [],
        }));
      }
    },
  },
  macos: {
    testFrameworkPattern: /xctest|swift\s*testing/i,
    expectedFrameworks: "XCTest or Swift Testing",
    extras: (spec, push) => {
      // macOS HIG hooks — menu-bar / window-management mention required.
      const haystack = [
        spec.productDescription,
        ...spec.screens.flatMap((s) => [s.purpose, ...s.states]),
        ...spec.uxFlows.flatMap((f) => f.steps),
      ]
        .join(" \n ")
        .toLowerCase();
      const mentionsMenuBar = /menu\s*bar|menubar|nsstatusitem|status\s*item/.test(haystack);
      const mentionsWindowMgmt = /window|toolbar|sidebar|nswindow|popover/.test(haystack);
      if (!mentionsMenuBar && !mentionsWindowMgmt) {
        push(makeIssue({
          rule: "macos.window_management_notes",
          severity: "block",
          waivable: true,
          message:
            "macOS spec must reference menu-bar/window/toolbar/sidebar conventions in UX flows, screens, or product description.",
          refs: [],
        }));
      }
    },
  },
  "claude-plugin": {
    testFrameworkPattern: /plugin[- ]?builder|manifest[- ]?validator|skill[- ]?validator|hook[- ]?validator|command[- ]?validator/i,
    expectedFrameworks: "plugin-builder validators (manifest/skill/hook/command)",
    extras: (spec, push) => {
      // Plugin manifest must be present somewhere — we look for a "plugin.json"
      // mention OR an integration named like a Claude plugin manifest. The spec
      // graph doesn't have a dedicated 'manifest' kind, so we accept any mention
      // in productDescription, integrations, or a non-goal because clause.
      const haystack = [
        spec.productDescription,
        ...spec.integrations.map((i) => `${i.name} ${i.purpose}`),
        ...spec.nonGoals.map((g) => `${g.text} ${g.because}`),
        ...spec.adrs.map((a) => `${a.title} ${a.context} ${a.decision}`),
      ]
        .join(" \n ")
        .toLowerCase();
      const declaresManifest = /plugin\.json|claude\.json|\.claude-plugin|plugin manifest/.test(haystack);
      if (!declaresManifest) {
        push(makeIssue({
          rule: "claude_plugin.manifest_required",
          severity: "block",
          waivable: true,
          message:
            "claude-plugin spec must declare a plugin manifest (e.g. 'plugin.json') in description, integrations, or an ADR.",
          refs: [],
        }));
      }
      // Every test that targets this platform should also carry at least one
      // validatorRef — otherwise it is not exercising the plugin-builder gate.
      for (const test of spec.tests) {
        if (test.validatorRefs.length === 0) {
          push(makeIssue({
            rule: "claude_plugin.validator_ref_missing",
            severity: "warn",
            waivable: true,
            message: `Test ${test.id} ('${truncate(test.description, 60)}') has no validatorRefs[] entry — claude-plugin tests should cite at least one validator.`,
            refs: [{ kind: "test", id: test.id }],
          }));
        }
      }
    },
  },
};

// ---------------------------------------------------------------------------
// PRD-Builder Stage-1 Fidelity Check
//
// Eight tactical questions the Brief alone must derive. The check predicts
// each from the productState + spec deterministically; <6/8 derivable → block.
// ---------------------------------------------------------------------------

const FIDELITY_QUESTIONS: ReadonlyArray<{
  id: string;
  question: string;
  /** Deterministic predictor — returns true iff the brief lets us answer. */
  predictor: (spec: Spec, state: ProductState | null | undefined) => boolean;
}> = [
  {
    id: "speed_vs_accuracy",
    question: "Speed vs accuracy?",
    predictor: (_, s) =>
      hasBecauseClause(s, /speed|fast|latency|throughput|accuracy|correct|precise/i),
  },
  {
    id: "complexity_vs_simplify",
    question: "Add complexity vs simplify?",
    predictor: (_, s) =>
      hasBecauseClause(s, /complex|simplif|minimal|opinionat|configurab/i) ||
      hasNonGoalBecause(_, /complex|configurab|customiz/i),
  },
  {
    id: "single_metric_vs_many",
    question: "Single primary metric vs many?",
    predictor: (spec) =>
      // A persona with at least one explicit job + a P0 need with a Test
      spec.personas.some((p) => p.jobs.length > 0) &&
      spec.needs.some((n) => n.priority === "P0" && spec.tests.some((t) => t.needIds.includes(n.id))),
  },
  {
    id: "off_persona_request_policy",
    question: "Accept off-persona feature request?",
    predictor: (spec) =>
      // At least one nonGoal with a non-empty because clause
      spec.nonGoals.some((g) => (g.because ?? "").trim().length > 0),
  },
  {
    id: "fail_loudly_vs_degrade",
    question: "Fail loudly vs degrade silently?",
    predictor: (_, s) =>
      hasBecauseClause(s, /fail|degrad|graceful|error|fallback|crash/i) ||
      hasRiskMitigation(_, /fallback|graceful|degrade|fail/i),
  },
  {
    id: "on_device_vs_cloud",
    question: "On-device vs cloud?",
    predictor: (spec, s) => {
      const haystack = [
        spec.productDescription,
        ...spec.adrs.map((a) => `${a.context} ${a.decision} ${a.consequences ?? ""}`),
        ...spec.dataPoints.map((d) => `${d.handlingNote ?? ""}`),
      ]
        .join(" \n ")
        .toLowerCase();
      return /on-device|local-first|on device|cloud|server|api|saas|self-host/.test(haystack) ||
        hasBecauseClause(s, /privacy|data|cloud|local|on-device/i);
    },
  },
  {
    id: "opinionated_vs_open_onboarding",
    question: "Opinionated vs open onboarding?",
    predictor: (spec) => spec.uxFlows.length > 0 && spec.uxFlows[0].steps.length > 0,
  },
  {
    id: "copy_competitor_feature",
    question: "Copy competitor feature on demand?",
    predictor: (_, s) =>
      hasBecauseClause(s, /competitor|differentiat|copy|parity|compete/i) ||
      hasNonGoalBecause(_, /competitor|differentiat|parity/i),
  },
];

const FIDELITY_THRESHOLD = 6; // <6/8 derivable → blocker

function hasBecauseClause(
  state: ProductState | null | undefined,
  pattern: RegExp,
): boolean {
  if (!state || !state.stanceBecauseClauses) return false;
  return state.stanceBecauseClauses.some(
    (c) => pattern.test(`${c.stance} ${c.because}`) && (c.because ?? "").trim().length > 0,
  );
}

function hasNonGoalBecause(spec: Spec, pattern: RegExp): boolean {
  return spec.nonGoals.some((g) => pattern.test(`${g.text} ${g.because}`) && (g.because ?? "").trim().length > 0);
}

function hasRiskMitigation(spec: Spec, pattern: RegExp): boolean {
  return spec.risks.some((r) => pattern.test(`${r.text} ${r.mitigation ?? ""}`));
}

export interface FidelityCheckResult {
  derivedCount: number;
  total: number;
  threshold: number;
  failures: Array<{ id: string; question: string }>;
  passes: boolean;
}

/**
 * Run the Stage-1 Fidelity Check deterministically.
 * Exposed so tests and the route layer can reason about the score independently
 * of the full lint pipeline.
 */
export function runFidelityCheck(
  spec: Spec,
  productState: ProductState | null | undefined,
): FidelityCheckResult {
  const failures: Array<{ id: string; question: string }> = [];
  let derivedCount = 0;
  for (const q of FIDELITY_QUESTIONS) {
    if (q.predictor(spec, productState ?? null)) {
      derivedCount++;
    } else {
      failures.push({ id: q.id, question: q.question });
    }
  }
  return {
    derivedCount,
    total: FIDELITY_QUESTIONS.length,
    threshold: FIDELITY_THRESHOLD,
    failures,
    passes: derivedCount >= FIDELITY_THRESHOLD,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let issueIdCounter = 0;
function nextIssueId(rule: string): string {
  issueIdCounter = (issueIdCounter + 1) % 1_000_000;
  return `lint-${rule}-${issueIdCounter}`;
}

function makeIssue(args: Omit<LintIssue, "id"> & { id?: string }): LintIssue {
  return {
    id: args.id ?? nextIssueId(args.rule),
    rule: args.rule,
    severity: args.severity,
    waivable: args.waivable,
    message: args.message,
    refs: args.refs ?? [],
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

// ---------------------------------------------------------------------------
// Deterministic rule set
// ---------------------------------------------------------------------------

function deterministicCheck(input: LintInput): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (i: LintIssue) => issues.push(i);
  const { spec, productState } = input;

  // Rule: every P0 Need must have ≥1 Test referencing its id.
  for (const need of spec.needs) {
    if (need.priority !== "P0") continue;
    const hasTest = spec.tests.some((t) => t.needIds.includes(need.id));
    if (!hasTest) {
      push(makeIssue({
        rule: "p0_need_missing_test",
        severity: "block",
        waivable: true,
        message: `P0 Need ${need.id} ('${truncate(need.title, 60)}') has no Test referencing it.`,
        refs: [{ kind: "need", id: need.id }],
      }));
    }
  }

  // Rule: every DataPoint with pii=true must have a non-empty handlingNote.
  // NON-WAIVABLE — security policy is above UX.
  for (const dp of spec.dataPoints) {
    if (dp.pii !== true) continue;
    if (!dp.handlingNote || dp.handlingNote.trim().length === 0) {
      push(makeIssue({
        rule: "pii_handling_note_missing",
        severity: "block",
        waivable: false,
        message: `DataPoint ${dp.id} ('${dp.name}') is marked pii=true with no handlingNote — non-waivable.`,
        refs: [{ kind: "datapoint", id: dp.id }],
      }));
    }
  }

  // Rule: every low-reversibility ADR must exist for at least one P0 need or
  // P0 feature. We invert this: every Need/Feature that is the subject of a
  // low-reversibility decision should be explicitly listed in adr.cites OR an
  // ADR entry should exist with reversibility='low' for the architecture.
  // Lightweight encoding: if there is ≥1 P0 Need or Feature without ANY ADR
  // attached, AND there are also ≥0 low-reversibility ADRs, that is a block.
  // Tighter rule: each ADR with reversibility='low' must list at least one
  // need/feature id in cites[]; otherwise block.
  for (const adr of spec.adrs) {
    if (adr.reversibility !== "low") continue;
    if (adr.cites.length === 0) {
      push(makeIssue({
        rule: "low_reversibility_adr_uncited",
        severity: "block",
        waivable: true,
        message: `ADR ${adr.id} ('${truncate(adr.title, 60)}') is low-reversibility with empty cites[]; cite the Needs/Features it justifies.`,
        refs: [{ kind: "adr", id: adr.id }],
      }));
    }
  }

  // Rule: every stance "because" clause must be non-empty.
  if (productState?.stanceBecauseClauses) {
    for (const stance of productState.stanceBecauseClauses) {
      if (!stance.because || stance.because.trim().length === 0) {
        push(makeIssue({
          rule: "stance_because_missing",
          severity: "block",
          waivable: true,
          message: `Stance ${stance.id} (${stance.category}) has an empty 'because' clause.`,
          refs: [{ kind: "stance", id: stance.id }],
        }));
      }
    }
  }

  // Rule: every NonGoal must carry a non-empty because clause.
  for (const ng of spec.nonGoals) {
    if (!ng.because || ng.because.trim().length === 0) {
      push(makeIssue({
        rule: "non_goal_because_missing",
        severity: "block",
        waivable: true,
        message: `NonGoal ${ng.id} ('${truncate(ng.text, 60)}') has an empty 'because' clause.`,
        refs: [{ kind: "non_goal", id: ng.id }],
      }));
    }
  }

  // Rule (cross-platform): every Test must declare a non-empty testFramework
  // and that framework must match the platformTarget's expected pattern.
  const platformRules = PLATFORM_RULES[spec.platformTarget];
  if (platformRules) {
    for (const test of spec.tests) {
      const framework = (test.testFramework ?? "").trim();
      if (framework.length === 0) {
        push(makeIssue({
          rule: "test_framework_missing",
          severity: "block",
          waivable: true,
          message: `Test ${test.id} ('${truncate(test.description, 60)}') has no testFramework — required for platform '${spec.platformTarget}' (${platformRules.expectedFrameworks}).`,
          refs: [{ kind: "test", id: test.id }],
        }));
        continue;
      }
      if (!platformRules.testFrameworkPattern.test(framework)) {
        push(makeIssue({
          rule: "test_framework_platform_mismatch",
          severity: "block",
          waivable: true,
          message: `Test ${test.id} testFramework '${framework}' is not appropriate for platform '${spec.platformTarget}' — expected ${platformRules.expectedFrameworks}.`,
          refs: [{ kind: "test", id: test.id }],
        }));
      }
    }
    if (platformRules.extras) {
      platformRules.extras(spec, push);
    }
  }

  // Rule: Stage-1 Fidelity Check (PRD-Builder amendment) — <6/8 derivable → block.
  const fidelity = runFidelityCheck(spec, productState ?? null);
  if (!fidelity.passes) {
    push(makeIssue({
      rule: "stage1_fidelity_below_threshold",
      severity: "block",
      waivable: true,
      message: `Stage-1 Fidelity Check: only ${fidelity.derivedCount}/${fidelity.total} tactical answers derivable from the Brief; threshold is ${fidelity.threshold}. Failing categories: ${fidelity.failures.map((f) => f.id).join(", ")}.`,
      refs: [],
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// LLM-tier (Haiku) — ambiguous_language + unresolved_contradiction
// ---------------------------------------------------------------------------

const ALLOWED_LLM_KINDS = new Set([
  "need", "feature", "persona", "scenario", "uxflow", "screen",
  "datapoint", "integration", "api", "test", "adr", "assumption",
  "risk", "non_goal", "stance",
]);

const ALLOWED_LLM_CATEGORIES = new Set(["ambiguous_language", "unresolved_contradiction"]);

async function llmCheck(input: LintInput): Promise<{ issues: LintIssue[]; ran: boolean }> {
  // No llmConfig + no global key → skip cleanly.
  const hasKey = !!input.llmConfig?.apiKey || !!process.env.ANTHROPIC_API_KEY;
  if (!hasKey) return { issues: [], ran: false };

  // Validate spec entity ids the LLM will be allowed to cite, so a hallucinated
  // id can be filtered before it reaches the issue list.
  const validIds = new Set<string>();
  for (const arr of [
    spec_.needs(input.spec), spec_.features(input.spec), spec_.personas(input.spec),
    spec_.scenarios(input.spec), spec_.uxFlows(input.spec), spec_.screens(input.spec),
    spec_.dataPoints(input.spec), spec_.integrations(input.spec), spec_.apiContracts(input.spec),
    spec_.tests(input.spec), spec_.adrs(input.spec), spec_.assumptions(input.spec),
    spec_.risks(input.spec), spec_.nonGoals(input.spec),
  ]) {
    for (const e of arr) validIds.add(e.id);
  }
  for (const s of input.productState?.stanceBecauseClauses ?? []) validIds.add(s.id);

  const userPayload = scrubSecretsDeep({
    spec: input.spec,
    productState: input.productState ?? null,
  });
  const messages: AIMessage[] = [
    { role: "system", content: SPEC_REVIEW_PROMPT_CONTENT },
    { role: "user", content: JSON.stringify(userPayload) },
  ];
  let parsed: any;
  try {
    parsed = await aiService.generateStructuredOutput(
      messages,
      specReviewPromptModule.defaultModel,
      input.llmConfig ?? null,
      "classification",
      input.context,
    );
  } catch {
    return { issues: [], ran: false };
  }

  if (!Array.isArray(parsed)) return { issues: [], ran: true };

  const issues: LintIssue[] = [];
  const seenCategories = new Set<string>();
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const category = typeof raw.category === "string" ? raw.category : "";
    if (!ALLOWED_LLM_CATEGORIES.has(category)) continue;
    if (seenCategories.has(category)) continue; // de-dupe per the prompt's "max 2" rule
    const message = typeof raw.message === "string" ? raw.message.slice(0, 240) : "";
    if (message.length === 0) continue;

    const refs = Array.isArray(raw.refs) ? raw.refs : [];
    const safeRefs = refs
      .filter((r: any) => r && typeof r === "object" &&
        typeof r.kind === "string" && ALLOWED_LLM_KINDS.has(r.kind) &&
        typeof r.id === "string" && validIds.has(r.id))
      .slice(0, 4)
      .map((r: any) => ({ kind: r.kind, id: r.id }));

    seenCategories.add(category);
    issues.push(makeIssue({
      rule: `llm.${category}`,
      // LLM tier never blocks; only the deterministic tier can.
      severity: category === "unresolved_contradiction" ? "warn" : "info",
      waivable: true,
      message,
      refs: safeRefs,
    }));
  }
  return { issues, ran: true };
}

// Tiny helpers wrapping schema-typed arrays — lets us pass them positionally
// without TS narrowing complaints. Defensive against missing fields when the
// caller hands us a partially-filled Spec from a test.
const spec_ = {
  needs: (s: Spec) => s.needs ?? [],
  features: (s: Spec) => s.features ?? [],
  personas: (s: Spec) => s.personas ?? [],
  scenarios: (s: Spec) => s.scenarios ?? [],
  uxFlows: (s: Spec) => s.uxFlows ?? [],
  screens: (s: Spec) => s.screens ?? [],
  dataPoints: (s: Spec) => s.dataPoints ?? [],
  integrations: (s: Spec) => s.integrations ?? [],
  apiContracts: (s: Spec) => s.apiContracts ?? [],
  tests: (s: Spec) => s.tests ?? [],
  adrs: (s: Spec) => s.adrs ?? [],
  assumptions: (s: Spec) => s.assumptions ?? [],
  risks: (s: Spec) => s.risks ?? [],
  nonGoals: (s: Spec) => s.nonGoals ?? [],
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function lintSpec(input: LintInput): Promise<LintResult> {
  const deterministic = deterministicCheck(input);
  const { issues: fromLlm, ran } = await llmCheck(input);
  const issues = [...deterministic, ...fromLlm];
  return {
    issues,
    blockerCount: issues.filter((i) => i.severity === "block").length,
    nonWaivableCount: issues.filter((i) => i.waivable === false).length,
    llmRan: ran,
  };
}

/**
 * Sync convenience — deterministic-only. Useful where the caller does not want
 * to await the Haiku call (e.g. CI pre-merge checks, debug routes).
 */
export function lintSpecSync(input: Omit<LintInput, "llmConfig" | "context">): LintResult {
  const issues = deterministicCheck(input);
  return {
    issues,
    blockerCount: issues.filter((i) => i.severity === "block").length,
    nonWaivableCount: issues.filter((i) => i.waivable === false).length,
    llmRan: false,
  };
}

/**
 * Sanitize a free-form waiver reason before persisting.
 * - Strip control characters and HTML tag-like sequences (XSS defense for admin views).
 * - Trim and cap at 1000 characters.
 */
export function sanitizeWaiverReason(raw: string): string {
  if (typeof raw !== "string") return "";
  // Drop NUL + ASCII control chars (0x00–0x1F, 0x7F) but keep tab (0x09) and newline (0x0A).
  const cleaned = Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 0x09 || code === 0x0a) return true;
      if (code < 0x20 || code === 0x7f) return false;
      return true;
    })
    .join("");
  // Escape angle brackets so a careless renderer cannot inject markup.
  const escaped = cleaned.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
  return escaped.trim().slice(0, 1000);
}
