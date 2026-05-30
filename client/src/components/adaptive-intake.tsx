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

export type IntakeMethod = "jtbd" | "qfd" | "pugh" | "agent";

export interface IntakeQuestion {
  text: string;
  chips: string[];
  intent: string;
  rule_fired: string;
  // Slot-aware topic (jtbd rev 3+, 2026-05-03). One of:
  // persona | trigger | exclusions | outcome | jobs | non_goals | priority.
  // Optional for forward-compat with QFD/Pugh/agent.
  topic?: string;
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

export const TRADEOFF_AXES = [
  "speed_to_alpha",
  "scalability",
  "ux_polish",
  "maintainability",
  "cost",
  "security",
] as const;
export type TradeoffAxis = typeof TRADEOFF_AXES[number];

export interface TradeoffWeights {
  speed_to_alpha: number;
  scalability: number;
  ux_polish: number;
  maintainability: number;
  cost: number;
  security: number;
  unacceptable_tradeoff: TradeoffAxis;
}

export type IntakeAction =
  | { action: "ask"; question: IntakeQuestion; method: IntakeMethod; scoring: BlockingScore[] }
  | { action: "infer"; defaults: SafeDefault[]; scoring: BlockingScore[] }
  | { action: "allocate_tradeoffs"; axes: readonly TradeoffAxis[]; reason: string }
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
  /** Called after a successful tradeoff-weight finalize. Caller routes to Brief view. */
  onFinalize?: (result: { spec: unknown; renderedMarkdown: string }) => void;
  /** Called when the user bails out of intake (e.g. from the loading screen escape hatch). Caller routes back to projects. */
  onCancel?: () => void;
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
  onFinalize,
  onCancel,
}: AdaptiveIntakeProps) {
  const [action, setAction] = useState<IntakeAction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);
  // T1-1: when the user clicks Challenge on an inferred SafeDefault, we
  // suspend the "infer" panel and surface the assumption's challenge_prompt
  // as a real question. Submitting that answer POSTs to /intake/answer with
  // metadata flagging the topic as user-corrected, so ingestAnswer overrides
  // the inferred default in productState. This is the spec's "Path A" (honest
  // wire-up) rather than "Path B" (flag-for-review). No fake button.
  const [challenging, setChallenging] = useState<SafeDefault | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState<string>("");

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
        // Pass extracts_into + the topic the ASK actually targeted so the
        // controller can promote the answer into the correct spec slice and
        // its slot-dedup ledger reflects what was asked.
        // Precedence (jtbd rev 3+, 2026-05-03): prompt-emitted question.topic
        // wins because the JTBD model now stamps every question with one of
        // the 7 slot strings. Falls back to the candidate-unknown topic from
        // the blocking-scorer for qfd/pugh and any rev-2 jtbd output.
        metadata: {
          extracts_into: action.question.extracts_into,
          topic: action.question.topic ?? action.scoring?.[0]?.topic ?? null,
        },
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
    // T1-1: open the in-component challenge form. Caller is also notified
    // (analytics / parent UI), but the actual override happens through the
    // /intake/answer round-trip below — not via the parent toast.
    setChallenging(assumption);
    setChallengeAnswer("");
    onChallengeAssumption?.(assumption);
  }

  async function submitChallenge() {
    if (!challenging || !challengeAnswer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // Use the assumption's challenge_prompt as the question text so the
      // intake log carries a faithful record of what the user was actually
      // re-asked. metadata.challenged_topic is the durable signal — the
      // server's ingestAnswer can map it back to the spec slot the SafeDefault
      // was filling.
      await fetcher("POST", `/api/projects/${projectId}/intake/answer`, {
        questionText: challenging.challenge_prompt || `Override the assumption: ${challenging.topic}`,
        answer: challengeAnswer.trim(),
        method: null,
        metadata: {
          challenged_topic: challenging.topic,
          original_default: challenging.default,
          source: "challenge_assumption",
        },
      });
      setStep((s) => s + 1);
      setChallenging(null);
      setChallengeAnswer("");
      // Refresh — controller may now re-ask, infer afresh, or finish.
      await loadNextStep();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save challenge");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelChallenge() {
    setChallenging(null);
    setChallengeAnswer("");
  }

  // ----- render states -----
  if (loading) {
    // Render a small skeleton (textarea-shaped block) plus a Cancel escape
    // hatch. Two reasons:
    //   1) UX — if /intake/next stalls or the user changes their mind during
    //      the network roundtrip, they can bail back to /projects rather than
    //      being trapped on a loading screen.
    //   2) Audit visibility — IBR audits expect at least one interactive
    //      element on every page state. A loading screen with only static
    //      text reads as `elementsScanned: 0` and trips false signals.
    return (
      <div data-testid="adaptive-intake-loading" style={containerStyle}>
        <p style={{ color: "#a89a8c", fontSize: "13px", marginBottom: "12px" }}>Loading next question…</p>
        <div
          aria-hidden="true"
          style={{
            height: "60px",
            background: "rgba(245,240,235,0.04)",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-testid="adaptive-intake-cancel"
            aria-label="Cancel and return to projects"
            style={{
              minHeight: "36px",
              padding: "8px 14px",
              background: "transparent",
              color: "#a89a8c",
              border: "1px solid rgba(200,180,160,0.18)",
              borderRadius: "8px",
              fontFamily: "inherit",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
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

  if (action.action === "allocate_tradeoffs") {
    return (
      <TradeoffAllocator
        axes={action.axes}
        reason={action.reason}
        onSubmit={async (weights) => {
          setError(null);
          try {
            const result = (await fetcher(
              "POST",
              `/api/projects/${projectId}/intake/finalize`,
              { tradeoffWeights: weights },
            )) as { spec: unknown; renderedMarkdown: string };
            onFinalize?.(result);
            // Re-load so the next call returns "done" (weights now persisted).
            await loadNextStep();
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not save tradeoff weights");
          }
        }}
      />
    );
  }

  // T1-1: when the user is mid-challenge, take over the panel with a real
  // ask form. This branch fires regardless of action.action — it's a modal
  // state on top of the infer/ask render below.
  if (challenging) {
    return (
      <div data-testid="adaptive-intake-challenge" style={containerStyle}>
        <p style={{ color: "#a89a8c", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.02em" }}>
          Challenging assumption · {challenging.topic}
        </p>
        <p
          data-testid="adaptive-intake-challenge-prompt"
          style={{ color: "#f5f0eb", fontSize: "16px", fontWeight: 500, marginBottom: "12px", lineHeight: 1.45 }}
        >
          {challenging.challenge_prompt || `What would you put in place of "${String(challenging.default)}"?`}
        </p>
        <p style={{ color: "#6b5d52", fontSize: "11px", marginBottom: "10px" }}>
          We assumed: <span style={{ color: "#a89a8c" }}>{String(challenging.default)}</span> · {challenging.rationale}
        </p>
        <textarea
          data-testid="adaptive-intake-challenge-textarea"
          value={challengeAnswer}
          onChange={(e) => setChallengeAnswer(e.target.value)}
          placeholder="Type the value you'd rather use…"
          rows={3}
          className="focus-ring"
          style={textareaStyle}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "10px" }}>
          <button
            type="button"
            onClick={cancelChallenge}
            disabled={submitting}
            className="focus-ring"
            data-testid="adaptive-intake-challenge-cancel"
            style={{
              height: "36px",
              padding: "0 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#a89a8c",
              background: "transparent",
              border: "1px solid rgba(200,180,160,0.18)",
              borderRadius: "8px",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitChallenge()}
            disabled={!challengeAnswer.trim() || submitting}
            className="focus-ring"
            data-testid="adaptive-intake-challenge-submit"
            style={{
              ...primaryBtnStyle,
              opacity: !challengeAnswer.trim() || submitting ? 0.4 : 1,
              cursor: !challengeAnswer.trim() || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Saving…" : "Save override"}
          </button>
        </div>
        {error && <p style={{ color: "#e57373", fontSize: "12px", marginTop: "8px" }}>{error}</p>}
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
      {/* T2-6: announce the new question to SR users after each answer.
          aria-live=polite waits for the user to pause; aria-atomic=true reads
          the whole question on each change (otherwise SR reads only the diff,
          which can be incoherent across question rewrites). */}
      <p
        data-testid="adaptive-intake-question"
        aria-live="polite"
        aria-atomic="true"
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
        className="focus-ring"
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

/**
 * TradeoffAllocator — Phase 4 terminal step.
 *
 * Six numeric inputs (sliders + numeric mirror) plus one radio for the
 * unacceptable_tradeoff axis. Submit is muted/inactive until sum===100 (per
 * CLAUDE.md "action button states" rule). Live total + per-axis totals visible.
 *
 * Default starting allocation distributes 100/6 ≈ floor + remainder so the
 * displayed initial total is exactly 100 and the user is never starting from
 * an invalid sum.
 */
function TradeoffAllocator({
  axes,
  reason,
  onSubmit,
}: {
  axes: readonly TradeoffAxis[];
  reason: string;
  onSubmit: (weights: TradeoffWeights) => Promise<void> | void;
}) {
  // Even split: floor(100/6)=16, remainder distributed onto first axis → sums to 100.
  const initialAllocation = (() => {
    const base = Math.floor(100 / axes.length);
    const remainder = 100 - base * axes.length;
    const out: Record<string, number> = {};
    axes.forEach((axis, i) => {
      out[axis] = base + (i === 0 ? remainder : 0);
    });
    return out;
  })();

  const [values, setValues] = useState<Record<string, number>>(initialAllocation);
  const [unacceptable, setUnacceptable] = useState<TradeoffAxis>(axes[0]);
  const [submitting, setSubmitting] = useState(false);

  const total = axes.reduce((sum, a) => sum + (values[a] ?? 0), 0);
  const valid = total === 100;
  // T2-8: live budget. Positive remaining = "you have N points left to
  // allocate"; negative = "you're N points over — reduce somewhere".
  const remaining = 100 - total;

  function setAxis(axis: TradeoffAxis, raw: string) {
    // Keep entries integer in [0, 100]; reject negative and non-numeric.
    const n = Math.max(0, Math.min(100, Math.floor(Number(raw) || 0)));
    setValues((prev) => ({ ...prev, [axis]: n }));
  }

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onSubmit({
        speed_to_alpha: values.speed_to_alpha,
        scalability: values.scalability,
        ux_polish: values.ux_polish,
        maintainability: values.maintainability,
        cost: values.cost,
        security: values.security,
        unacceptable_tradeoff: unacceptable,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const labelByAxis: Record<TradeoffAxis, string> = {
    speed_to_alpha: "Speed to alpha",
    scalability: "Scalability",
    ux_polish: "UX polish",
    maintainability: "Maintainability",
    cost: "Cost",
    security: "Security",
  };

  return (
    <div data-testid="adaptive-intake-allocator" style={containerStyle}>
      {/* T2-8: sticky budget header. Stays at the top of the panel as the
          user adjusts sliders, so they always see how many points are left.
          aria-live=polite announces the running total to SR users. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "10px",
          gap: 12,
        }}
      >
        <p style={{ color: "#f5f0eb", fontSize: "14px", fontWeight: 500, margin: 0 }}>
          Allocate 100 points across these tradeoffs
        </p>
        <span
          data-testid="adaptive-intake-allocator-remaining"
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: valid ? "#9bd06f" : remaining > 0 ? "#f0b65e" : "#f0a06e",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {valid
            ? "All 100 allocated ✓"
            : remaining > 0
              ? `${remaining} left`
              : `${Math.abs(remaining)} over`}
        </span>
      </div>
      <p style={{ color: "#a89a8c", fontSize: "12px", marginBottom: "14px" }}>
        {reason}
      </p>
      {/* T2-8: fieldset/legend gives SR users a single "Tradeoff weights, 6
          sliders" container instead of 6 unrelated number inputs. */}
      <fieldset
        style={{
          border: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <legend className="sr-only">Tradeoff weights — six sliders, must sum to 100</legend>
        {axes.map((axis) => (
          <div
            key={axis}
            data-testid={`adaptive-intake-allocator-row-${axis}`}
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <label
              htmlFor={`tradeoff-${axis}`}
              style={{ flex: "0 0 130px", color: "#f5f0eb", fontSize: "13px" }}
            >
              {labelByAxis[axis]}
            </label>
            <input
              type="range"
              id={`tradeoff-${axis}`}
              data-testid={`adaptive-intake-allocator-slider-${axis}`}
              min={0}
              max={100}
              step={1}
              value={values[axis] ?? 0}
              onChange={(e) => setAxis(axis, e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              data-testid={`adaptive-intake-allocator-input-${axis}`}
              min={0}
              max={100}
              step={1}
              value={values[axis] ?? 0}
              onChange={(e) => setAxis(axis, e.target.value)}
              className="focus-ring"
              style={{
                ...numericInputStyle,
                width: "56px",
              }}
            />
          </div>
        ))}
      </fieldset>

      {/* T2-8: keep the explicit total band for clarity on small screens
          where the header counter may be off-axis from the active slider. */}
      <div
        data-testid="adaptive-intake-allocator-total"
        style={{
          marginTop: "14px",
          padding: "8px 10px",
          borderRadius: "8px",
          background: valid ? "rgba(155,208,111,0.08)" : "rgba(240,160,110,0.1)",
          color: valid ? "#9bd06f" : "#f0a06e",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        Total: {total} / 100 {valid ? "✓" : "(must equal 100)"}
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: "16px 0 0 0" }}>
        <legend style={{ color: "#f5f0eb", fontSize: "13px", fontWeight: 500, padding: 0, marginBottom: "8px" }}>
          Unacceptable tradeoff (the one axis you refuse to compromise)
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {axes.map((axis) => {
            const selected = unacceptable === axis;
            return (
              <button
                key={axis}
                type="button"
                data-testid={`adaptive-intake-allocator-unacceptable-${axis}`}
                onClick={() => setUnacceptable(axis)}
                aria-pressed={selected}
                style={chipStyle(selected)}
              >
                {labelByAxis[axis]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
        <button
          type="button"
          data-testid="adaptive-intake-allocator-submit"
          className="focus-ring"
          onClick={submit}
          disabled={!valid || submitting}
          style={{
            ...primaryBtnStyle,
            opacity: !valid || submitting ? 0.4 : 1,
            cursor: !valid || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving…" : "Finalize intake"}
        </button>
      </div>
    </div>
  );
}

function ProgressBadge({ step, remaining, method }: { step: number; remaining: number; method: IntakeMethod }) {
  const total = step + Math.max(0, remaining - 1);
  // T1-5: drop the user-facing "method: JTBD" jargon. Keep `method` as a data-*
  // attribute for telemetry / e2e probes (callers still pass it; tests still
  // assert on it via querySelector) — only the visible badge is plain progress.
  return (
    <div
      data-testid="adaptive-intake-progress"
      data-method={method}
      style={{ color: "#a89a8c", fontSize: "11px", marginBottom: "10px", letterSpacing: "0.02em" }}
    >
      Question {step} of ~{Math.max(total, step)}
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
  // T1-6: outline:none removed; .focus-ring class on the <textarea> restores
  // a keyboard-only :focus-visible ring (WCAG 2.4.7).
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

const numericInputStyle: React.CSSProperties = {
  height: "28px",
  padding: "0 8px",
  background: "#110f0d",
  border: "1px solid rgba(200,180,160,0.18)",
  borderRadius: "6px",
  color: "#f5f0eb",
  fontFamily: "inherit",
  fontSize: "12px",
  textAlign: "right",
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
