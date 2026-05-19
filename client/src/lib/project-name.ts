// Derives a human-meaningful project label.
//
// New projects created from the survey flow used to be named
// "Survey Draft - 10:37:03 AM" (timestamp only), which makes the projects list
// ambiguous — every row looks identical. This helper produces a readable label
// from data already present on the project payload, falling back to the stored
// name only when nothing better exists. Pure, display-layer only: no schema or
// network change, and it never returns null/empty (Content Resilience).

interface NameableProject {
  name: string;
  description?: string | null;
  minimumDetails?: unknown;
}

const MAX = 60;

function truncate(s: string): string {
  const t = s.trim();
  return t.length > MAX ? `${t.slice(0, MAX)}…` : t;
}

export function displayProjectName(project: NameableProject): string {
  // (a) description — strip a leading "[context]" prefix the survey flow adds.
  if (typeof project.description === "string") {
    const stripped = project.description.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
    if (stripped.length >= 4) return truncate(stripped);
  }

  // (b) minimumDetails.problemStatement
  const md = project.minimumDetails;
  if (md && typeof md === "object") {
    const ps = (md as { problemStatement?: unknown }).problemStatement;
    if (typeof ps === "string" && ps.trim().length >= 4) return truncate(ps);
  }

  // (c) fallback: stored name (may be the legacy timestamp on old rows).
  return project.name;
}
