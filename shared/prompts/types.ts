/**
 * Shared shape for every prompt module under shared/prompts/.
 *
 * Each module exports a default `PromptModule` so the prompt-builder gate
 * (build-orchestrator §"Prompt-builder gate") can read score + revision
 * + last run from a uniform place. The frontmatter at the top of each module
 * is the audit trail; this type is the runtime shape.
 *
 * Phase 1 owns docs/* prompts. Later phases populate discovery/, intake/,
 * methods/, and lint/.
 */
export interface PromptModule {
  /** Stable identifier. Examples: "docs.brief", "intake.next_question". */
  key: string;
  /** Module-level version. Bump when content changes; used in eval diffs. */
  version: string;
  /** The prompt text itself. */
  content: string;
  /** Default model tier when the caller does not override. */
  defaultModel: string;
  /** Latest score from /prompt-builder:score. 0–100; null if not yet scored. */
  prompt_builder_score: number | null;
  /** Number of /prompt-builder:optimize iterations applied. */
  prompt_builder_revision: number;
  /** ISO date (YYYY-MM-DD) of the last prompt-builder run, or null. */
  prompt_builder_run_at: string | null;
  /** Optional notes from the prompt-builder run; surfaced in admin UI. */
  prompt_builder_notes?: string;
}
