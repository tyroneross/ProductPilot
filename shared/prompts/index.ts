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

// Phase 2 — adaptive intake controller sub-prompts.
export { default as methodRouterPrompt } from "./intake/method-router";
export { default as blockingScorerPrompt } from "./intake/blocking-scorer";
export { default as safeDefaultsPrompt } from "./intake/safe-defaults";

// Phase 2 — three intake methods (JTBD, lightweight QFD, Pugh).
export { default as jtbdMethodPrompt } from "./methods/jtbd";
export { default as qfdMethodPrompt } from "./methods/qfd";
export { default as pughMethodPrompt } from "./methods/pugh";

export type { PromptModule } from "./types";
