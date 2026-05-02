# ProductPilot — Adaptive Intake & Structured Spec Generation

**Status:** ready-for-execution
**Owner:** tyroneross
**Created:** 2026-05-02
**Branch base:** `admin-redesign` (or current working branch)

---

## Context

ProductPilot today maintains three overlapping intake paths (discovery+survey, minimum-details form, free-form per-stage chat) and emits prose-only Markdown specs. Both facts cost the user input volume *and* output quality: users re-enter context, the agent treats every unknown as equally blocking, and downstream coding agents (Claude Code, Cursor) receive prose without traceability. This plan replaces the three paths with a single adaptive intake controller, makes a structured `Spec` object the source of truth, and gates export on a deterministic linter. The goal is **fewer user inputs and better coding-agent handoff**, validated by an offline eval harness against today's baseline.

## Reference materials (read before starting)

- **Methodology base:** `docs/research/llm-product-development-template-pack.md` — handoff-doc set, decision frameworks (JTBD/QFD/Pugh/TRIZ/etc.), inference pipeline, scoring rubric. Symlink → `~/dev/research/topics/product-dev/product-dev.llm-product-development-template-pack.md`.
- **Repo-grounded analysis:** `docs/research/productpilot-adaptive-intake-and-spec-generation.md` — three-part Perplexity analysis covering the enhancement plan, agent architecture options, and recommendations summary. Treat as design vocabulary; this plan diverges where noted (see "Decisions and rationale").
- **Existing implementation plan, related:** `docs/superpowers/plans/2026-03-29-neon-auth-llm-settings.md` — older auth+LLM plan; do not regress its outcomes.

## Outcome (definition of "done" for the whole plan)

1. New projects route through an adaptive intake controller asking 3–7 high-leverage questions (median target).
2. Doc generation emits a structured `Spec` JSON object first, renders Markdown from it second; `spec_artifacts` table is populated; `traceMatrix` links every P0 Need → Feature → Test/ADR.
3. A deterministic + Haiku-tier spec linter blocks export when P0 Needs lack acceptance tests, when DataPoints flagged `pii=true` lack handling notes, or when low-reversibility decisions lack ADRs. Severity tiers (`block | warn | info`) and waiver-with-reason from day one.
4. Existing projects on `intakeMode='survey'` or `'minimum'` continue to work unchanged.
5. Anthropic prompt-cache breakpoints reduce repeat-stage-generation input tokens by ≥40% measured.
6. Eval harness CSV shows the new path produces ≤ baseline question count *and* ≥ baseline traceability score across all 5 fixture products.
7. Vitest scaffold landed; ~30 unit tests covering intake controller, spec linter, prompt builders, route auth, and RLS on new tables.

## Assumptions

- **A1:** `aiService.generateStructuredOutput` in `server/services/ai.ts` already works against Anthropic with tool-use mode for typed JSON. Phase 1 validates this on the `Spec` schema; if first-pass success <95%, add retry + stricter schema reminder + markdown fallback.
- **A2:** Anthropic prompt-caching with `cache_control: {type: "ephemeral"}` reduces repeated-prefix input tokens 40–80% in our shape. Source claimed 60–80%; we set the gate at ≥40% to avoid over-promising.
- **A3:** Better Auth + Postgres RLS already provide tenant isolation at the row level. New tables (`intake_questions`, `spec_artifacts`) inherit the same policy pattern; no new auth surface.
- **A4:** Three methods (JTBD, lightweight QFD, Pugh) cover ≥90% of intake situations. Adding more is deferred until eval data shows measurable gaps.
- **A5:** ProductPilot's repo has zero existing `.test.ts`/`.spec.ts` files. Vitest scaffold is itself a deliverable; no existing test command can be relied on.
- **A6:** Stack is Vite+React+Express+Drizzle+Postgres+Better Auth+Pino+Anthropic SDK+Groq SDK, deployed to Vercel via `api/index.mjs`. Verified by reading `package.json` and migrations on 2026-05-02.

## Decisions and rationale

| Decision | Rationale |
|---|---|
| Eval harness as **Phase 0**, not Phase 7 | Without baseline numbers, "fewer questions / better output" is a vibe. ~1 day cost; sets the bar every later phase compares against. |
| **Structured `Spec` object as source of truth**; Markdown rendered from it | Single biggest accuracy lever. Enables deterministic linting (`every Need has ≥1 Test`) instead of LLM-judging-LLM. |
| **Deterministic checks first**, Haiku-tier LLM checks second in linter | Cheap pre-filter catches most issues without a model call. LLM call only on remaining fuzzy categories. |
| **3 methods at launch** (JTBD, lightweight QFD, Pugh), not 9 | Empirical 90/10 split; AHP/TOPSIS/DSM/morphological/TRIZ deferred until eval data demands them. Avoids method-theater failure mode. |
| **Severity tiers + waiver-with-reason from day one** | If linter is "always blocking," users learn to bypass the whole flow. Severity prevents that; waiver telemetry tunes precision. |
| **PII handling-note check is non-waivable** | Security stays above UX. Handling note is one sentence; not asking it is a regression vs current Postgres RLS posture. |
| **Tradeoff weights (100-point allocation, Phase 4)** retained from author's plan despite Perplexity's method-router subsuming it | 30 seconds of explicit user input prevents silent architecture choices the user never authorized. |
| **12-specialist-agent architecture (Perplexity addendum) rejected** | Coordination overhead + method-theater risk outweighs benefit at v0. Perplexity's own recommendations summary walks this back to 5 agents. |
| **Vitest scaffold during Phase 1, not Phase 7** | Repo has zero tests; refactoring this much without coverage is high-risk. |
| **Adaptive intake gated by `intakeMode` column with default `'adaptive'` for new projects** | Existing projects unaffected; rollback per-project by flipping the column. |
| **Pin structured-output-critical calls to Anthropic** (not Groq) | Anthropic's tool-use mode for typed JSON is more reliable today; existing task-router supports the distinction. |
| **Phase 0 fixtures are synthetic** (not real product ideas pulled from prod) | Privacy + IP hygiene; prod data may not be license-clean for fixture commit. |

## Security considerations (cross-cutting)

These apply to every phase. The build-orchestrator must surface any phase that violates them.

| Area | Concern | Required control |
|---|---|---|
| New `productState` jsonb column | LLM working memory may contain user-pasted PII | Inherit RLS from `projects`; never log full state to `audit_events` (log size + hash only) |
| `intake_questions` table | Stores user answers verbatim | Same RLS; admin telemetry views must redact answer_text the same way `messages` already are |
| `spec_artifacts` table | Stores derived data including PII flags | Same RLS; linter elevates `kind='data'` items with `payload.pii=true` to non-waivable block |
| Anthropic prompt-cache breakpoints | Cache content is per-API-key (correct) but breakpoint placement could leak cross-stage context | Place breakpoints **after** `buildProjectContext` (already tenant-scoped) — never before |
| Method-router + scorer + inferer LLM calls | Each call ships partial productState to provider | Strip secret-shaped strings server-side before any provider call (extend existing `secret-crypto.ts` denylist patterns); add unit test for redaction |
| Spec linter Haiku calls | Same as above | Same denylist control; lint output must not echo secrets even if input contained them |
| Coding-agent handoff export | Generated Markdown may inline unredacted user content | Linter rule: if any DataPoint has `pii=true` and no `handlingNote`, export is **blocked, non-waivable** |
| `intakeMode` column transitions | Mode flip could bypass new security checks | Server-side enum check; `audit_events` row written on every transition |
| BYOK API keys in `user_settings` | Already encrypted via `secret-crypto.ts` | New code paths must route BYOK through the same helper. Never read encrypted columns directly. |
| Phase 0 eval fixtures | Could inadvertently include copyrighted/proprietary product ideas | Fixtures must be synthetic; provenance documented in fixture file |
| Vitest scaffold | New dev dependency surface | Pin Vitest at a current stable version; verify no peer-dep audit warnings |
| New routes | `/intake/*` and `/spec/lint` and `/handoff.md` | Mount under existing auth middleware; integration test asserts unauthenticated request returns 401, cross-tenant request returns 403 |

## Cross-cutting requirements

### PRD-Builder integration (added 2026-05-02)

The Stage 1 Brief shape and several linter rules below adopt the `prd-builder` skill methodology from `~/dev/git-folder/RossLabs-AI-Toolkit/skills/prd-builder/SKILL.md`. Intent: ensure the Stage 1 Brief is a *generative model* an LLM can derive tactical decisions from, not a field-list a human has to interpret.

**Phase 1 additions:**
- Stage 1 Brief prompt is a literal port of PRD-Builder Q1–Q3:
  - **Q1: Persona + Trigger** with explicit "Who they are NOT" exclusions (3–7 bullets).
  - **Q2: Outcome** — one measurable change with an N-week timeline ("After [N weeks] of [usage pattern], the user [measurable change]").
  - **Q3: Stance** — three "because"-clause sentences covering Privacy/Data, Complexity, Cost. Optional fourth for category (regulatory / moderation / hallucination tolerance).
- New `productState` fields:
  - `stanceBecauseClauses` — three (or four) qualitative "because" clauses from Q3.
  - `pivotLog` — strategic-decision-history that survives `messages.version` regenerations.
- Generated Brief includes a "Reading guide" section with explicit `For humans:` / `For LLM agents:` sub-paragraphs and a decision-routing table per PRD-Builder §"Reading guide".

**Phase 3 additions (linter rules):**
- Every stance entry must carry a non-empty `because` clause; blank → `TAG:UNRESOLVED` blocker (waivable with reason).
- Every non-goal in the Spec must carry a `because` clause; blank → blocker.
- **Stage 1 Fidelity Check** — deterministically predict 8 tactical answers (per PRD-Builder §"Fidelity check": speed-vs-accuracy, complexity-vs-simplify, single-metric-vs-many, accept-off-persona-feature-request, fail-loudly-vs-degrade, on-device-vs-cloud, opinionated-vs-open-onboarding, copy-competitor-feature) from the Brief alone. <6/8 derivable → blocker for advancing to Stage 2.

**Phase 4 augmentation:**
- Tradeoff weights (numeric, 100-point) are *augmented* by stance "because" clauses (qualitative, from Q3). Both feed the Architecture stage prompt: weights drive priority, "because" clauses drive philosophy. They are not interchangeable. The architecture rationale must cite both.

### Prompt-builder gate (added 2026-05-02)

Every prompt module added to `shared/prompts/` during Phases 1–5 must pass through the `prompt-builder` plugin (`/prompt-builder:optimize` or, at minimum, `/prompt-builder:score`) before the phase that introduces it is considered complete. The optimized output is the version that ships; the review history is captured in the prompt module's frontmatter:

```yaml
---
key: <prompt-id>
version: <module-version>
prompt_builder_score: <0–100>
prompt_builder_revision: <count>
prompt_builder_run_at: <YYYY-MM-DD>
---
```

Rationale: the plan touches at minimum 8 distinct prompt modules (discovery, intake controller, blocking scorer, safe-defaults inferer, three method modules, spec linter, doc generator). Hand-rolled prompts at that scale drift; a single shared optimization pass keeps quality consistent and audit-friendly.

Out of scope for this gate: the existing strings in `shared/prompt-content.ts` that Phase 1 is going to replace anyway. Don't optimize prompts about to be deleted.

---

## Phases

### Phase 0 — Eval harness (1 day, prerequisite)

**Intent:** Establish a measurable baseline before any product-facing change.

**Steps:**
1. Author 5 synthetic product-idea fixtures in `server/test/fixtures/sample-products.ts` covering: clear B2B SaaS, fuzzy consumer app, internal workflow tool, AI automation product, data-heavy dashboard.
2. Create `pnpm eval:intake` script (`server/test/eval-intake.ts`) that runs each fixture through current Path A (discovery → survey → docs).
3. Capture per-run metrics into a CSV: `idea_id, questions_asked, time_to_brief_ms, total_cost_usd, doc_word_count, traceability_gaps_manual, lint_issues_simulated`.
4. Commit one baseline snapshot as `server/test/baselines/2026-05-02.csv`. Subsequent runs go to `server/test/eval-runs/` (gitignored).

**Outcome:**
- Baseline CSV committed.
- Documented current cost-per-spec and question-count-per-spec.

**Checks:**
- Script runs end-to-end against an Anthropic key from env (read via existing `secret-crypto.ts` flow if BYOK; otherwise from `ANTHROPIC_API_KEY` env).
- All 5 fixtures produce output; no fixture crashes.
- Cost numbers reconcile with `llm_calls` table totals for the run.

**Security gates:**
- Fixtures reviewed for synthetic-only content.
- Eval script reads keys from env, never logs the raw key.
- No production data in eval; test database only.

---

### Phase 1 — Structured spec foundation (3–4 days)

**Intent:** Make every later phase possible — without typed Spec emission and traceable IDs, neither linter nor adaptive intake delivers value.

**Steps:**
1. Add migration `migrations/0003_adaptive_intake.sql`: new columns on `projects` (`product_state jsonb`, `trace_matrix jsonb`, `intake_mode text default 'adaptive'`); new tables `intake_questions`, `spec_artifacts`. Mirror the RLS policy pattern from `migrations/0002_rls_policies_and_cross_schema_fks.sql`.
2. Add Drizzle table definitions and Zod schemas in `shared/schema.ts` for `Spec`, `Need`, `Feature`, `Persona`, `DataPoint`, `UXNode`, `Test`, `ADR`, `Assumption`, `Risk`, `ProductState`, `LintIssue`, `TraceMatrix`.
3. Refactor `server/prompt-builders.ts` `buildDocumentGenerationPrompt` to demand structured JSON output via `aiService.generateStructuredOutput`. Add `server/services/spec-renderer.ts` to convert Spec → Markdown per stage.
4. Insert Anthropic `cache_control: {type: "ephemeral"}` markers at stable prefix boundaries (project context, brief, PRD). Place **after** `buildProjectContext`.
5. Bootstrap Vitest: add `vitest.config.ts`, `package.json` scripts (`test`, `test:watch`), and `server/test/setup.ts`. Land 5 unit tests: schema validation, render-Spec-to-Markdown, cache-breakpoint placement, structured-output retry, RLS policy on new tables.

**Outcome:**
- Doc generation emits Spec object first, Markdown second, populated into `spec_artifacts`, rendered identically to today's UI.
- Cache hits visible in `llm_calls` token-counts on re-runs.
- 5 passing Vitest tests.

**Checks:**
- Migration runs idempotently on fresh and existing test databases.
- Round-trip generated Spec → Markdown matches today's shape (no UI regression).
- Re-run stage generation shows ≥40% reduced input tokens (cache hit).
- Integration test: cross-tenant SELECT on `spec_artifacts` returns 0 rows.

**Security gates:**
- New tables enforce RLS; integration test verifies cross-tenant blocking.
- Cache breakpoints placed only after tenant-scoped context.
- Sensitive DataPoints flagged via `payload.pii=true` and surfaced to linter (Phase 3 enforces).

---

### Phase 2 — Adaptive intake behind a flag (3–4 days)

**Intent:** Reduce user input volume — the explicit user goal.

**Steps:**
1. Implement `server/services/intake-controller.ts` exporting `nextStep`, `ingestAnswer`, `finalize`. Three methods: JTBD, lightweight QFD, Pugh. Simpler 3-axis blocking-score (evidence + reversibility + risk) — not the 4-axis variant.
2. Add routes `/api/projects/:id/intake/{next,answer,finalize}` in `server/routes.ts`.
3. Build `client/src/components/adaptive-intake.tsx`: single-question UI, chip suggestions reusing existing `DISCOVERY_INITIAL_PROMPT` chip convention, inferred-assumptions panel with per-assumption "challenge" button.
4. Gate by `intake_mode === 'adaptive'`; new projects default to adaptive; existing projects keep their mode.
5. Re-run Phase 0 eval against new path; commit comparison snapshot.

**Outcome:**
- New projects ask 3–7 questions (median target ≤5) instead of 6+ chat turns + 6-question survey.
- Inferred assumptions visible with confidence labels and challenge UI.
- Eval CSV shows side-by-side comparison vs Phase 0 baseline.

**Checks:**
- Five fixture runs through new flow: median questions asked ≤7, p95 ≤10.
- Generated brief on each fixture matches user intent within manual-review tolerance.
- Existing projects on `intake_mode='survey'` or `'minimum'` unchanged (regression smoke).
- Audit event written on every `intake_mode` change.

**Security gates:**
- `IntakeController` strips secret-shaped strings from `productState` before any provider call.
- `intake_questions.answer_text` redacted in admin telemetry views.
- Method router cannot read or write outside calling project's RLS scope (test).

---

### Phase 3 — Spec linter + waiver (2 days)

**Intent:** Catch spec gaps that would make coding-agent handoff fail.

**Steps:**
1. Implement `server/services/spec-linter.ts`. **Deterministic checks first:** every Need has ≥1 Test, every P0 Feature has acceptance criteria, every DataPoint with `pii=true` has `handlingNote`, every low-reversibility decision has an ADR. **Haiku-tier LLM checks second:** ambiguous language, unresolved contradictions.
2. Severity tiers: `block`, `warn`, `info`. Only `block` prevents export.
3. Waiver path: most `block` issues can be waived with a written reason; `pii=true` without handling note is **non-waivable**. Waiver logged to `audit_events` with user id, issue id, reason text.
4. New endpoint `POST /api/projects/:id/spec/lint` returns `{issues: LintIssue[]}`.
5. UI: lint issues inline on document view; "publish" disabled until 0 unwaived blockers.

**Outcome:**
- Specs cannot be exported with P0 Need lacking acceptance test (or waiver with reason).
- Waiver rate per category visible in admin panel.

**Checks:**
- Fixture suite of handcrafted broken specs triggers expected lint categories.
- Waiver flow records reason + user; recoverable from `audit_events`.
- Linter completes in <2s for typical-size specs (Haiku call dominates; 1 retry budget).
- PII non-waivable rule cannot be bypassed (test).

**Security gates:**
- Linter LLM calls scrub same secret-shaped strings as Phase 2.
- Waiver reasons sanitized before rendering in admin views.
- PII non-waivable enforced at server-side, not just UI.

---

### Phase 4 — Tradeoff-weight allocation (1 day)

**Intent:** Force tradeoffs explicit so architecture choices have a basis the user authorized.

**Steps:**
1. Add 30-second 100-point allocation step at end of intake: weights for `speed_to_alpha`, `scalability`, `ux_polish`, `maintainability`, `cost`, `security`. Plus one "unacceptable tradeoff" choice.
2. Persist to `productState.tradeoffWeights`.
3. Architecture-stage prompt and linter both consume the weights. Architecture recommendations must cite weights ("chose monolith because user weighted speed_to_alpha=0.35").

**Outcome:**
- Architecture recommendations cite the user's weight allocation.
- Linter flags architecture decisions inconsistent with the weights.

**Checks:**
- Total = 100 enforced UI-side and server-side (test).
- Architecture spec for the same product idea differs measurably between weight profiles in fixture eval.

**Security gates:** minimal — non-sensitive metadata.

---

### Phase 5 — Coding-agent handoff export (1 day)

**Intent:** Produce the artifact the whole flow exists to deliver.

**Steps:**
1. `server/services/agent-handoff.ts` aggregates Stage 4 + Stage 5 + ADRs + tests.
2. Output is Markdown with explicit ID references, ask-before policy enumeration, prompt-cache-friendly section ordering.
3. New endpoint `GET /api/projects/:id/handoff.md`.
4. UI: "Copy for Claude Code / Cursor" button on documents page.
5. Export blocked if linter has unwaived blockers or any non-waivable PII issue.

**Outcome:**
- Single `agent-handoff.md` paste-ready into Claude Code / Cursor / Codex.
- Export gated on lint cleanliness.

**Checks:**
- Generated handoff parses cleanly when pasted into a coding-agent UI (manual smoke).
- Five fixture handoffs reviewed manually for completeness; all reference ADRs by ID.
- Export attempt with unwaived blocker fails with clear message.

**Security gates:**
- Handoff includes ask-before enumeration: storing regulated data, paid services, distributed services, removing P0, irreversible architecture with low confidence.
- DataPoints with `pii=true` listed with handling notes; absent handling note → unwaivable block from Phase 3.

---

### Phase 6 — Method depth, deferred (3+ days)

**Intent:** Add Morphological + TRIZ + Weighted Scoring + ADR-as-method only when eval data shows the 3-method version leaves measurable gaps.

**Trigger:** Phase 0 eval re-run after Phase 5 ships shows >20% of fixtures produce specs flagged as "method mismatch" by manual review.

**Outcome:** 7 methods online; AHP / TOPSIS / DSM remain deferred.

---

### Phase 7 — Test depth, ongoing

**Intent:** Bring zero-test repo to ~30 high-value tests over Phases 1–5.

**Steps:** interleave test additions with each phase's PR. By end of Phase 5: ~30 tests covering intake controller, spec linter, prompt builders, route auth, RLS policies on new tables, eval-harness CSV diffing.

**Outcome:** Refactors after Phase 5 land with regression coverage.

---

## Open questions / risks

| Item | Resolution |
|---|---|
| Does `aiService.generateStructuredOutput` reliably emit valid JSON for our Spec schema? | Validate in Phase 1; if <95% first-pass success, add retry + schema-reminder + Markdown fallback. |
| Does Anthropic prompt-caching deliver the 40–80% reduction in our usage shape? | Measure on 10 fixture re-runs in Phase 1. If <40%, re-evaluate breakpoint placement. |
| Will users override severity tiers and waive everything? | Track waiver rate per category in Phase 3. If any category waives >50%, that lint rule is wrong and gets revised, not the user. |
| Is "challenge assumption" UX something users actually use? | Track click-through telemetry in Phase 2; if <5% engagement, the panel is decoration and we should reduce it. |
| BYOK + new code paths — does any new call read encrypted secrets directly? | Phase 1 + 2 must include grep guard in CI for direct reads of encrypted columns. |

## Definition of "iteration complete"

For build-orchestrator: a phase is **complete** when:
1. Steps in the phase have been implemented.
2. All "Checks" listed pass (run them; cite output in completion report).
3. All "Security gates" pass (cite verification, not just "implemented").
4. Phase 0 eval re-run shows no regression vs prior baseline (only required after Phase 2 onward).
5. Vitest test suite is green.
6. Type-check (`npm run check`) passes.
7. No new TODO/FIXME without `[CLEANUP]` task entry.
8. Every new prompt module added under `shared/prompts/` in this phase has been run through `/prompt-builder:optimize` (or `:score`); the score is recorded in the module's frontmatter (`prompt_builder_score`, `prompt_builder_revision`, `prompt_builder_run_at`).
9. Every Stage-1 Brief generation in fixtures derives ≥6/8 tactical answers in the Fidelity Check (deterministic test) once Phase 3 lands.

## Out of scope (do not expand)

- Real-time collaboration features.
- Marketplace/community templates for archetypes.
- Internationalization of intake prompts (English only for v0).
- Mobile-specific intake UI (desktop web only for v0).
- Third-party integrations beyond existing Anthropic + Groq.
- Migration of existing prose-only specs into structured Spec — new generations only.

## Rollback per phase

| Phase | Rollback |
|---|---|
| 0 | Delete fixtures + script; no DB or app surface added. |
| 1 | Migration is additive; revert app-code changes via git; new columns/tables can stay (NULL on existing rows is safe). |
| 2 | Set `intake_mode='survey'` for affected projects; old discovery+survey flow still wired. |
| 3 | Disable lint endpoint; export proceeds as before. |
| 4 | Tradeoff weights default to NULL; architecture stage falls back to Phase 1 behavior. |
| 5 | Disable handoff export endpoint; users continue to copy individual stage outputs. |

## Order-of-execution recommendation

Sequential — each phase depends on the prior. Within a phase, parallelize where safe (e.g., Phase 1 schema + Zod work can land in one PR, prompt refactor in a second PR same day).
