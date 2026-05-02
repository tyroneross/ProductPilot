/**
 * Test 2 — renderBrief produces the Reading guide + Q1/Q2/Q3 structure.
 *
 * The PRD-Builder methodology requires a Reading-guide section in the Brief
 * with explicit For-humans / For-LLM-agents subsections plus a decision-routing
 * table. The Phase 3 Fidelity Check depends on this structure being present.
 *
 * This is a content test, not a screenshot test — we assert specific section
 * headings and key phrases, not full markdown equality. That keeps it stable
 * across small wording tweaks but still fails fast if the Reading guide
 * disappears or the Q1/Q2/Q3 sections get renamed.
 */
import { describe, expect, it } from "vitest";
import { renderBrief } from "../services/spec-renderer";
import type { Spec, ProductState } from "@shared/schema";

const sampleSpec: Spec = {
  id: "spec-1",
  productName: "Test Product",
  productDescription: "Sample for renderer tests.",
  personas: [
    {
      id: "p-1",
      name: "Solo founder",
      trigger: "After a sales call where the prospect lost interest mid-demo.",
      exclusions: ["Not enterprise IT buyers", "Not casual hobbyists", "Not power-users"],
      jobs: ["When pitching, I want to capture objections, so I can address them in follow-up."],
    },
  ],
  scenarios: [
    {
      id: "s-1",
      personaId: "p-1",
      context: "Just left a 30-minute discovery call.",
      goal: "After 2 weeks of post-call use, the founder closes a recap doc within 5 minutes of hanging up on 4 of 5 calls.",
      successSignal: "calendar event 'recap done' appended within 5 min of meeting end-time.",
    },
  ],
  needs: [],
  features: [],
  uxFlows: [],
  screens: [],
  dataPoints: [],
  integrations: [],
  apiContracts: [],
  tests: [],
  adrs: [],
  assumptions: [],
  risks: [],
  nonGoals: [
    {
      id: "ng-1",
      text: "Will not generate a CRM sync for v1",
      because: "Founder workflow is solo, not team-based, so CRM round-trips add friction without payoff.",
    },
  ],
};

const sampleState: ProductState = {
  version: 1,
  stanceBecauseClauses: [
    {
      id: "stance-priv",
      category: "privacy_data",
      stance: "Audio is processed locally; transcripts never leave the device.",
      because: "Sales conversations contain confidential prospect info; trust is the moat.",
    },
    {
      id: "stance-comp",
      category: "complexity",
      stance: "One primary action per screen.",
      because: "Founders open this between calls — cognitive load is the enemy.",
    },
    {
      id: "stance-cost",
      category: "cost",
      stance: "Free during alpha, $20/mo at GA.",
      because: "Solo founders have low budget tolerance until they see direct revenue impact.",
    },
  ],
  pivotLog: [],
  workingMemory: {},
};

describe("renderBrief", () => {
  const out = renderBrief(sampleSpec, sampleState, "PRODUCT IDEA: a tool for founders");

  it("includes the Reading guide section", () => {
    expect(out).toContain("## Reading guide");
    expect(out).toContain("**For humans:**");
    expect(out).toContain("**For LLM agents:**");
  });

  it("includes the decision-routing table", () => {
    expect(out).toContain("Decision-routing table");
    expect(out).toContain("| Question | Section to consult |");
    // 8 rows in the table per the Fidelity Check
    expect(out).toContain("Should this feature exist?");
    expect(out).toContain("On-device vs cloud?");
  });

  it("renders Q1 — Persona + Trigger with exclusions", () => {
    expect(out).toContain("## Q1 — Persona + Trigger");
    expect(out).toContain("Solo founder");
    expect(out).toContain("After a sales call");
    expect(out).toContain("Who they are NOT");
    expect(out).toContain("Not enterprise IT buyers");
  });

  it("renders Q2 — Outcome with success signal", () => {
    expect(out).toContain("## Q2 — Outcome");
    expect(out).toContain("After 2 weeks of post-call use");
    expect(out).toContain("calendar event 'recap done'");
  });

  it("renders Q3 — Stance with because-clauses", () => {
    expect(out).toContain("## Q3 — Stance");
    expect(out).toContain("privacy data");
    expect(out).toContain("Audio is processed locally");
    expect(out).toContain("_Because:_");
    expect(out).toContain("trust is the moat");
  });

  it("renders Non-goals each with a because-clause", () => {
    expect(out).toContain("## Non-goals");
    expect(out).toContain("CRM sync");
    expect(out).toContain("Founder workflow is solo");
  });
});
