// Sufficiency ring — the "Face-ID enrollment" meter for the discovery intake.
//
// One arc per intake section (6). Each arc fills as that section gains signal:
//   covered  — a real user answer        → solid amber
//   inferred — AI-assumed / default value → hollow amber (dim)
//   open     — still carries a gap        → faint track
// When `enough` (no open topic scores blocking >= 6) the ring "closes": every
// arc turns green and the center shows a check. Purely presentational — driven
// by the IntakeSufficiency payload from GET /api/projects/:id/intake/sufficiency.

import type { IntakeSufficiency, SectionState } from "@shared/intake-sections";

const AMBER = "#f0b65e";
const GREEN = "#9bd06f";

const STATE_COLOR: Record<SectionState, string> = {
  covered: AMBER,
  inferred: "rgba(240,182,94,0.34)",
  open: "rgba(200,180,160,0.15)",
};

interface Props {
  sections: IntakeSufficiency["sections"];
  enough: boolean;
  size?: number;
  /** Compact pulls the stroke + font down for inline header use. */
  compact?: boolean;
}

export default function SufficiencyRing({ sections, enough, size = 96, compact = false }: Props) {
  const n = sections.length || 1;
  const stroke = compact ? 6 : 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Each section owns a 360/n slice; draw an arc that leaves a small gap.
  const gapDeg = 6;
  const sliceDeg = 360 / n;
  const arcDeg = sliceDeg - gapDeg;
  const arcLen = circumference * (arcDeg / 360);

  const covered = sections.filter((s) => s.state === "covered").length;

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
      role="img"
      data-testid="sufficiency-ring"
      data-enough={enough ? "true" : "false"}
      aria-label={
        enough
          ? `Enough information collected. ${covered} of ${n} sections answered.`
          : `Collecting information: ${covered} of ${n} sections answered.`
      }
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {sections.map((s, i) => (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={enough ? GREEN : STATE_COLOR[s.state]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circumference - arcLen}`}
            strokeDashoffset={-(circumference * (i / n))}
            style={{ transition: "stroke 320ms ease" }}
            data-section={s.key}
            data-state={s.state}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: enough ? GREEN : "#a89a8c",
          fontWeight: 600,
        }}
      >
        {enough ? (
          <svg width={compact ? 18 : 26} height={compact ? 18 : 26} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5L10 17.5L19 7" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span style={{ fontSize: compact ? 14 : 18, lineHeight: 1 }} data-testid="sufficiency-count">
            {covered}<span style={{ opacity: 0.5, fontSize: compact ? 10 : 12 }}>/{n}</span>
          </span>
        )}
      </div>
    </div>
  );
}
