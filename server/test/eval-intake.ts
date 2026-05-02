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

main().catch((err) => {
  console.error("[eval] Fatal error:", err);
  process.exit(1);
});
