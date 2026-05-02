/**
 * AdaptiveIntake — Phase 2 single-question UI.
 *
 * Behavior contract (plan §Phase 2 step 3):
 *   - Renders ONE question at a time.
 *   - Reuses the chip-suggestion convention from DISCOVERY_INITIAL_PROMPT (see details.tsx
 *     and shared/prompts/intake/method-router.ts CHIP SUGGESTIONS).
 *   - Shows an "inferred-assumptions panel" below the question with a "Challenge" button per row.
 *   - Surfaces a progress affordance ("3 of ~5 highest-leverage unknowns").
 *
 * Server contract:
 *   - POST /api/projects/:id/intake/next        → IntakeAction
 *   - POST /api/projects/:id/intake/answer      → updated productState
 *   - POST /api/projects/:id/intake/finalize    → SpecDraft (Brief)
 *
 * This component is intentionally testable in isolation: it accepts an optional
 * `fetcher` prop the caller can override in tests. The default fetcher hits the
 * real API via apiRequest. Tests pass a mocked fetcher — no network, no MSW setup.
 */

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Wire types — mirror server/services/intake-controller.ts public types.
// Keeping a separate copy avoids importing server-side code into the client bundle.
// ---------------------------------------------------------------------------

export type IntakeMethod = "jtbd" | "qfd" | "pugh";

export interface IntakeQuestion {
  text: string;
  chips: string[];
  intent: string;
  rule_fired: string;
  extracts_into: { spec_path: string; kind: string; merge_strategy: string };
  payload?: Record<string, unknown>;
}

export interface BlockingScore {
  topic: string;
  evidence: number;
  reversibility: number;
  risk: number;
  blocking: number;
  decision: "ask" | "infer";
  reason: string;
}

export interface SafeDefault {
  topic: string;
  default: unknown;
  confidence: "high" | "medium" | "low";
  rationale: string;
  challenge_prompt: string;
}

export type IntakeAction =
  | { action: "ask"; question: IntakeQuestion; method: IntakeMethod; scoring: BlockingScore[] }
  | { action: "infer"; defaults: SafeDefault[]; scoring: BlockingScore[] }
  | { action: "done"; reason: string };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AdaptiveIntakeProps {
  projectId: string;
  /** Optional override for tests. Default uses fetch. */
  fetcher?: (method: string, url: string, body?: unknown) => Promise<unknown>;
  /** Called when intake reaches "done" — caller routes to the next step (typically Brief render). */
  onComplete?: (finalAction: { action: "done"; reason: string }) => void;
  /** Called when the user clicks Challenge on an inferred default — caller can route to a custom-answer flow. */
  onChallengeAssumption?: (assumption: SafeDefault) => void;
}

// Default fetcher uses fetch with credentials so the auth cookie flows.
const defaultFetcher = async (method: string, url: string, body?: unknown): Promise<unknown> => {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdaptiveIntake({
  projectId,
  fetcher = defaultFetcher,
  onComplete,
  onChallengeAssumption,
}: AdaptiveIntakeProps) {
  const [action, setAction] = useState<IntakeAction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);

  async function loadNextStep() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher("POST", `/api/projects/${projectId}/intake/next`) as IntakeAction;
      setAction(result);
      setDraftAnswer("");
      if (result.action === "done") onComplete?.(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load next intake step");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNextStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function submitAnswer() {
    if (!action || action.action !== "ask" || !draftAnswer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetcher("POST", `/api/projects/${projectId}/intake/answer`, {
        questionText: action.question.text,
        answer: draftAnswer.trim(),
        method: action.method,
      });
      setStep((s) => s + 1);
      await loadNextStep();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save answer");
    } finally {
      setSubmitting(false);
    }
  }

  function selectChip(chip: string) {
    setDraftAnswer((prev) => (prev === chip ? "" : chip));
  }

  function challengeAssumption(assumption: SafeDefault) {
    onChallengeAssumption?.(assumption);
  }

  // ----- render states -----
  if (loading) {
    return (
      <div data-testid="adaptive-intake-loading" style={containerStyle}>
        <p style={{ color: "#a89a8c", fontSize: "13px" }}>Loading next question…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="adaptive-intake-error" style={containerStyle}>
        <p style={{ color: "#f0a06e", fontSize: "13px" }}>{error}</p>
        <button type="button" onClick={loadNextStep} style={primaryBtnStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (!action) {
    return null;
  }

  if (action.action === "done") {
    return (
      <div data-testid="adaptive-intake-done" style={containerStyle}>
        <p style={{ color: "#f5f0eb", fontSize: "14px", fontWeight: 500 }}>
          Intake complete.
        </p>
        <p style={{ color: "#a89a8c", fontSize: "13px", marginTop: "6px" }}>
          {action.reason}
        </p>
      </div>
    );
  }

  if (action.action === "infer") {
    // No high-stakes unknowns left to ask. Show the inferred assumptions and let the
    // user challenge any that don't fit. The caller decides whether to also call finalize.
    return (
      <div data-testid="adaptive-intake-infer" style={containerStyle}>
        <p style={{ color: "#f5f0eb", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
          Filled in the rest with safe defaults
        </p>
        <p style={{ color: "#a89a8c", fontSize: "13px", marginBottom: "12px" }}>
          Tap “Challenge” on anything that doesn't match your intent.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {action.defaults.map((d, i) => (
            <AssumptionRow
              key={`${d.topic}-${i}`}
              assumption={d}
              onChallenge={() => challengeAssumption(d)}
            />
          ))}
        </div>
      </div>
    );
  }

  // action.action === "ask"
  const { question, method, scoring } = action;
  const remaining = scoring.filter((s) => s.decision === "ask").length;
  return (
    <div data-testid="adaptive-intake-ask" style={containerStyle}>
      <ProgressBadge step={step + 1} remaining={remaining} method={method} />
      <p
        data-testid="adaptive-intake-question"
        style={{ color: "#f5f0eb", fontSize: "16px", fontWeight: 500, marginBottom: "12px", lineHeight: 1.45 }}
      >
        {question.text}
      </p>
      {question.chips.length > 0 && (
        <div data-testid="adaptive-intake-chips" style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {question.chips.map((chip) => {
            const selected = draftAnswer === chip;
            return (
              <button
                key={chip}
                type="button"
                data-testid={`adaptive-intake-chip-${chip.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => selectChip(chip)}
                style={chipStyle(selected)}
              >
                {chip}
              </button>
            );
          })}
        </div>
      )}
      <textarea
        data-testid="adaptive-intake-textarea"
        value={draftAnswer}
        onChange={(e) => setDraftAnswer(e.target.value)}
        placeholder="Or write your own answer…"
        rows={3}
        style={textareaStyle}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
        <button
          type="button"
          data-testid="adaptive-intake-submit"
          onClick={submitAnswer}
          disabled={!draftAnswer.trim() || submitting}
          style={{
            ...primaryBtnStyle,
            // Action-button dual-state per CLAUDE.md User Preferences:
            // muted/inactive until criteria are met (here: non-empty answer), then prominent.
            opacity: !draftAnswer.trim() || submitting ? 0.4 : 1,
            cursor: !draftAnswer.trim() || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AssumptionRow({ assumption, onChallenge }: { assumption: SafeDefault; onChallenge: () => void }) {
  const confidenceLabel: Record<SafeDefault["confidence"], string> = {
    high: "high confidence",
    medium: "medium confidence",
    low: "low confidence",
  };
  const confidenceColor: Record<SafeDefault["confidence"], string> = {
    high: "#9bd06f",
    medium: "#f0b65e",
    low: "#f0a06e",
  };
  return (
    <div
      data-testid={`adaptive-intake-assumption-${assumption.topic}`}
      style={{
        padding: "10px 12px",
        background: "#15110d",
        border: "1px solid rgba(200,180,160,0.1)",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f5f0eb", fontSize: "13px", fontWeight: 500 }}>{assumption.topic}</div>
          <div style={{ color: "#a89a8c", fontSize: "12px", marginTop: "2px" }}>
            {String(assumption.default ?? "—")}
          </div>
        </div>
        <button
          type="button"
          data-testid={`adaptive-intake-challenge-${assumption.topic}`}
          onClick={onChallenge}
          style={{
            ...secondaryBtnStyle,
            // Visible secondary action per Calm Precision (signal via text color, no badge).
            color: "#f0b65e",
            borderColor: "rgba(240,182,94,0.4)",
          }}
        >
          Challenge
        </button>
      </div>
      <div style={{ color: confidenceColor[assumption.confidence], fontSize: "11px" }}>
        {confidenceLabel[assumption.confidence]} · {assumption.rationale}
      </div>
    </div>
  );
}

function ProgressBadge({ step, remaining, method }: { step: number; remaining: number; method: IntakeMethod }) {
  const total = step + Math.max(0, remaining - 1);
  return (
    <div
      data-testid="adaptive-intake-progress"
      style={{ color: "#a89a8c", fontSize: "11px", marginBottom: "10px", letterSpacing: "0.02em" }}
    >
      Question {step} of ~{Math.max(total, step)} · method: {method.toUpperCase()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — mirror details.tsx tokens; kept inline to avoid coupling to a component library
// before the rest of the design system migration lands.
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  padding: "16px 18px",
  background: "#0e0c0a",
  border: "1px solid rgba(200,180,160,0.1)",
  borderRadius: "12px",
};

const chipStyle = (selected: boolean): React.CSSProperties => ({
  height: "32px",
  padding: "0 12px",
  fontSize: "12px",
  fontWeight: 500,
  color: selected ? "#1a0f00" : "#a89a8c",
  background: selected ? "#f0b65e" : "transparent",
  border: `1px solid ${selected ? "#f0b65e" : "rgba(200,180,160,0.18)"}`,
  borderRadius: "999px",
  cursor: "pointer",
});

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#110f0d",
  border: "1px solid rgba(200,180,160,0.1)",
  borderRadius: "8px",
  color: "#f5f0eb",
  fontFamily: "inherit",
  fontSize: "13px",
  outline: "none",
  resize: "vertical",
};

const primaryBtnStyle: React.CSSProperties = {
  height: "36px",
  padding: "0 16px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#1a0f00",
  background: "#f0b65e",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  height: "28px",
  padding: "0 10px",
  fontSize: "12px",
  fontWeight: 500,
  color: "#a89a8c",
  background: "transparent",
  border: "1px solid rgba(200,180,160,0.18)",
  borderRadius: "999px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default AdaptiveIntake;
