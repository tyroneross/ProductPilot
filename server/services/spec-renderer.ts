/**
 * Spec → Markdown rendering. Pure functions. No LLM calls, no DB calls.
 *
 * Doc generation produces a Spec JSON object first (via aiService.generateStructuredOutput
 * against SpecSchema) and renders Markdown from it second. The renderer is
 * the boundary that keeps today's UI shape backward-compatible while the
 * underlying source of truth becomes structured.
 *
 * Each render function takes a Spec + a project-context string (the same
 * tenant-scoped context buildProjectContext produces) and returns Markdown.
 *
 * Design notes:
 *   - Stage-specific renderers are NOT a 1:1 of every Spec field. The Brief
 *     intentionally omits dataPoints and APIs (those belong to Stage 4).
 *   - The Brief's "Reading guide" section is a literal port of the
 *     PRD-Builder methodology — humans + LLM agents both read it, and the
 *     decision-routing table is what makes the Phase 3 Fidelity Check possible.
 *   - All renderers return one trailing newline. No surrounding whitespace
 *     trimming so the caller can compose without surprise.
 */

import type {
  Spec,
  Persona,
  Scenario,
  Need,
  Feature,
  StanceBecauseClause,
  NonGoal,
  DataPoint,
  APIContract,
  Test,
  ADR,
  Assumption,
  Risk,
  ProductState,
  UXFlow,
  Screen,
  Integration,
} from "@shared/schema";

// ── shared helpers ───────────────────────────────────────────────────────

function bullet(line: string | undefined | null): string {
  if (!line) return "";
  return `- ${line}`;
}

function joinNonEmpty(parts: Array<string | undefined | null>, sep = "\n"): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

function heading(level: 1 | 2 | 3 | 4, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function renderPersonas(personas: Persona[]): string {
  if (!personas.length) return "_No personas captured yet._";
  return personas
    .map((p) => {
      const lines = [heading(3, p.name)];
      if (p.trigger) lines.push(`**Trigger:** ${p.trigger}`);
      if (p.exclusions.length) {
        lines.push("\n**Who they are NOT:**");
        for (const e of p.exclusions) lines.push(bullet(e));
      }
      if (p.jobs.length) {
        lines.push("\n**Jobs to be done:**");
        for (const j of p.jobs) lines.push(bullet(j));
      }
      return joinNonEmpty(lines);
    })
    .join("\n\n");
}

function renderScenarios(scenarios: Scenario[]): string {
  if (!scenarios.length) return "_No outcome scenarios captured yet._";
  return scenarios
    .map((s) => {
      const lines = [
        s.context ? `**Context:** ${s.context}` : null,
        `**Goal:** ${s.goal}`,
        s.successSignal ? `**Success signal:** ${s.successSignal}` : null,
      ];
      return joinNonEmpty(lines);
    })
    .join("\n\n");
}

function renderStance(clauses: StanceBecauseClause[]): string {
  if (!clauses.length) return "_No stance captured yet._";
  return clauses
    .map((c) => {
      const label = c.category.replace(/_/g, " ");
      return `**${label}:** ${c.stance}\n_Because:_ ${c.because}`;
    })
    .join("\n\n");
}

function renderNonGoals(nonGoals: NonGoal[]): string {
  if (!nonGoals.length) return "_None._";
  return nonGoals
    .map((n) => {
      const because = n.because ? ` _Because:_ ${n.because}` : "";
      return `- ${n.text}${because}`;
    })
    .join("\n");
}

function renderNeeds(needs: Need[]): string {
  if (!needs.length) return "_None._";
  return needs
    .map((n) => {
      const pri = n.priority ? `[${n.priority}] ` : "";
      const desc = n.description ? ` — ${n.description}` : "";
      return `- **${n.id}** ${pri}${n.title}${desc}`;
    })
    .join("\n");
}

function renderFeatures(features: Feature[]): string {
  if (!features.length) return "_None._";
  return features
    .map((f) => {
      const pri = f.priority ? `[${f.priority}] ` : "";
      const ac = f.acceptanceCriteria.length
        ? `\n  - Acceptance:\n${f.acceptanceCriteria.map((c) => `    - ${c}`).join("\n")}`
        : "";
      const refs = f.needIds.length ? ` (serves ${f.needIds.join(", ")})` : "";
      return `- **${f.id}** ${pri}${f.title}${refs}${ac}`;
    })
    .join("\n");
}

function renderUXFlows(flows: UXFlow[]): string {
  if (!flows.length) return "_None._";
  return flows
    .map((f) => {
      const steps = f.steps.length ? f.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n") : "  _No steps captured._";
      const screens = f.screenIds.length ? `  - Screens: ${f.screenIds.join(", ")}` : "";
      return joinNonEmpty([`### ${f.name} _(${f.id})_`, steps, screens]);
    })
    .join("\n\n");
}

function renderScreens(screens: Screen[]): string {
  if (!screens.length) return "_None._";
  return screens
    .map((s) => {
      const states = s.states.length ? `  - States: ${s.states.join(", ")}` : "";
      const primary = s.primaryAction ? `  - Primary action: ${s.primaryAction}` : "";
      return joinNonEmpty([`- **${s.id}** ${s.name} — ${s.purpose}`, primary, states]);
    })
    .join("\n");
}

function renderDataPoints(points: DataPoint[]): string {
  if (!points.length) return "_None._";
  return points
    .map((d) => {
      const piiTag = d.pii ? " **(PII)**" : "";
      const note = d.handlingNote ? `\n  - Handling: ${d.handlingNote}` : d.pii ? "\n  - Handling: TAG:UNRESOLVED — handlingNote required for pii=true" : "";
      const desc = d.description ? ` — ${d.description}` : "";
      return `- **${d.id}** ${d.name} \`${d.type}\`${piiTag}${desc}${note}`;
    })
    .join("\n");
}

function renderIntegrations(items: Integration[]): string {
  if (!items.length) return "_None._";
  return items
    .map((i) => `- **${i.id}** ${i.name} — ${i.purpose}${i.authMode ? ` (auth: ${i.authMode})` : ""}`)
    .join("\n");
}

function renderAPIs(apis: APIContract[]): string {
  if (!apis.length) return "_None._";
  return apis
    .map((a) => {
      const lines = [`#### \`${a.method} ${a.path}\` _(${a.id})_`];
      if (a.description) lines.push(a.description);
      if (a.requestSchema) lines.push(`**Request:**\n\`\`\`\n${a.requestSchema}\n\`\`\``);
      if (a.responseSchema) lines.push(`**Response:**\n\`\`\`\n${a.responseSchema}\n\`\`\``);
      if (a.featureIds.length) lines.push(`_Serves features: ${a.featureIds.join(", ")}_`);
      return joinNonEmpty(lines);
    })
    .join("\n\n");
}

function renderTests(tests: Test[]): string {
  if (!tests.length) return "_None._";
  return tests
    .map((t) => {
      const refs = t.needIds.length || t.featureIds.length
        ? ` _(covers: ${[...t.needIds, ...t.featureIds].join(", ")})_`
        : "";
      return `- **${t.id}** [${t.kind}] ${t.description}${refs}`;
    })
    .join("\n");
}

function renderADRs(adrs: ADR[]): string {
  if (!adrs.length) return "_None._";
  return adrs
    .map((a) => {
      const lines = [
        `### ${a.id} — ${a.title}`,
        `**Reversibility:** ${a.reversibility}`,
        `**Context:** ${a.context}`,
        `**Decision:** ${a.decision}`,
        a.consequences ? `**Consequences:** ${a.consequences}` : null,
        a.cites.length ? `**Cites:** ${a.cites.join(", ")}` : null,
      ];
      return joinNonEmpty(lines);
    })
    .join("\n\n");
}

function renderAssumptions(items: Assumption[]): string {
  if (!items.length) return "_None._";
  return items.map((a) => `- _(${a.confidence})_ ${a.text}`).join("\n");
}

function renderRisks(items: Risk[]): string {
  if (!items.length) return "_None._";
  return items
    .map((r) => {
      const mit = r.mitigation ? ` Mitigation: ${r.mitigation}` : "";
      return `- _(L:${r.likelihood} I:${r.impact})_ ${r.text}.${mit}`;
    })
    .join("\n");
}

// ── stage renderers ──────────────────────────────────────────────────────

/**
 * Stage 1 Brief — the strategic foundation.
 *
 * Includes the PRD-Builder "Reading guide" section: explicit For-humans /
 * For-LLM-agents subsections plus a decision-routing table that makes the
 * Phase 3 Fidelity Check tractable (8 tactical answers derivable from the Brief).
 */
export function renderBrief(spec: Spec, productState?: ProductState | null, projectContext?: string): string {
  const parts: string[] = [
    heading(1, `Brief — ${spec.productName}`),
    "",
    spec.productDescription || "_No description._",
    "",
    heading(2, "Reading guide"),
    "",
    "**For humans:** Read top-to-bottom. Skim the persona exclusions and the stance because-clauses; those are the highest-signal sections for scoping.",
    "",
    "**For LLM agents:** This Brief is the ground truth for every later doc and every coding-agent handoff. When asked a tactical question (single-metric vs many, on-device vs cloud, copy a competitor feature), derive the answer from the persona exclusions, the outcome scenario, and the stance because-clauses. If the answer cannot be derived, surface the gap rather than guessing.",
    "",
    heading(3, "Decision-routing table"),
    "",
    "| Question | Section to consult |",
    "|---|---|",
    "| Should this feature exist? | Persona exclusions + stance because-clauses |",
    "| Speed vs accuracy? | Stance — complexity + cost |",
    "| Single metric vs many? | Outcome scenario success-signal |",
    "| Accept off-persona feature request? | Persona exclusions + non-goals |",
    "| Fail loudly vs degrade? | Stance — privacy + category |",
    "| On-device vs cloud? | Stance — privacy + cost |",
    "| Opinionated vs open onboarding? | Stance — complexity |",
    "| Copy competitor feature? | Persona trigger + non-goals |",
    "",
    heading(2, "Q1 — Persona + Trigger"),
    "",
    renderPersonas(spec.personas),
    "",
    heading(2, "Q2 — Outcome"),
    "",
    renderScenarios(spec.scenarios),
    "",
    heading(2, "Q3 — Stance"),
    "",
    renderStance(productState?.stanceBecauseClauses ?? []),
    "",
    heading(2, "Non-goals"),
    "",
    renderNonGoals(spec.nonGoals),
    "",
  ];

  if (spec.assumptions.length) {
    parts.push(heading(2, "Assumptions"), "", renderAssumptions(spec.assumptions), "");
  }
  if (spec.risks.length) {
    parts.push(heading(2, "Risks"), "", renderRisks(spec.risks), "");
  }

  if (projectContext && projectContext.trim()) {
    parts.push(heading(2, "Source context"), "", "<details><summary>Context the agent had at generation time</summary>", "", "```", projectContext.trim(), "```", "", "</details>", "");
  }

  return parts.join("\n");
}

export function renderPRD(spec: Spec, productState?: ProductState | null): string {
  const parts: string[] = [
    heading(1, `PRD — ${spec.productName}`),
    "",
    spec.productDescription || "_No description._",
    "",
    heading(2, "Personas"),
    "",
    renderPersonas(spec.personas),
    "",
    heading(2, "Outcome scenarios"),
    "",
    renderScenarios(spec.scenarios),
    "",
    heading(2, "Stance"),
    "",
    renderStance(productState?.stanceBecauseClauses ?? []),
    "",
    heading(2, "Needs"),
    "",
    renderNeeds(spec.needs),
    "",
    heading(2, "Features"),
    "",
    renderFeatures(spec.features),
    "",
    heading(2, "Non-goals"),
    "",
    renderNonGoals(spec.nonGoals),
    "",
    heading(2, "Assumptions"),
    "",
    renderAssumptions(spec.assumptions),
    "",
    heading(2, "Risks"),
    "",
    renderRisks(spec.risks),
    "",
  ];
  return parts.join("\n");
}

export function renderUxSpec(spec: Spec): string {
  const parts: string[] = [
    heading(1, `UX — ${spec.productName}`),
    "",
    heading(2, "Flows"),
    "",
    renderUXFlows(spec.uxFlows),
    "",
    heading(2, "Screens"),
    "",
    renderScreens(spec.screens),
    "",
    heading(2, "Features touched"),
    "",
    renderFeatures(spec.features),
    "",
  ];
  return parts.join("\n");
}

export function renderFunctionalSpec(spec: Spec): string {
  const parts: string[] = [
    heading(1, `Functional spec — ${spec.productName}`),
    "",
    heading(2, "Data points"),
    "",
    renderDataPoints(spec.dataPoints),
    "",
    heading(2, "Integrations"),
    "",
    renderIntegrations(spec.integrations),
    "",
    heading(2, "API contracts"),
    "",
    renderAPIs(spec.apiContracts),
    "",
    heading(2, "Tests"),
    "",
    renderTests(spec.tests),
    "",
    heading(2, "Architecture decisions"),
    "",
    renderADRs(spec.adrs),
    "",
  ];
  return parts.join("\n");
}

export function renderHandoff(spec: Spec, productState?: ProductState | null): string {
  const lowConfidence = spec.assumptions.filter((a) => a.confidence === "low");
  const askBefore = lowConfidence.length
    ? lowConfidence.map((a) => `- ${a.text}`).join("\n")
    : "_No ask-before items flagged._";

  const parts: string[] = [
    heading(1, `Handoff — ${spec.productName}`),
    "",
    heading(2, "What to ask the user before starting"),
    "",
    askBefore,
    "",
    heading(2, "Brief"),
    "",
    renderBrief(spec, productState).replace(/^# .*\n/, "").trim(),
    "",
    heading(2, "PRD"),
    "",
    renderPRD(spec, productState).replace(/^# .*\n/, "").trim(),
    "",
    heading(2, "UX"),
    "",
    renderUxSpec(spec).replace(/^# .*\n/, "").trim(),
    "",
    heading(2, "Functional"),
    "",
    renderFunctionalSpec(spec).replace(/^# .*\n/, "").trim(),
    "",
  ];
  return parts.join("\n");
}

/**
 * Convenience dispatcher used by the doc-gen flow. Returns the right renderer
 * given a stage kind. Falls back to renderBrief for unknown kinds rather than
 * throwing — the caller has the Spec, which is more useful than a 500.
 */
export function renderSpecForKind(
  kind: "brief" | "prd" | "ux" | "functional" | "handoff" | string,
  spec: Spec,
  productState?: ProductState | null,
  projectContext?: string,
): string {
  switch (kind) {
    case "brief":
      return renderBrief(spec, productState, projectContext);
    case "prd":
      return renderPRD(spec, productState);
    case "ux":
      return renderUxSpec(spec);
    case "functional":
      return renderFunctionalSpec(spec);
    case "handoff":
      return renderHandoff(spec, productState);
    default:
      return renderBrief(spec, productState, projectContext);
  }
}
