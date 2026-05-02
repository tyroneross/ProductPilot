/**
 * Central re-export for prompt modules. Phase 1 ships only docs/* prompts;
 * later phases populate discovery/, intake/, methods/, and lint/.
 *
 * Back-compat: server/prompt-builders.ts continues to import from
 * @shared/prompt-content during the Phase 1→2 transition. This index is the
 * forward-looking entry point.
 */

export { default as briefPrompt } from "./docs/brief";
export { default as prdPrompt } from "./docs/prd";
export { default as uxPrompt } from "./docs/ux";
export { default as functionalPrompt } from "./docs/functional";
export { default as handoffPrompt } from "./docs/handoff";
export type { PromptModule } from "./types";
