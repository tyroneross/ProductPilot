/**
 * Groq structured-output reliability test (2026-05-02).
 *
 * Why this exists: the Phase 3/4/5 plan originally pinned structured-output-
 * critical calls to Anthropic, citing reliability concerns with Groq's
 * structured output. The 2026-05-02 routing override flipped the default to
 * Groq because the user has GROQ_API_KEY but not ANTHROPIC_API_KEY. Before
 * the alpha can ship on Groq we need empirical evidence that Groq returns
 * parseable JSON for the schemas this codebase actually uses.
 *
 * What this measures:
 *   - First-pass JSON-validity rate across 10 invocations per schema.
 *   - Retry-pass rate (the existing runStructuredWithRetry retry path).
 *   - Hard-fail rate (both passes invalid).
 *
 * Pass criterion (plan §"Structured-output reliability validation"):
 *   - first_pass_valid / total ≥ 0.90 per schema, OR
 *   - (first_pass_valid + retry_valid) / total ≥ 0.95 per schema (with retry).
 *
 * Output: server/test/baselines/2026-05-02-groq-structured-validity.csv —
 * columns: schema, total_calls, first_pass_valid, retry_valid, hard_fail, observations.
 *
 * Security:
 *   - Test gated on GROQ_API_KEY env presence; skips cleanly when absent.
 *   - Key read from env only — never logged, never written to CSV.
 *   - Test prompts are synthetic — no PII, no proprietary data.
 *
 * Schemas exercised (each one a real call site in the codebase):
 *   1. Spec                       — shared/schema.ts SpecSchema (Phase 4 ADR gen)
 *   2. ProductState slice         — stanceBecauseClauses[] (Phase 2 intake)
 *   3. LintIssue[]                — Phase 3 LLM-tier review output
 *   4. Method-router decision     — {method, reason} (Phase 2)
 *   5. Blocking-scorer tuple      — [{topic, evidence, reversibility, risk, decision, reason}, ...]
 */

import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  SpecSchema,
  StanceBecauseClauseSchema,
  LintIssueSchema,
} from "@shared/schema";
import { aiService, extractJSONFromText } from "../services/ai";
import type { AIMessage } from "../services/ai";

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------

/** How many times to invoke each schema. Plan asks for ≥10. */
const CALLS_PER_SCHEMA = 10;

/** Hard pass criterion: first-pass validity threshold. */
const MIN_FIRST_PASS_RATE = 0.9;

/** Soft pass criterion (with retry fallback). */
const MIN_RETRY_PASS_RATE = 0.95;

/** Per-test timeout — 10 calls × ~3s each + buffer. */
const PER_SCHEMA_TIMEOUT_MS = 90_000;

const HAS_GROQ_KEY = Boolean(process.env.GROQ_API_KEY);

// ---------------------------------------------------------------------------
// Per-schema test plan
// ---------------------------------------------------------------------------

interface SchemaCase {
  name: string;
  /** Model tier — fast classifier for tuples, reasoning for full Spec. */
  model: "llama-3.1-8b-instant" | "openai/gpt-oss-120b";
  /** System prompt — short, schema-focused. Real call sites use longer prompts; the goal here is to stress JSON adherence, not domain quality. */
  systemPrompt: string;
  /** User payload (the structured input the prompt expects). */
  userMessage: string;
  /** Validates a parsed JSON object/array. Returns true when shape is acceptable. */
  validate: (parsed: unknown) => boolean;
  observations: string;
}

const SCHEMAS: SchemaCase[] = [
  {
    name: "Spec",
    model: "openai/gpt-oss-120b",
    systemPrompt: [
      "You generate ProductPilot Spec JSON. Reply with ONLY a single valid JSON object.",
      "The object MUST include: id (string), productName (string), productDescription (string),",
      "platformTarget (one of: web, vite-spa, ios, macos, claude-plugin),",
      "and arrays for personas, scenarios, needs, features, uxFlows, screens, dataPoints,",
      "integrations, apiContracts, tests, adrs, assumptions, risks, nonGoals.",
      "Empty arrays are allowed. No markdown fences. No commentary.",
    ].join(" "),
    userMessage: JSON.stringify({
      productName: "RouteMate",
      productDescription: "Personal route planner for solo runners.",
      platformTarget: "web",
      ask: "Emit the Spec JSON. Personas may be empty. Use id 'spec-routemate'.",
    }),
    validate: (parsed) => {
      const result = SpecSchema.safeParse(parsed);
      return result.success;
    },
    observations: "Highest-stakes structured output — Phase 4 ADR-bearing Spec.",
  },

  {
    name: "ProductState.stanceBecauseClauses",
    model: "llama-3.1-8b-instant",
    systemPrompt: [
      "You return a JSON object with one key, 'stanceBecauseClauses', whose value is an array.",
      "Each element MUST be an object with: id (string id-shaped slug), category (one of:",
      "privacy_data, complexity, cost, category), stance (string), because (string).",
      "Reply with ONLY the JSON object. No markdown fences. No commentary.",
    ].join(" "),
    userMessage: JSON.stringify({
      productIdea: "Local-first journaling app for solo writers.",
      ask: "Emit 3 stanceBecauseClauses covering privacy_data, complexity, cost.",
    }),
    validate: (parsed) => {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      const arr = (parsed as any).stanceBecauseClauses;
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.every((row: unknown) => {
        const r = StanceBecauseClauseSchema.safeParse(row);
        return r.success;
      });
    },
    observations: "Phase 2 intake — small, fast classification target.",
  },

  {
    name: "LintIssue[]",
    model: "llama-3.1-8b-instant",
    systemPrompt: [
      "You produce a JSON array of LintIssue objects (possibly empty). Each entry has:",
      "id (string), rule (string), severity (one of: block, warn, info), waivable (boolean),",
      "message (string), refs (array of {kind, id} with kind in: need, feature, persona,",
      "scenario, uxflow, screen, datapoint, integration, api, test, adr, assumption, risk, non_goal, stance).",
      "Reply with ONLY the JSON array. No markdown fences. No commentary.",
    ].join(" "),
    userMessage: JSON.stringify({
      ask: "Emit 2 lint issues for a hypothetical spec — one ambiguous_language warning and one info-tier observation.",
      hint: "Use rule names like 'llm.ambiguous_language' and 'llm.info_observation'.",
    }),
    validate: (parsed) => {
      if (!Array.isArray(parsed)) return false;
      if (parsed.length === 0) return true; // empty array is acceptable per the linter contract
      return parsed.every((row) => LintIssueSchema.safeParse(row).success);
    },
    observations: "Phase 3 LLM-tier linter — empty array is the most common shape.",
  },

  {
    name: "method-router decision",
    model: "llama-3.1-8b-instant",
    systemPrompt: [
      "You pick exactly one intake method. Reply with ONLY a single JSON object of shape:",
      '{"method": "jtbd" | "qfd" | "pugh", "reason": "<one sentence>"}',
      "No markdown fences. No commentary.",
    ].join(" "),
    userMessage: JSON.stringify({
      productState: { stanceBecauseClauses: [] },
      spec: { personas: [], features: [], adrs: [] },
      ask: "Pick the method. Personas empty → expect jtbd.",
    }),
    validate: (parsed) => {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      const obj = parsed as Record<string, unknown>;
      const validMethod =
        typeof obj.method === "string" && ["jtbd", "qfd", "pugh"].includes(obj.method);
      const validReason = typeof obj.reason === "string" && obj.reason.length > 0;
      return validMethod && validReason;
    },
    observations: "Phase 2 method router — small classification, low ambiguity.",
  },

  {
    name: "blocking-scorer tuple[]",
    model: "llama-3.1-8b-instant",
    systemPrompt: [
      "You score candidate unknowns for blocking. Reply with ONLY a JSON array.",
      "Each element MUST be an object with: topic (string), evidence (int 0..5),",
      "reversibility (int 0..5), risk (int 0..5), decision (one of 'ask' | 'infer'),",
      "reason (string). Output array length equals input candidates length.",
      "No markdown fences. No commentary.",
    ].join(" "),
    userMessage: JSON.stringify({
      candidates: [
        { topic: "primary_persona_and_trigger", why_it_matters: "No personas defined" },
        { topic: "measurable_outcome", why_it_matters: "No verifiable success signal" },
        { topic: "non_goals", why_it_matters: "No explicit non-goals" },
      ],
      ask: "Score each candidate 0-5 on the three axes; emit decisions and reasons.",
    }),
    validate: (parsed) => {
      if (!Array.isArray(parsed)) return false;
      if (parsed.length === 0) return false;
      return parsed.every((row: any) => {
        if (!row || typeof row !== "object") return false;
        const e = row.evidence, r = row.reversibility, k = row.risk;
        if (typeof e !== "number" || e < 0 || e > 5) return false;
        if (typeof r !== "number" || r < 0 || r > 5) return false;
        if (typeof k !== "number" || k < 0 || k > 5) return false;
        if (typeof row.topic !== "string") return false;
        if (row.decision !== "ask" && row.decision !== "infer") return false;
        return true;
      });
    },
    observations: "Phase 2 blocking scorer — fixed-length array shape.",
  },
];

// ---------------------------------------------------------------------------
// Per-call helper: invoke once, capture first-pass + retry parse outcome.
// ---------------------------------------------------------------------------

interface CallOutcome {
  firstPassValid: boolean;
  retryValid: boolean;
  hardFail: boolean;
  errorClass?: string;
}

async function invokeOnce(c: SchemaCase): Promise<CallOutcome> {
  const messages: AIMessage[] = [
    { role: "system", content: c.systemPrompt },
    { role: "user", content: c.userMessage },
  ];

  // Direct generateStructuredOutput so we hit the same routing the real call
  // sites use. With GROQ_API_KEY set + the 2026-05-02 override, this resolves
  // to the Groq path inside AIService.
  let firstRaw = "";
  try {
    const first = await aiService.generateStructuredOutput(
      messages,
      c.model,
      // Force Groq + the requested model for deterministic measurement.
      { provider: "groq", apiKey: process.env.GROQ_API_KEY!, model: c.model },
      "classification",
      undefined,
    );
    firstRaw = JSON.stringify(first);
    if (c.validate(first)) {
      return { firstPassValid: true, retryValid: false, hardFail: false };
    }
    // Shape was wrong but parsed — count as first-pass invalid and try the
    // retry path. We invoke again with a stricter system reminder appended,
    // mirroring the runStructuredWithRetry pattern in ai.ts.
  } catch (err) {
    const errClass =
      err instanceof Error ? err.message.split(":")[0].slice(0, 60) : "unknown";
    // Retry once on hard parse failure.
    try {
      const second = await aiService.generateStructuredOutput(
        [
          ...messages,
          {
            role: "user",
            content:
              "Your previous response was not valid JSON. Reply with ONLY a valid JSON object/array matching the schema. No markdown fences. No commentary. The first character MUST be `{` or `[`.",
          },
        ],
        c.model,
        { provider: "groq", apiKey: process.env.GROQ_API_KEY!, model: c.model },
        "classification",
        undefined,
      );
      if (c.validate(second)) {
        return { firstPassValid: false, retryValid: true, hardFail: false, errorClass: errClass };
      }
      return { firstPassValid: false, retryValid: false, hardFail: true, errorClass: errClass };
    } catch (err2) {
      const cls = err2 instanceof Error ? err2.message.split(":")[0].slice(0, 60) : "unknown";
      return { firstPassValid: false, retryValid: false, hardFail: true, errorClass: `${errClass}|${cls}` };
    }
  }

  // First pass parsed but failed validation — retry with a sharper reminder.
  try {
    const second = await aiService.generateStructuredOutput(
      [
        ...messages,
        {
          role: "user",
          content:
            "Your previous response did not match the required schema shape. Reply with ONLY a valid JSON object/array matching the schema exactly. No markdown fences. No commentary.",
        },
      ],
      c.model,
      { provider: "groq", apiKey: process.env.GROQ_API_KEY!, model: c.model },
      "classification",
      undefined,
    );
    if (c.validate(second)) {
      return { firstPassValid: false, retryValid: true, hardFail: false };
    }
    return { firstPassValid: false, retryValid: false, hardFail: true };
  } catch {
    return { firstPassValid: false, retryValid: false, hardFail: true };
  }
}

// ---------------------------------------------------------------------------
// Per-schema runner — returns aggregated counts.
// ---------------------------------------------------------------------------

interface SchemaSummary {
  schema: string;
  total_calls: number;
  first_pass_valid: number;
  retry_valid: number;
  hard_fail: number;
  observations: string;
}

async function runSchema(c: SchemaCase): Promise<SchemaSummary> {
  let firstPass = 0;
  let retryPass = 0;
  let hardFail = 0;

  for (let i = 0; i < CALLS_PER_SCHEMA; i++) {
    const outcome = await invokeOnce(c);
    if (outcome.firstPassValid) firstPass++;
    else if (outcome.retryValid) retryPass++;
    else hardFail++;
  }

  return {
    schema: c.name,
    total_calls: CALLS_PER_SCHEMA,
    first_pass_valid: firstPass,
    retry_valid: retryPass,
    hard_fail: hardFail,
    observations: c.observations,
  };
}

// ---------------------------------------------------------------------------
// CSV writer
// ---------------------------------------------------------------------------

function writeCsv(rows: SchemaSummary[]): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const baselineDir = join(__dirname, "baselines");
  mkdirSync(baselineDir, { recursive: true });
  const path = join(baselineDir, "2026-05-02-groq-structured-validity.csv");

  const header = [
    "# Groq structured-output reliability — 2026-05-02",
    `# Each row is ${CALLS_PER_SCHEMA} live calls against the Groq model named on that row's prompt module.`,
    "# Pass criteria (plan §Structured-output reliability validation):",
    `#   first_pass_valid / total_calls >= ${MIN_FIRST_PASS_RATE}, OR`,
    `#   (first_pass_valid + retry_valid) / total_calls >= ${MIN_RETRY_PASS_RATE}.`,
    "# hard_fail = both first-pass and retry-pass invalid (counts toward neither).",
    "schema,total_calls,first_pass_valid,retry_valid,hard_fail,observations",
  ].join("\n");

  const data = rows.map((r) =>
    [
      r.schema,
      r.total_calls,
      r.first_pass_valid,
      r.retry_valid,
      r.hard_fail,
      `"${r.observations.replace(/"/g, '""')}"`,
    ].join(","),
  );

  const csv = [header, ...data].join("\n") + "\n";
  writeFileSync(path, csv, "utf-8");
  return path;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Groq structured-output reliability — live (gated on GROQ_API_KEY)", () => {
  if (!HAS_GROQ_KEY) {
    it.skip("skipped — GROQ_API_KEY not set", () => {
      // Skipped intentionally so unit-test runs without an API key still pass.
    });
    return;
  }

  // Aggregate every schema's results so we can write one CSV at the end.
  const summaries: SchemaSummary[] = [];

  for (const c of SCHEMAS) {
    it(
      `${c.name} — JSON validity ≥ ${(MIN_FIRST_PASS_RATE * 100).toFixed(0)}% (or ≥ ${(MIN_RETRY_PASS_RATE * 100).toFixed(0)}% with retry)`,
      async () => {
        const summary = await runSchema(c);
        summaries.push(summary);

        const firstRate = summary.first_pass_valid / summary.total_calls;
        const retryRate = (summary.first_pass_valid + summary.retry_valid) / summary.total_calls;

        // Either first-pass clears 90% OR (first + retry) clears 95%.
        const passes = firstRate >= MIN_FIRST_PASS_RATE || retryRate >= MIN_RETRY_PASS_RATE;
        expect(
          passes,
          `Schema "${c.name}" failed reliability gate: first_pass=${summary.first_pass_valid}/${summary.total_calls} (${(firstRate * 100).toFixed(0)}%), retry=${summary.retry_valid}/${summary.total_calls}, hard_fail=${summary.hard_fail}/${summary.total_calls}.`,
        ).toBe(true);
      },
      PER_SCHEMA_TIMEOUT_MS,
    );
  }

  it("writes the validity CSV summary", () => {
    // Only meaningful when at least one schema test ran.
    if (summaries.length === 0) return;
    const path = writeCsv(summaries);
    expect(path).toContain("2026-05-02-groq-structured-validity.csv");
  });
});

// extractJSONFromText is exercised indirectly via aiService.generateStructuredOutput;
// import remains so the same parsing logic is testable from this file in future changes.
void extractJSONFromText;
