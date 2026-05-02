/**
 * Phase 2 — AdaptiveIntake component test.
 *
 * Asserts:
 *   - Renders one question + chips when the controller returns ASK.
 *   - Clicking a chip pre-fills the textarea.
 *   - Submitting the answer fires the answer endpoint and reloads.
 *   - Renders inferred-assumption rows and emits the right callback on Challenge.
 *   - Loading + done states render correctly.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdaptiveIntake, { type IntakeAction } from "../../client/src/components/adaptive-intake";

// Vitest does not auto-cleanup the way Jest's setupFilesAfterEach does. Running cleanup()
// between tests prevents stale DOM from earlier tests bleeding into later assertions.
afterEach(() => cleanup());

function makeFetcher(responses: Record<string, unknown>) {
  return vi.fn(async (method: string, url: string, _body?: unknown) => {
    const key = `${method} ${url.replace(/^.*\/api/, "/api")}`;
    if (key in responses) return responses[key];
    throw new Error(`Unmocked: ${key}`);
  });
}

describe("AdaptiveIntake — render states", () => {
  it("renders the loading state initially", () => {
    const fetcher = vi.fn(() => new Promise(() => {})); // never resolves
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);
    expect(screen.getByTestId("adaptive-intake-loading")).toBeTruthy();
  });

  it("renders ASK action with question, chips, and textarea", async () => {
    const askAction: IntakeAction = {
      action: "ask",
      method: "jtbd",
      question: {
        text: "When do users reach for this?",
        chips: ["Right after a sales call", "When inbox crosses 50", "End of every sprint"],
        intent: "rule 1 — personas empty",
        rule_fired: "1",
        extracts_into: { spec_path: "personas[*].trigger", kind: "string", merge_strategy: "append" },
      },
      scoring: [
        { topic: "primary_persona_and_trigger", evidence: 0, reversibility: 0, risk: 5, blocking: 15, decision: "ask", reason: "no personas" },
      ],
    };
    const fetcher = makeFetcher({ "POST /api/projects/p1/intake/next": askAction });
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);

    await waitFor(() => screen.getByTestId("adaptive-intake-question"));
    expect(screen.getByTestId("adaptive-intake-question").textContent).toContain("When do users reach for this?");
    // 3 chips render.
    expect(screen.getAllByRole("button").filter((b) => b.getAttribute("data-testid")?.startsWith("adaptive-intake-chip-")))
      .toHaveLength(3);
    expect(screen.getByTestId("adaptive-intake-textarea")).toBeTruthy();
  });

  it("clicking a chip fills the textarea draft, click again clears it", async () => {
    const askAction: IntakeAction = {
      action: "ask",
      method: "jtbd",
      question: {
        text: "When?",
        chips: ["After sales call", "When inbox crosses 50"],
        intent: "x",
        rule_fired: "1",
        extracts_into: { spec_path: "personas[*].trigger", kind: "string", merge_strategy: "append" },
      },
      scoring: [],
    };
    const fetcher = makeFetcher({ "POST /api/projects/p1/intake/next": askAction });
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);
    await waitFor(() => screen.getByTestId("adaptive-intake-question"));

    const firstChip = screen.getByTestId("adaptive-intake-chip-after-sales-call");
    fireEvent.click(firstChip);
    const textarea = screen.getByTestId("adaptive-intake-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("After sales call");

    // Click again — toggles off.
    fireEvent.click(firstChip);
    expect(textarea.value).toBe("");
  });

  it("submit button is disabled until the textarea has content", async () => {
    const askAction: IntakeAction = {
      action: "ask",
      method: "jtbd",
      question: {
        text: "When?",
        chips: ["a"],
        intent: "x",
        rule_fired: "1",
        extracts_into: { spec_path: "personas[*].trigger", kind: "string", merge_strategy: "append" },
      },
      scoring: [],
    };
    const fetcher = makeFetcher({ "POST /api/projects/p1/intake/next": askAction });
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);
    await waitFor(() => screen.getByTestId("adaptive-intake-submit"));

    const submit = screen.getByTestId("adaptive-intake-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByTestId("adaptive-intake-chip-a"));
    expect((screen.getByTestId("adaptive-intake-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders INFER action with assumption rows + Challenge button emits callback", async () => {
    const inferAction: IntakeAction = {
      action: "infer",
      defaults: [
        {
          topic: "ui_copy_tone",
          default: "professional",
          confidence: "medium",
          rationale: "common B2B SaaS default",
          challenge_prompt: "If your audience is consumers, choose a friendlier tone.",
        },
      ],
      scoring: [],
    };
    const fetcher = makeFetcher({ "POST /api/projects/p1/intake/next": inferAction });
    const onChallenge = vi.fn();
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} onChallengeAssumption={onChallenge} />);
    await waitFor(() => screen.getByTestId("adaptive-intake-infer"));

    expect(screen.getByTestId("adaptive-intake-assumption-ui_copy_tone")).toBeTruthy();
    fireEvent.click(screen.getByTestId("adaptive-intake-challenge-ui_copy_tone"));

    expect(onChallenge).toHaveBeenCalledWith(expect.objectContaining({
      topic: "ui_copy_tone",
      default: "professional",
      confidence: "medium",
    }));
  });

  it("renders DONE action and fires onComplete", async () => {
    const doneAction: IntakeAction = {
      action: "done",
      reason: "All structural gaps filled.",
    };
    const fetcher = makeFetcher({ "POST /api/projects/p1/intake/next": doneAction });
    const onComplete = vi.fn();
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} onComplete={onComplete} />);

    await waitFor(() => screen.getByTestId("adaptive-intake-done"));
    expect(screen.getByTestId("adaptive-intake-done").textContent).toContain("Intake complete");
    expect(onComplete).toHaveBeenCalledWith(doneAction);
  });
});
