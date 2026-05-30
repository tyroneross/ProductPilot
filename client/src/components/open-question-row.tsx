// Defect #1 — inline-answer affordance for "Open Questions / Missing Information"
// blocks the LLM emits inside generated specs. One row per OpenQuestion.
// When `answerChips` is present the row renders a chip group; otherwise an
// input. Disabled state (no input or unchanged) follows the action-button-states
// rule: muted/inactive until the user types something.

import { useState } from "react";
import type { OpenQuestion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Props {
  projectId: string;
  question: OpenQuestion;
  onResolved?: (q: OpenQuestion) => void;
}

const surface = "#1a1714";
const textPrimary = "#f5f0eb";
const textMuted = "#a89a8c";
const accent = "#f0b65e";
const border = "rgba(200,180,160,0.12)";

export default function OpenQuestionRow({ projectId, question, onResolved }: Props) {
  const isAnswered = !!question.answeredValue;
  const [draft, setDraft] = useState<string>(question.answeredValue ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value: string) {
    if (!value || value.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/open-questions/answer`, {
        topicId: question.topicId,
        stageId: question.stageId,
        answer: value.trim(),
      });
      const body = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "open-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      onResolved?.({ ...question, answeredValue: value.trim(), answeredAt: new Date().toISOString() });
      void body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answer.");
    } finally {
      setSubmitting(false);
    }
  }

  const changed = draft.trim() !== (question.answeredValue ?? "").trim() && draft.trim().length > 0;
  const saveDisabled = submitting || !changed;

  return (
    <li
      data-testid={`open-question-${question.topicId}`}
      style={{
        listStyle: "none",
        background: surface,
        border: `1px solid ${isAnswered ? "rgba(240,182,94,0.32)" : border}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 8,
      }}
    >
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: textPrimary,
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {question.prompt}
        {isAnswered && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: accent,
              border: `1px solid rgba(240,182,94,0.4)`,
              borderRadius: 4,
              padding: "1px 5px",
              verticalAlign: "middle",
            }}
          >
            Answered
          </span>
        )}
      </p>
      {question.feedsField && (
        <p style={{ fontSize: 11, color: textMuted, margin: "4px 0 8px" }}>
          Feeds: <code style={{ color: textMuted }}>{question.feedsField}</code>
        </p>
      )}

      {question.answerKind === "choice" && question.answerChips && question.answerChips.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {question.answerChips.map((chip) => {
            const selected = question.answeredValue === chip;
            return (
              <button
                key={chip}
                type="button"
                disabled={submitting}
                onClick={() => submit(chip)}
                data-testid={`open-question-chip-${question.topicId}-${chip}`}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: `1px solid ${selected ? accent : border}`,
                  background: selected ? "rgba(240,182,94,0.16)" : "transparent",
                  color: selected ? accent : textPrimary,
                  fontFamily: "inherit",
                  fontSize: 12,
                  cursor: submitting ? "not-allowed" : "pointer",
                  minHeight: 32,
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(draft);
            }}
            maxLength={500}
            placeholder="Type your answer…"
            data-testid={`open-question-input-${question.topicId}`}
            disabled={submitting}
            className="focus-ring"
            style={{
              flex: 1,
              fontFamily: "inherit",
              fontSize: 13,
              padding: "8px 12px",
              minHeight: 36,
              borderRadius: 6,
              border: `1px solid ${border}`,
              background: "#110f0d",
              color: textPrimary,
              // T1-6: outline:none removed; .focus-ring restores :focus-visible.
            }}
          />
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() => submit(draft)}
            data-testid={`open-question-submit-${question.topicId}`}
            style={{
              padding: "8px 14px",
              minHeight: 36,
              borderRadius: 6,
              border: `1px solid ${saveDisabled ? border : "rgba(240,182,94,0.4)"}`,
              background: saveDisabled ? "transparent" : accent,
              color: saveDisabled ? textMuted : "#110f0d",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 500,
              cursor: saveDisabled ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Saving…" : isAnswered ? "Update" : "Submit"}
          </button>
        </div>
      )}

      {error && (
        <p
          style={{ fontSize: 11, color: "#e57373", margin: "6px 0 0" }}
          data-testid={`open-question-error-${question.topicId}`}
        >
          {error}
        </p>
      )}
    </li>
  );
}
