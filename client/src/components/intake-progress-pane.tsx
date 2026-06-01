// Defect #4 — intake progress side pane.
//
// During the discovery / adaptive-intake flow, surfaces the ProductPilot
// section map (PRD / North Star / Architecture / etc) with per-section
// counts of:
//   - filled    — user answered a question that promotes into this section
//   - inferred  — controller filled a value with [ASSUMED] or workingMemory
//                 marker (assumption-fill mode)
//   - missing   — sections that have no signal yet
//
// Inputs are projected from productState.workingMemory.intakeAnswers[]
// where each row carries `metadata.extracts_into.spec_path` (assigned by
// the intake-controller; see server/services/intake-controller.ts). A
// trailing "This answers: <section>.<field>" line shows below the current
// question.
//
// >=768px: rendered as a side pane.
// <768px: mobile fallback is the existing thin progress bar in session-survey.

import { Info } from "lucide-react";
// SECTIONS + specPathToSection live in the shared contract so the server
// assessor, this pane, and the sufficiency ring agree on the six sections and
// the topic→section mapping with no drift.
import { SECTIONS, specPathToSection } from "@shared/intake-sections";

interface IntakeAnswerRow {
  metadata?: { extracts_into?: { spec_path?: string | null }; topic?: string | null; spec_path?: string | null };
}

interface Props {
  intakeAnswers: IntakeAnswerRow[];
  // ASSUMED counts per section (e.g. derived from productState markers).
  inferredBySection?: Partial<Record<string, number>>;
  // Current question's spec-path / topic so the pane can highlight which
  // section receives the upcoming answer.
  currentSpecPath?: string | null;
  currentTopic?: string | null;
}

export default function IntakeProgressPane({
  intakeAnswers,
  inferredBySection = {},
  currentSpecPath,
  currentTopic,
}: Props) {
  const filledBySection = new Map<string, number>();
  for (const row of intakeAnswers) {
    const specPath =
      row.metadata?.extracts_into?.spec_path ??
      row.metadata?.spec_path ??
      null;
    const topic = row.metadata?.topic ?? null;
    const key = specPathToSection(specPath, topic);
    filledBySection.set(key, (filledBySection.get(key) ?? 0) + 1);
  }
  const activeSection = specPathToSection(currentSpecPath, currentTopic);

  return (
    <aside
      data-testid="intake-progress-pane"
      aria-label="Intake progress"
      style={{
        background: "#1a1714",
        border: "1px solid rgba(200,180,160,0.08)",
        borderRadius: 8,
        padding: "16px",
        color: "#c8b4a0",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#f0b65e",
          margin: "0 0 12px",
        }}
      >
        Spec progress
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {SECTIONS.map((s) => {
          const filled = filledBySection.get(s.key) ?? 0;
          const inferred = inferredBySection[s.key] ?? 0;
          const isActive = activeSection === s.key;
          return (
            <li
              key={s.key}
              data-testid={`intake-progress-section-${s.key}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 6,
                marginBottom: 4,
                background: isActive ? "rgba(240,182,94,0.08)" : "transparent",
                border: `1px solid ${isActive ? "rgba(240,182,94,0.32)" : "transparent"}`,
                fontSize: 12,
              }}
            >
              <span style={{ flex: 1, color: isActive ? "#f5f0eb" : "#c8b4a0", fontWeight: isActive ? 500 : 400 }}>
                {s.short}
              </span>
              <span
                style={{ color: filled > 0 ? "#f0b65e" : "#6b5d52", fontVariantNumeric: "tabular-nums" }}
                title={`${filled} answered`}
              >
                {filled}
              </span>
              {inferred > 0 && (
                <span
                  style={{
                    color: "#f0b65e",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    border: "1px solid rgba(240,182,94,0.32)",
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                  title={`${inferred} inferred`}
                >
                  {inferred}i
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {(currentSpecPath || currentTopic) && (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#a89a8c",
            margin: "12px 0 0",
          }}
        >
          <Info style={{ width: 12, height: 12, color: "#f0b65e", flexShrink: 0 }} />
          <span>
            This question feeds:{" "}
            <code style={{ color: "#f0b65e" }}>
              {SECTIONS.find((s) => s.key === activeSection)?.short ?? "Brief"}
              {currentSpecPath ? ` · ${currentSpecPath}` : currentTopic ? ` · ${currentTopic}` : ""}
            </code>
          </span>
        </p>
      )}
    </aside>
  );
}
