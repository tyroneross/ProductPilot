// Canonical intake section map + topic→section mapping + sufficiency types.
//
// SINGLE SOURCE OF TRUTH shared by the server (assessDiscoverySufficiency in
// server/services/intake-controller.ts) and the client (SufficiencyRing,
// IntakeProgressPane). Lifted here from
// client/src/components/intake-progress-pane.tsx so server and client agree on
// the six sections and the topic→section mapping with no drift.
//
// FROZEN CONTRACT — do not edit during the parallel build. Both the codex
// (server) slice and the claude (client) slice import from "@shared/intake-sections".

export const SECTIONS = [
  { key: "brief", short: "Brief", title: "Stage 1 — Brief" },
  { key: "north-star", short: "North Star", title: "Stage 2 — North Star" },
  { key: "ux", short: "UX & Wireframes", title: "Stage 3 — UX & Wireframes" },
  { key: "architecture", short: "Architecture", title: "Stage 4 — Architecture" },
  { key: "coding-prompts", short: "Coding Prompts", title: "Stage 5 — Coding Prompts" },
  { key: "dev-guide", short: "Dev Guide", title: "Stage 6 — Dev Guide" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

/** Map a controller-assigned spec_path or blocking-scorer topic to one of the
 *  six section keys. The intake-controller writes paths like
 *  "personas[0].trigger", "scenarios[0].context", "architecture.persistence",
 *  and blocking topics like "primary_persona_and_trigger", "agent_tool", etc. */
export function specPathToSection(
  specPath: string | null | undefined,
  topic: string | null | undefined,
): SectionKey {
  const haystack = `${specPath ?? ""} ${topic ?? ""}`.toLowerCase();
  if (/persona|trigger|jobs|jtbd|icp|audience/.test(haystack)) return "north-star";
  if (/scenario|need|feature|jtbd/.test(haystack)) return "north-star";
  if (/coding|prompt|test|deploy|agent_evaluation|evaluation|eval|handoff/.test(haystack)) return "coding-prompts";
  if (/screen|uxflow|wireframe|primary.?action|states|ui.?protocol|uiprotocol|ui.?archetype|agent_ui|research_protocol/.test(haystack)) return "ux";
  if (/datapoint|integration|api|adr|pugh|decision|cites|architecture|persistence|tenancy|auth|agent_system|agentsystem|agent_delivery|builder.?scale|agent_autonomy|agent_tool|agent_memory|agent_flow|agent_guardrail|toolcontract|toolcontracts|memorypolicy|guardrail|topology/.test(haystack)) return "architecture";
  if (/devguide|dev-guide|delivery|risk/.test(haystack)) return "dev-guide";
  return "brief";
}

/** Per-section coverage state for the sufficiency meter.
 *  - covered  — a real user answer promotes into this section
 *  - inferred — the controller filled it with an [ASSUMED]/workingMemory value
 *  - open     — no signal yet AND it still carries a blocking unknown */
export type SectionState = "covered" | "inferred" | "open";

export interface SufficiencySection {
  key: SectionKey;
  /** Display label — equals the section's `short`. */
  label: string;
  state: SectionState;
}

/** Returned by GET /api/projects/:id/intake/sufficiency. Sourced from a
 *  self-contained assessment of the discovery conversation. `enough` is the
 *  80/20 gate that unlocks the generate-docs CTA: the high-value sections
 *  (brief + north-star) are not open AND at most two sections remain open. */
export interface IntakeSufficiency {
  sections: SufficiencySection[];
  enough: boolean;
}
