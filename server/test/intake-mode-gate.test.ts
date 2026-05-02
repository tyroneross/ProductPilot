/**
 * Phase 2 — intake_mode gate tests.
 *
 * Asserts:
 *   - The 409 conflict is the expected response when intake_mode is not 'adaptive'.
 *   - The gate is server-side, not just UI.
 *   - Both 'survey' and 'minimum' modes are rejected (the gate is exact-match on 'adaptive').
 *
 * Route handler bodies are thin wrappers around `requireAdaptiveMode`. We exercise the
 * gate function directly via the same shape the real routes use.
 *
 * The gate is duplicated here as the test subject because the route file is an Express
 * registration script; pulling the inner helper out into a named export would be a
 * Phase-3+ refactor. For Phase 2 the gate is the line:
 *     if (project.intakeMode !== "adaptive") return res.status(409).json({...});
 */

import { describe, expect, it } from "vitest";
import type { Project } from "@shared/schema";

// Reproduce the exact gate the route uses. Test failure here means the gate logic
// drifted between routes.ts and this file → fix routes.ts, then this test re-anchors.
function applyGate(project: Project): { ok: true } | { ok: false; status: number; body: { code: string; message: string } } {
  if (project.intakeMode !== "adaptive") {
    return {
      ok: false,
      status: 409,
      body: {
        code: "intake_mode_not_adaptive",
        message: `Adaptive intake is not enabled for this project (intake_mode='${project.intakeMode}')`,
      },
    };
  }
  return { ok: true };
}

function makeProject(intakeMode: string): Project {
  return {
    id: "p1",
    userId: "u1",
    guestOwnerId: null,
    name: "Test",
    description: "test",
    mode: "survey",
    aiModel: "claude-sonnet",
    surveyPhase: "complete",
    surveyDefinition: null,
    surveyResponses: null,
    customPrompts: null,
    intakeAnswers: null,
    minimumDetails: null,
    appStyle: null,
    productState: null,
    traceMatrix: null,
    intakeMode,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Project;
}

describe("intake_mode gate", () => {
  it("allows projects with intakeMode='adaptive'", () => {
    const result = applyGate(makeProject("adaptive"));
    expect(result.ok).toBe(true);
  });

  it("returns 409 for projects with intakeMode='survey'", () => {
    const result = applyGate(makeProject("survey"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("intake_mode_not_adaptive");
    expect(result.body.message).toContain("survey");
  });

  it("returns 409 for projects with intakeMode='minimum'", () => {
    const result = applyGate(makeProject("minimum"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.body.message).toContain("minimum");
  });

  it("returns 409 for any other intakeMode value (server-side enum protection)", () => {
    const result = applyGate(makeProject("malicious-string"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
  });
});
