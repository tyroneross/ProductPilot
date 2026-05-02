/**
 * Phase 0 eval harness — ProductPilot adaptive-intake baseline.
 *
 * Runs each synthetic fixture through the existing Path A pipeline:
 *   1. Build project context from fixture description
 *   2. Run survey generation (buildSurveyGenerationPrompt → aiService.chat)
 *   3. Simulate user filling survey (from simulatedSurveyResponses)
 *   4. Run doc generation for all 6 stages (buildDocumentGenerationPrompt → aiService.chat)
 *   5. Sum cost via imported MODEL_COST_RATES (no copy of rates)
 *   6. Count questions asked (discovery turns + survey questions)
 *   7. Sum doc word counts
 *   8. Write one CSV row per fixture
 *
 * Output: server/test/baselines/2026-05-02.csv (baseline commit)
 *         server/test/eval-runs/<timestamp>.csv (subsequent runs, gitignored)
 *
 * Security:
 *   - Production guard: line 1 of executable code.
 *   - ANTHROPIC_API_KEY read from env only — never logged.
 *   - No DB writes (storage-hybrid not imported; recordLlmCall fires internally
 *     inside AIService but fails silently on missing DB connection).
 *   - No proprietary references, no PII-shaped data.
 */

// --- Production guard -----------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  throw new Error("eval-intake refuses to run in production");
}

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { z } from "zod";
import { aiService, MODEL_COST_RATES } from "../services/ai.js";
import {
  buildSurveyGenerationPrompt,
  buildDocumentGenerationPrompt,
  buildProjectContext,
} from "../prompt-builders.js";
import { DEFAULT_STAGES } from "../../shared/schema.js";
import type { Project, Stage, Message } from "@shared/schema";
import {
  SAMPLE_PRODUCTS,
  buildSimulatedDiscoveryMessages,
  type SampleProduct,
} from "./fixtures/sample-products.js";

// ---------------------------------------------------------------------------
// Cost helper — uses imported MODEL_COST_RATES, no copy of the rates table
// ---------------------------------------------------------------------------
function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = MODEL_COST_RATES[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Minimal stubs so prompt builders receive correctly-typed objects
// ---------------------------------------------------------------------------
function makeProjectStub(
  fixture: SampleProduct,
  surveyDefinition: unknown,
): Project {
  return {
    id: `eval-project-${fixture.id}`,
    userId: null,
    guestOwnerId: null,
    name: fixture.label,
    description: fixture.initialIdea,
    mode: "survey",
    aiModel: "claude-sonnet",
    surveyPhase: "complete",
    surveyDefinition: surveyDefinition as any,
    surveyResponses: fixture.simulatedSurveyResponses as any,
    customPrompts: null,
    intakeAnswers: null,
    minimumDetails: null,
    appStyle: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Project;
}

function makeStageStub(template: (typeof DEFAULT_STAGES)[number]): Stage {
  return {
    id: `eval-stage-${template.stageNumber}`,
    projectId: "eval-project",
    stageNumber: template.stageNumber,
    title: template.title,
    description: template.description,
    systemPrompt: template.systemPrompt,
    aiModel: (template as any).aiModel ?? null,
    progress: 0,
    isUnlocked: template.isUnlocked,
    outputs: null,
    keyInsights: template.keyInsights ?? null,
    completedInsights: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Stage;
}

// ---------------------------------------------------------------------------
// Resolve model name — mirrors AIService.normalizeModel logic
// ---------------------------------------------------------------------------
function resolveModel(task: "deliverable" | "complex"): string {
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (hasAnthropic) {
    return task === "complex" ? "claude-opus-4-7" : "claude-sonnet-4-5";
  }
  // Groq fallback
  return "openai/gpt-oss-120b";
}

// ---------------------------------------------------------------------------
// CSV row type
// ---------------------------------------------------------------------------
interface CsvRow {
  idea_id: string;
  archetype: string;
  questions_asked: number;
  time_to_brief_ms: number;
  total_cost_usd: string;
  doc_word_count: number;
  traceability_gaps_manual: string;
  lint_issues_simulated: string;
}

// ---------------------------------------------------------------------------
// Per-fixture runner
// ---------------------------------------------------------------------------
async function runFixture(fixture: SampleProduct): Promise<CsvRow> {
  console.log(`\n[eval] Running fixture: ${fixture.id} (${fixture.label})`);
  const startMs = Date.now();

  let totalCostUsd = 0;
  let totalDocWords = 0;

  // ------------------------------------------------------------------
  // Step 1: Survey generation
  // ------------------------------------------------------------------
  // Use aiService.chat() (not generateStructuredOutput) so we get usage
  // back for cost tracking. The survey prompt already instructs JSON-only output.
  const discoveryMessages = buildSimulatedDiscoveryMessages(
    fixture.simulatedDiscoveryAnswers,
  );
  const surveyPrompt = buildSurveyGenerationPrompt({
    projectDescription: fixture.initialIdea,
    discoveryMessages,
  });

  const systemPromptForSurvey =
    "You generate compact, high-signal product surveys for ProductPilot. " +
    "Constraints: Output one valid JSON object only. Use only the supported question types: slider, single-select, multi-select. " +
    "Prefer questions that close the biggest product-definition gaps. Keep option labels short and concrete. " +
    "Skip questions already answered in the supplied context. Focus on what to build and how it should work.";

  console.log(`  [eval] Generating survey for ${fixture.id}...`);
  const surveyResponse = await aiService.chat(
    [
      { role: "system", content: systemPromptForSurvey },
      { role: "user", content: surveyPrompt },
    ],
    "claude-sonnet",
    undefined,
    "deliverable",
  );

  // Count survey questions from AI output
  let surveyDefinition: unknown = {};
  let surveyQuestionCount = 0;
  try {
    // Parse the JSON from the response content
    let raw = surveyResponse.content.trim();
    // Strip markdown fences if present
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) raw = fenceMatch[1];
    surveyDefinition = JSON.parse(raw);
    const sections = (surveyDefinition as any)?.sections ?? [];
    for (const section of sections) {
      surveyQuestionCount += (section.questions ?? []).length;
    }
  } catch {
    console.warn(`  [eval] Could not parse survey JSON for ${fixture.id} — survey question count = 0`);
  }

  // Accumulate cost for survey gen
  if (surveyResponse.usage) {
    const surveyModel = resolveModel("deliverable");
    totalCostUsd += computeCostUsd(
      surveyModel,
      surveyResponse.usage.prompt_tokens,
      surveyResponse.usage.completion_tokens,
    );
  }

  // ------------------------------------------------------------------
  // Step 2: Doc generation — all 6 stages
  // ------------------------------------------------------------------
  const projectStub = makeProjectStub(fixture, surveyDefinition);
  const projectContext = buildProjectContext(projectStub);

  for (const template of DEFAULT_STAGES) {
    const stage = makeStageStub(template);
    const docPrompt = buildDocumentGenerationPrompt({
      stage,
      surveyDefinition,
      surveyResponses: fixture.simulatedSurveyResponses,
      detailLevel: "detailed",
      activePrompts: [],
      relevantPrompts: [],
      productDescription: fixture.initialIdea,
    });

    // Stages 4+ use 'complex' (Opus), lower stages use 'deliverable' (Sonnet)
    // — matches the route's task selection logic at line 910.
    const task = template.stageNumber >= 4 ? "complex" : "deliverable";

    console.log(
      `  [eval] Generating Stage ${template.stageNumber} (${template.title}) for ${fixture.id}...`,
    );
    const docResponse = await aiService.chat(
      [
        { role: "system", content: template.systemPrompt },
        { role: "user", content: docPrompt },
      ],
      "claude-sonnet",
      undefined,
      task,
    );

    // Accumulate cost and word count
    if (docResponse.usage) {
      const docModel = resolveModel(task);
      totalCostUsd += computeCostUsd(
        docModel,
        docResponse.usage.prompt_tokens,
        docResponse.usage.completion_tokens,
      );
    }
    totalDocWords += countWords(docResponse.content);
  }

  const elapsedMs = Date.now() - startMs;

  // Questions asked = discovery turns + survey questions
  const questionsAsked =
    fixture.simulatedDiscoveryAnswers.length + surveyQuestionCount;

  console.log(
    `  [eval] Done: ${fixture.id} — ${questionsAsked} questions, ` +
    `${totalDocWords} words, $${totalCostUsd.toFixed(4)}, ${elapsedMs}ms`,
  );

  return {
    idea_id: fixture.id,
    archetype: fixture.archetype,
    questions_asked: questionsAsked,
    time_to_brief_ms: elapsedMs,
    total_cost_usd: totalCostUsd.toFixed(6),
    doc_word_count: totalDocWords,
    // Placeholder columns — Phase 3 fills these in via manual review + linter.
    traceability_gaps_manual: "0",
    lint_issues_simulated: "0",
  };
}

// ---------------------------------------------------------------------------
// CSV formatter
// ---------------------------------------------------------------------------
function buildCsv(rows: CsvRow[]): string {
  const header = [
    "# Phase 0 eval baseline — 2026-05-02",
    "# traceability_gaps_manual: manual review field — Phase 3 fills this in",
    "# lint_issues_simulated: Phase 3 linter output — placeholder 0 for now",
    "idea_id,archetype,questions_asked,time_to_brief_ms,total_cost_usd,doc_word_count,traceability_gaps_manual,lint_issues_simulated",
  ].join("\n");

  const dataRows = rows.map((r) =>
    [
      r.idea_id,
      r.archetype,
      r.questions_asked,
      r.time_to_brief_ms,
      r.total_cost_usd,
      r.doc_word_count,
      r.traceability_gaps_manual,
      r.lint_issues_simulated,
    ].join(","),
  );

  return [header, ...dataRows].join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Check for API key before incurring any cost
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.error(
      "[eval] No ANTHROPIC_API_KEY or GROQ_API_KEY found in environment. " +
      "Set ANTHROPIC_API_KEY and re-run. Aborting.",
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[eval] ANTHROPIC_API_KEY not set — falling back to Groq. " +
      "Cost rates will use Groq pricing. Results may differ from Anthropic baseline.",
    );
  }

  console.log("[eval] Phase 0 eval harness starting...");
  console.log(`[eval] Fixtures: ${SAMPLE_PRODUCTS.length}`);

  const rows: CsvRow[] = [];

  for (const fixture of SAMPLE_PRODUCTS) {
    try {
      const row = await runFixture(fixture);
      rows.push(row);
    } catch (err) {
      console.error(
        `[eval] Fixture ${fixture.id} failed:`,
        err instanceof Error ? err.message : err,
      );
      // Push a failure row so CSV always has 5 rows
      rows.push({
        idea_id: fixture.id,
        archetype: fixture.archetype,
        questions_asked: 0,
        time_to_brief_ms: 0,
        total_cost_usd: "0.000000",
        doc_word_count: 0,
        traceability_gaps_manual: "ERROR",
        lint_issues_simulated: "ERROR",
      });
    }
  }

  const csvContent = buildCsv(rows);

  // __dirname equivalent for ESM
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Baseline path (committed snapshot) — resolves to server/test/baselines/
  const baselinePath = join(__dirname, "baselines/2026-05-02.csv");
  writeFileSync(baselinePath, csvContent, "utf-8");
  console.log(`\n[eval] Baseline written to: ${baselinePath}`);

  // Also write a timestamped run copy to eval-runs/ (gitignored)
  const runDir = join(__dirname, "eval-runs");
  mkdirSync(runDir, { recursive: true });
  const runPath = join(runDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
  writeFileSync(runPath, csvContent, "utf-8");
  console.log(`[eval] Run copy written to: ${runPath}`);

  console.log("\n[eval] Baseline CSV:");
  console.log(csvContent);

  // Summary table
  console.log("[eval] Summary:");
  for (const row of rows) {
    console.log(
      `  ${row.idea_id} | ${row.archetype} | questions=${row.questions_asked} | words=${row.doc_word_count} | cost=$${row.total_cost_usd} | ms=${row.time_to_brief_ms}`,
    );
  }
}

// ---------------------------------------------------------------------------
// --measure-cache mode (Phase 1 entry-criterion discharge)
// ---------------------------------------------------------------------------
//
// Phase 1 measured cacheability structurally (~87% of the system prompt is
// cacheable). This mode runs the actual Anthropic call twice against the same
// stable prefix and reports input-token / cache-read / cache-write counts.
//
// Plan §"Phase 1 Checks": "Re-run stage generation shows ≥40% reduced input
// tokens (cache hit)." A reduction <40% on the second-pass call indicates the
// cache marker is placed wrong (e.g. before tenant-scoped context, or stale).
//
// Output: server/test/baselines/2026-05-02-cache.csv
// Failure mode: throws if reduction <40% so CI / local runs surface the issue.
//
// Skips when ANTHROPIC_API_KEY is absent (Groq does not implement Anthropic-
// shaped prompt caching). The script writes a sentinel CSV row so the report
// can cite the deferral.
// ---------------------------------------------------------------------------
async function measureCache(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const cachePath = join(__dirname, "baselines/2026-05-02-cache.csv");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[cache] ANTHROPIC_API_KEY not set — cannot measure Anthropic prompt cache. " +
      "Skipping with sentinel CSV row.",
    );
    const sentinel = [
      "# Phase 1 cache-hit live measurement — 2026-05-02",
      "# DEFERRED: ANTHROPIC_API_KEY not set in env at run time. [CLEANUP] tracking.",
      "fixture_id,pass,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,reduction_pct",
      "n/a,n/a,0,0,0,0,deferred",
    ].join("\n") + "\n";
    writeFileSync(cachePath, sentinel, "utf-8");
    console.log(`[cache] Sentinel written to: ${cachePath}`);
    return;
  }

  // Lazy import — avoids loading prompt-builders at top-level for the default eval path.
  const { buildDocumentGenerationBlocks, buildProjectContext } = await import(
    "../prompt-builders.js"
  );
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Single fixture — we are measuring the cache shape, not generating documents.
  const fixture = SAMPLE_PRODUCTS[0];
  console.log(`[cache] Using fixture: ${fixture.id} (${fixture.label})`);

  // Build a stable Spec prompt — Brief stage. The block layout is what's under test:
  //   [0] stage instruction (stable per stage)
  //   [1] project context with cache_control marker
  //   [2] dynamic block (no cache)
  // Two passes with the same arguments → second pass should hit the cache prefix
  // and show cache_read_tokens > 0 and a corresponding drop in input_tokens.
  const projectStub = makeProjectStub(fixture, {});
  const projectContext = buildProjectContext(projectStub);
  const stage = makeStageStub(DEFAULT_STAGES[0]);
  const blocks = buildDocumentGenerationBlocks({
    stageKind: "brief",
    stage,
    projectContext,
    dynamicContext: `Survey responses: ${JSON.stringify(fixture.simulatedSurveyResponses)}`,
  });

  const userMessages = [{ role: "user" as const, content: "Emit the Spec JSON for the Stage 1 Brief." }];

  const passes: Array<{
    pass: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  }> = [];

  for (let i = 0; i < 2; i++) {
    const label = i === 0 ? "first" : "second";
    console.log(`[cache] Pass ${label}...`);
    // Call Anthropic SDK directly — we need in-process access to usage including
    // cache_read_input_tokens / cache_creation_input_tokens. The helper records
    // these to llm_calls but does not return them.
    const probe = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0.3,
      system: blocks,
      messages: [{ role: "user", content: userMessages[0].content }],
    });
    passes.push({
      pass: label,
      input_tokens: probe.usage.input_tokens,
      output_tokens: probe.usage.output_tokens,
      cache_read_tokens: (probe.usage as any).cache_read_input_tokens ?? 0,
      cache_write_tokens: (probe.usage as any).cache_creation_input_tokens ?? 0,
    });
    console.log(
      `[cache] Pass ${label}: input=${probe.usage.input_tokens} ` +
      `output=${probe.usage.output_tokens} ` +
      `cache_read=${(probe.usage as any).cache_read_input_tokens ?? 0} ` +
      `cache_write=${(probe.usage as any).cache_creation_input_tokens ?? 0}`,
    );
  }

  // Reduction = (1 - secondNonCachedInput / firstNonCachedInput) but Anthropic
  // accounts for cached input as cache_read_input_tokens, NOT as input_tokens.
  // So: first call's "fresh input" = input_tokens (no cache hit yet, cache_write).
  //     second call's "fresh input" = input_tokens (cache_read sits separately).
  // Reduction in *billable fresh input* = (first.input - second.input) / first.input.
  const first = passes[0];
  const second = passes[1];
  const reductionPct =
    first.input_tokens > 0
      ? ((first.input_tokens - second.input_tokens) / first.input_tokens) * 100
      : 0;
  const cacheHit = second.cache_read_tokens > 0;

  const csvLines = [
    "# Phase 1 cache-hit live measurement — 2026-05-02",
    "# Two consecutive Anthropic calls with the same system blocks; second should hit cache.",
    "# reduction_pct = (first.input_tokens - second.input_tokens) / first.input_tokens × 100",
    "fixture_id,pass,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,reduction_pct",
    `${fixture.id},${first.pass},${first.input_tokens},${first.output_tokens},${first.cache_read_tokens},${first.cache_write_tokens},`,
    `${fixture.id},${second.pass},${second.input_tokens},${second.output_tokens},${second.cache_read_tokens},${second.cache_write_tokens},${reductionPct.toFixed(2)}`,
  ];
  const csv = csvLines.join("\n") + "\n";
  writeFileSync(cachePath, csv, "utf-8");
  console.log(`\n[cache] Cache CSV written to: ${cachePath}`);
  console.log(`[cache] Reduction in billed input tokens: ${reductionPct.toFixed(2)}%`);
  console.log(`[cache] Second-pass cache_read_tokens: ${second.cache_read_tokens}`);

  if (!cacheHit) {
    console.error(
      "[cache] ❌ Second pass produced no cache_read_tokens. Cache placement may be wrong.",
    );
    process.exit(2);
  }
  if (reductionPct < 40) {
    console.error(
      `[cache] ❌ Reduction ${reductionPct.toFixed(2)}% < 40% target. ` +
      "Phase 1 cache placement needs rework before Phase 2 ships.",
    );
    process.exit(3);
  }
  console.log("[cache] ✅ Cache reduction crosses 40% target.");
}

// ---------------------------------------------------------------------------
// --mode=adaptive (Phase 2 entry-criterion discharge)
// ---------------------------------------------------------------------------
//
// Routes each fixture through the IntakeController instead of Path A. Records
// per-fixture questions_asked, infer_count, and time-to-finalize. Writes the
// comparison CSV to server/test/baselines/2026-05-02-adaptive.csv.
//
// Pass criterion (plan §Phase 2): median questions_asked across 5 fixtures ≤ 7.
//
// Skips the LLM path when ANTHROPIC_API_KEY is absent (Groq does not match the
// shapes of our adaptive sub-prompts well; routing to Groq would degrade signal).
// In skip mode we still write a sentinel row so the report can cite the deferral.
// ---------------------------------------------------------------------------
async function evalAdaptive(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const adaptivePath = join(__dirname, "baselines/2026-05-02-adaptive.csv");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[adaptive-eval] ANTHROPIC_API_KEY not set — IntakeController sub-prompts run on Haiku-tier; " +
      "skipping live run with sentinel CSV row.",
    );
    const sentinel = [
      "# Phase 2 adaptive intake eval — 2026-05-02",
      "# DEFERRED: ANTHROPIC_API_KEY not set in env at run time. [CLEANUP] tracking.",
      "# When run live the script routes each fixture through IntakeController.nextStep+ingestAnswer until done.",
      "fixture_id,archetype,questions_asked,infer_count,time_to_finalize_ms,total_cost_usd,result",
      ...SAMPLE_PRODUCTS.map((p) => `${p.id},${p.archetype},0,0,0,0.000000,deferred`),
    ].join("\n") + "\n";
    writeFileSync(adaptivePath, sentinel, "utf-8");
    console.log(`[adaptive-eval] Sentinel written to: ${adaptivePath}`);
    return;
  }

  // Lazy imports — keep top-level eval path lean.
  const {
    nextStep,
    ingestAnswer,
    finalize,
    hydrateProductState,
    hydrateSpec,
  } = await import("../services/intake-controller.js");

  console.log("[adaptive-eval] Starting Phase 2 adaptive intake eval...");
  const rows: Array<{
    fixture_id: string;
    archetype: string;
    questions_asked: number;
    infer_count: number;
    time_to_finalize_ms: number;
    total_cost_usd: string;
    result: string;
  }> = [];

  for (const fixture of SAMPLE_PRODUCTS) {
    console.log(`\n[adaptive-eval] Fixture: ${fixture.id} (${fixture.label})`);
    const startedAt = Date.now();
    const projectId = `eval-${fixture.id}`;

    let productState = hydrateProductState(null);
    const spec = hydrateSpec(null, `spec-${projectId}`, fixture.label, fixture.initialIdea);
    let history: Array<{ step: number; method?: string | null; question: string; answer: string | null }> = [];
    let questionsAsked = 0;
    let inferCount = 0;
    let result = "ok";
    const simulatedAnswers = [...fixture.simulatedDiscoveryAnswers];

    // Walk up to 9 nextStep iterations (matches MAX_INTAKE_STEPS in the controller).
    for (let i = 0; i < 9; i++) {
      const action = await nextStep({ productState, spec, history });
      if (action.action === "done") {
        console.log(`  [adaptive-eval] DONE after ${questionsAsked} questions (${action.reason})`);
        break;
      }
      if (action.action === "infer") {
        inferCount += action.defaults.length;
        console.log(`  [adaptive-eval] INFER: ${action.defaults.length} defaults`);
        // After an infer step, the controller has nothing left to ask.
        // In real UX the user might challenge an assumption; the eval treats infer as terminal.
        break;
      }
      // ASK → simulate the user answering with the next pre-baked discovery line, or a chip.
      const nextSimulated = simulatedAnswers.shift() ?? action.question.chips[0] ?? "OK";
      questionsAsked++;
      console.log(`  [adaptive-eval] ASK ${questionsAsked} (${action.method}): ${action.question.text.slice(0, 60)}...`);
      console.log(`    [adaptive-eval] simulated answer: ${nextSimulated.slice(0, 50)}...`);
      const ingest = ingestAnswer({
        state: productState,
        answer: {
          projectId,
          step: questionsAsked,
          questionText: action.question.text,
          answer: nextSimulated,
          method: action.method,
        },
      });
      productState = ingest.productState;
      history = [...history, { step: questionsAsked, method: action.method, question: action.question.text, answer: nextSimulated }];
    }

    // Finalize → render brief.
    try {
      const final = finalize({ projectId, productName: fixture.label, productDescription: fixture.initialIdea, productState });
      if (!final.spec || !final.renderedMarkdown) result = "fail-finalize";
    } catch {
      result = "fail-finalize";
    }

    const elapsed = Date.now() - startedAt;
    rows.push({
      fixture_id: fixture.id,
      archetype: fixture.archetype,
      questions_asked: questionsAsked,
      infer_count: inferCount,
      time_to_finalize_ms: elapsed,
      total_cost_usd: "0.000000", // cost recorded server-side via llm_calls; not summed here
      result,
    });
    console.log(`  [adaptive-eval] Done: ${fixture.id} — ${questionsAsked} questions, ${inferCount} inferred, ${elapsed}ms`);
  }

  const csv = [
    "# Phase 2 adaptive intake eval — 2026-05-02",
    "# Median questions_asked across 5 fixtures must be ≤ 7 for Phase 2 to ship.",
    "fixture_id,archetype,questions_asked,infer_count,time_to_finalize_ms,total_cost_usd,result",
    ...rows.map((r) =>
      [r.fixture_id, r.archetype, r.questions_asked, r.infer_count, r.time_to_finalize_ms, r.total_cost_usd, r.result].join(","),
    ),
  ].join("\n") + "\n";
  writeFileSync(adaptivePath, csv, "utf-8");
  console.log(`\n[adaptive-eval] CSV written to: ${adaptivePath}`);

  // Median + pass/fail summary.
  const sorted = [...rows.map((r) => r.questions_asked)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`[adaptive-eval] Median questions_asked = ${median} (target ≤ 7)`);
  if (median > 7) {
    console.error("[adaptive-eval] ❌ Median exceeds 7 — Phase 2 needs another iteration before ship.");
    process.exit(4);
  }
  console.log("[adaptive-eval] ✅ Median crosses ≤ 7 target.");
}

const argv = process.argv.slice(2);
if (argv.includes("--measure-cache")) {
  measureCache().catch((err) => {
    console.error("[cache] Fatal error:", err);
    process.exit(1);
  });
} else if (argv.includes("--mode=adaptive")) {
  evalAdaptive().catch((err) => {
    console.error("[adaptive-eval] Fatal error:", err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error("[eval] Fatal error:", err);
    process.exit(1);
  });
}
