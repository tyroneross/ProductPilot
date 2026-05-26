// Derives a human-meaningful project title from captured intake signal so
// the projects list stops showing "Survey Draft - 10:37:03 AM" for adaptive
// projects that have answered enough questions to name themselves.
//
// Pure (no DB calls, no LLM). Pulls from the same productState that the
// downstream document-generation prompts read, so the title traces back to
// the same data the user already approved.
//
// Selection ladder (first that resolves wins):
//   (a) Persona role + pain hook from spec.personas[0] (when present).
//   (b) ICP role (from intakeAnswers step="icp" / method="jtbd") + pain
//       point (from intakeAnswers step="problem" / method="jtbd").
//   (c) Problem statement alone from minimumDetails.problemStatement.
//   (d) Description (with the leading "[context]" prefix stripped).
//   (e) null — caller falls back to whatever `project.name` already holds.
//
// Output is bounded to MAX_TITLE characters and trimmed; never returns "".

import type { ProductState, Spec } from "@shared/schema";

const MAX_TITLE = 60;

export interface TitleDerivationResult {
  name: string;
  source: "persona_pain" | "icp_pain" | "problem_statement" | "description" | "fallback";
  derivedAt: string;
}

function truncate(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_TITLE) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

// Strip filler phrases that make titles bland ("a tool that lets users", etc.)
function clean(input: string): string {
  return input
    .replace(/^\s*(an?|the|a tool that|a system that|an app that|app that|tool for|tool that)\s+/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

interface IntakeAnswerRow {
  step?: string;
  method?: string | null;
  question?: string;
  answer?: unknown;
  metadata?: Record<string, unknown>;
}

function findAnswer(
  rows: IntakeAnswerRow[],
  predicate: (row: IntakeAnswerRow) => boolean,
): string | null {
  for (const row of rows) {
    if (!predicate(row)) continue;
    const ans = row.answer;
    if (typeof ans === "string" && ans.trim().length >= 3) return clean(ans);
    if (ans && typeof ans === "object") {
      const text = (ans as { text?: unknown }).text;
      if (typeof text === "string" && text.trim().length >= 3) return clean(text);
    }
  }
  return null;
}

interface DeriveInput {
  storedName: string;
  description?: string | null;
  minimumDetails?: unknown;
  productState?: ProductState | null;
  spec?: Spec | null;
}

export function deriveProjectTitle(input: DeriveInput): TitleDerivationResult | null {
  const intakeAnswers: IntakeAnswerRow[] = Array.isArray(input.productState?.workingMemory?.intakeAnswers)
    ? (input.productState!.workingMemory!.intakeAnswers as IntakeAnswerRow[])
    : [];

  // (a) Persona + pain from spec
  const persona = input.spec?.personas?.[0];
  if (persona) {
    const role = clean(persona.name ?? "");
    const trigger = clean(persona.trigger ?? "");
    if (role.length >= 3 && trigger.length >= 3) {
      return {
        name: truncate(`${role}: ${trigger}`),
        source: "persona_pain",
        derivedAt: new Date().toISOString(),
      };
    }
    if (role.length >= 3) {
      return {
        name: truncate(`${role}'s tool`),
        source: "persona_pain",
        derivedAt: new Date().toISOString(),
      };
    }
  }

  // (b) ICP role + pain point from intake answers
  const icp = findAnswer(intakeAnswers, (r) =>
    /icp|persona|user|audience|customer|who/i.test(`${r.step ?? ""} ${r.question ?? ""}`),
  );
  const problem = findAnswer(intakeAnswers, (r) =>
    /problem|pain|gap|struggle|frustr/i.test(`${r.step ?? ""} ${r.question ?? ""}`),
  );

  if (icp && problem) {
    return {
      name: truncate(`${icp}: ${problem}`),
      source: "icp_pain",
      derivedAt: new Date().toISOString(),
    };
  }

  if (problem) {
    return {
      name: truncate(problem),
      source: "problem_statement",
      derivedAt: new Date().toISOString(),
    };
  }

  // (c) minimumDetails.problemStatement
  if (input.minimumDetails && typeof input.minimumDetails === "object") {
    const ps = (input.minimumDetails as { problemStatement?: unknown }).problemStatement;
    if (typeof ps === "string" && ps.trim().length >= 4) {
      return {
        name: truncate(clean(ps)),
        source: "problem_statement",
        derivedAt: new Date().toISOString(),
      };
    }
  }

  // (d) description, with leading "[context]" prefix stripped
  if (typeof input.description === "string") {
    const stripped = input.description.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
    if (stripped.length >= 4) {
      return {
        name: truncate(clean(stripped)),
        source: "description",
        derivedAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

// Predicate used by route handlers to decide whether enough signal exists to
// derive a meaningful title yet. Both an ICP and a pain point in
// intakeAnswers is the minimum threshold; a spec with a persona always
// qualifies because it's a downstream artifact requiring even more signal.
export function hasEnoughSignalForTitle(input: DeriveInput): boolean {
  if (input.spec?.personas && input.spec.personas.length > 0) return true;
  const rows: IntakeAnswerRow[] = Array.isArray(input.productState?.workingMemory?.intakeAnswers)
    ? (input.productState!.workingMemory!.intakeAnswers as IntakeAnswerRow[])
    : [];
  const hasIcp = !!findAnswer(rows, (r) =>
    /icp|persona|user|audience|customer|who/i.test(`${r.step ?? ""} ${r.question ?? ""}`),
  );
  const hasProblem = !!findAnswer(rows, (r) =>
    /problem|pain|gap|struggle|frustr/i.test(`${r.step ?? ""} ${r.question ?? ""}`),
  );
  return hasIcp && hasProblem;
}
