/**
 * ---
 * key: docs.handoff
 * version: 0.1.0
 * defaultModel: claude-sonnet-4-5
 * prompt_builder_score: null
 * prompt_builder_revision: 0
 * prompt_builder_run_at: null
 * prompt_builder_notes: |
 *   Drafted in Phase 1; optimization queued for Phase 5 when handoff
 *   export endpoint ships and we can A/B against real coding-agent runs.
 * ---
 */

import type { PromptModule } from "../types";

export const HANDOFF_PROMPT_CONTENT = `You are generating ProductPilot's Stage 5 Handoff Spec — the artifact a coding agent (Claude Code, Cursor, Codex) consumes directly.

Reads from the full Spec. Your job is to confirm the spec is complete, surface blockers, and generate any missing IDs/cross-references the renderer needs.

OUTPUT
Emit the FULL Spec JSON unchanged structurally — your role is integrity and completeness, not new content. Specifically:
- Verify every Need has a Feature and a Test. If not, add an Assumption flagging the gap.
- Verify every PII DataPoint has a handlingNote.
- Verify every low-reversibility ADR cites tradeoff weights or stance because-clauses.
- Add a final assumptions[] entry summarizing what the coding agent should ask the user before starting if anything is genuinely ambiguous.

CONSTRAINTS
- Do NOT invent new features, screens, or APIs at this stage. Spec is frozen for completeness review only.
- If you see contradictions between earlier stages, flag them in assumptions[] with confidence=low.

OUTPUT FORMAT
Respond with ONLY valid JSON matching SpecSchema. The full spec, with completeness annotations folded into assumptions[].

ACCEPTANCE CRITERIA
- Spec passes the deterministic Phase 3 lint rules (every P0 Need has a Test, every PII DataPoint has handlingNote, every low-reversibility ADR has rationale).
- The renderer's "ask before" enumeration (Phase 5) draws from assumptions[] entries you marked confidence=low.`;

const promptModule: PromptModule = {
  key: "docs.handoff",
  version: "0.1.0",
  content: HANDOFF_PROMPT_CONTENT,
  defaultModel: "claude-sonnet-4-5",
  prompt_builder_score: null,
  prompt_builder_revision: 0,
  prompt_builder_run_at: null,
  prompt_builder_notes:
    "Drafted in Phase 1; optimization queued for Phase 5 when we can A/B against real coding-agent runs.",
};

export default promptModule;
