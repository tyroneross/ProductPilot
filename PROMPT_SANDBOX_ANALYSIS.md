# Prompt Sandbox Analysis — ProductPilot

**Date:** 2026-02-14
**Method:** Traced 3 diverse product scenarios through the entire prompt pipeline, evaluating what each stage would produce and identifying gaps.

---

## Test Scenarios

### Scenario A: Simple SaaS — "Habit Streak Tracker"
- **Entry:** Idea tab
- **Pitch:** "A habit tracking app for people who want to build daily streaks. Users create habits, check them off daily, and see streak counts and simple stats. Motivational but not gamified — focused on consistency."
- **V1 Scope:** "User signs up, creates habits with names and frequency (daily/weekly), checks off habits each day from a dashboard, sees current streak count and a simple calendar heat map. Can edit or archive habits."
- **Platform:** Web app

### Scenario B: B2B Problem — "Scattered Team Docs"
- **Entry:** Problem tab
- **Problem:** "Our team of 12 has documentation scattered across Google Docs, Notion, Confluence, and random Slack messages. Nobody can find anything. New hires spend weeks figuring out where things are. We waste hours in meetings re-explaining things that are documented somewhere."

### Scenario C: Local-First — "Personal Health Journal"
- **Entry:** Idea tab
- **Pitch:** "A local-first health journal for people managing chronic conditions. All data stays on-device. Users log symptoms, medications, meals, and mood daily. The app shows correlations (e.g., 'your headaches correlate with skipping medication') without sending data anywhere."
- **V1 Scope:** "User opens the app, creates daily log entries with symptoms (tagged), medications taken, meals, and mood rating. Dashboard shows timeline view and basic correlation charts. Data exports to JSON for sharing with doctor. Everything stored locally, no account needed."
- **Platform:** Desktop / Local

---

## Pipeline Trace: Scenario A (Habit Streak Tracker)

### Phase 1: CAT Survey Generation

**Input to AI:**
```
Product Pitch: A habit tracking app for people who want to build daily streaks...
V1 Scope: User signs up, creates habits with names and frequency...
Platform: web
```

**Expected Dimension Scores:**
| Dimension | Score | Reasoning |
|-----------|-------|-----------|
| WHO | 0.7 | "people who want to build daily streaks" — somewhat vague |
| WHY | 0.8 | Clear problem: building consistency |
| WHAT | 0.9 | Very clear feature list |
| HOW | 0.8 | User flow described well |
| LOOK | 0.0 | Nothing about visual style |
| WHERE | 0.9 | "web" — clear |
| HOW_BIG | 0.0 | No scale mentioned |
| WITH_WHAT | 0.0 | No tech constraints |
| DATA | 0.6 | habits + check-offs implied, but not explicit |
| MEASURE | 0.0 | No success metrics |

**Expected questions generated:** 5-6 (LOOK, HOW_BIG, WITH_WHAT, DATA, MEASURE, maybe WHO)

**ISSUE FOUND:** The CAT prompt doesn't tell the AI what to do when `platform` is "desktop" — it only lists web/mobile/both/api. Scenario C would have "desktop" passed in but the scoring dimension descriptions don't account for local-first architecture implications.

### Phase 2: Doc Generation — Context Assembly

The context passed to each stage prompt:
```
PRODUCT PITCH: A habit tracking app for people who want to build daily streaks...
V1 SCOPE: User signs up, creates habits with names and frequency...
PLATFORM: web

ADAPTIVE SURVEY RESPONSES:
{
  "cat_1": "clean",          // LOOK: Clean & Professional
  "cat_2": "hundreds",       // HOW_BIG: Hundreds of users
  "cat_3": "",               // WITH_WHAT: "No constraints"
  "cat_4": "medium",         // DATA: 3-5 related things
  "cat_5": "daily_active"    // MEASURE: Daily active users
}

FINAL CLARIFICATION: Email/password auth
```

### Stage 1: Requirements Definition

**System prompt evaluation:**
- Prompt is generic: "Guide users through: 1. User personas, 2. Core functionality mapping..."
- It's written for **conversational mode** (asks clarifying questions) but used in **single-shot generation mode** (receives full context, must produce document)
- **CRITICAL BUG:** The prompt says "Ask clarifying questions" but the generation pipeline sends a single user message and expects a complete document back. No conversation happens.

**Expected output quality:** Mediocre. The prompt will produce a document but it won't be structured optimally because the system prompt was designed for chat, not document generation.

**FIX NEEDED:** Stage 1 needs a separate prompt for single-shot doc generation vs. conversational mode.

### Stage 2: Product Requirements Document

**System prompt evaluation:**
- Same problem as Stage 1 — the prompt has `<CRITICAL_INSTRUCTION>` about counting user messages and asking one question at a time. This is entirely irrelevant in single-shot generation mode.
- The doc generation endpoint sends ONE user message with full context → the prompt will try to ask a question instead of generating a PRD.
- **CRITICAL BUG:** The PRD prompt checks "If USER messages < 6: Ask ONE question ONLY" — in single-shot mode there's exactly 1 user message, so the AI will ask a question instead of generating the PRD.

**Expected output:** A question, not a PRD. This is broken.

**FIX NEEDED:** Either:
1. Add a doc-gen-specific system prompt for Stage 2
2. Or prepend a override instruction to the user message: "Generate the complete PRD now. Do NOT ask questions."

### Stage 3: UI Design & Wireframes

**System prompt evaluation:**
- Also written for chat mode ("Ask the user about: Which pages/screens...")
- In single-shot mode, it may produce HTML wireframes but might also try to ask questions first
- The orange color scheme (#FF6B35) is hardcoded — doesn't respect the user's LOOK preference from CAT survey
- **ISSUE:** If user selected "Dark & Premium" style in CAT survey, wireframes will still be orange

**FIX NEEDED:** Inject the user's style preference into the wireframe generation prompt.

### Stage 4: System Architecture

**System prompt evaluation:**
- Best of the bunch — actually gives clear output format expectations
- Assumptions transparency format is well-defined
- **MINOR ISSUE:** References "UI wireframes from previous stage" but previous stage output is in HTML — the architecture prompt needs to parse HTML to extract UI elements. This works fine since Claude can read HTML.

**Expected output:** Good quality. The assumptions blocks will be valuable.

### Stage 5: Coding Prompts

**System prompt evaluation:**
- Very thin: "Generate optimized prompts for: 1. Model-specific system instructions..."
- No structure guidance, no format specification, no examples
- **ISSUE:** Doesn't specify what "optimized" means. For a habit tracker, should this generate prompts for React components? API routes? Database schema? The prompt doesn't say.
- **ISSUE:** "Optimize for the selected AI model" — but which model? The prompt doesn't receive model information.
- **ISSUE:** Doesn't reference which IDE tools to target (Claude Code, Cursor, etc.)

**Expected output:** Generic, unfocused coding prompts that may or may not be useful for actual implementation.

**FIX NEEDED:** Major rewrite. Should specify:
- Output format (task list? numbered prompts? per-component?)
- What components to target (based on architecture from Stage 4)
- What tool to optimize for
- Include file paths and actual implementation steps

### Stage 6: Development Guide

**System prompt evaluation:**
- Also thin: "Create a comprehensive implementation guide with: 1. Development phases..."
- No format guidance
- No reference to previous stages (should incorporate architecture decisions)
- "Provide actionable steps with clear success criteria" is good but vague

**Expected output:** Decent but generic. Without explicit format, the AI will produce its own structure which may vary wildly between runs.

### Stage 7: Project Rules File

**System prompt evaluation:**
- Best-structured prompt in the entire set
- Clear output sections with headers
- Specific guidelines (60 lines, "Do NOT" list, actual commands)
- **MINOR ISSUE:** Doesn't specify CURSORRULES MDC format structure. "MDC format with frontmatter" is vague — should provide an example.

**Expected output:** Good quality, but CURSORRULES format may be wrong without a concrete example.

---

## Pipeline Trace: Scenario B (Scattered Team Docs)

### Entry B: Problem → Solution Proposals

**System prompt evaluation:**
- Well-structured, clear JSON output format
- "2-3 distinct solution approaches as buildable software products" is specific
- **ISSUE:** Doesn't inject the user's platform preference (they haven't chosen one yet at this point — correct behavior)

**Expected proposals for "scattered team docs":**
1. "Doc Finder" — AI-powered search aggregator across Google Docs, Notion, Confluence, Slack
2. "Team Wiki" — Single source of truth wiki with auto-import from existing tools
3. "Knowledge Bot" — Slack/Teams bot that answers questions by searching across all doc sources

**Quality assessment:** These would be good. The prompt is well-designed for this use case.

**ISSUE:** After user picks an approach, it pre-fills Q1 (pitch). But the `solutionApproach` data (title, summary, keyFeatures, techDirection) is saved on the project but **never injected into the generation context**. Look at lines 1025-1051 of routes.ts — it builds context from `minimumDetails`, `catResponses`, `confirmationAnswer`, `appStyle`, and `uploadedDocs` — but NOT `solutionApproach`.

**FIX NEEDED:** Add `solutionApproach` to the context assembly in the doc generation endpoint.

---

## Pipeline Trace: Scenario C (Personal Health Journal — Local-First)

### CAT Survey Generation

**ISSUE:** Platform "desktop" isn't in the CAT prompt's dimension scoring examples. The WHERE dimension scoring will be uncertain because the prompt only lists web/mobile/both/api.

**ISSUE:** "Local-first" has major architectural implications (SQLite, encryption at rest, no server, sync optional) but the DATA dimension doesn't account for local storage patterns. A question about data sync strategy is missing.

### Stage 4: Architecture — Local-First Implications

**System prompt evaluation:**
- Doesn't mention local-first architecture patterns
- Will likely suggest PostgreSQL + cloud deployment by default
- The assumptions transparency format should catch this (user can override), but ideally the prompt should recognize "desktop / local" platform and adjust recommendations

**FIX NEEDED:** Add local-first patterns to Stage 4 prompt when platform is "desktop":
- SQLite/IndexedDB/etc.
- Encryption at rest
- Optional sync (CRDTs, etc.)
- Desktop frameworks (Electron, Tauri, etc.)

---

## Summary of Issues Found

### Critical (will produce wrong output)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Stages 1-3 prompts designed for chat, used in single-shot** | DEFAULT_STAGES 1-3 | Stage 2 will ask questions instead of generating PRD |
| 2 | **solutionApproach not injected into generation context** | routes.ts:1025-1051 | Entry B users lose their selected approach context |
| 3 | **max_tokens: 4096** is too low for comprehensive docs | ai.ts:62 | Architecture docs and PRDs will be truncated mid-sentence |

### High (significantly degrades output quality)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 4 | **Stage 5 (Coding Prompts) prompt too vague** | DEFAULT_STAGES[4] | Produces generic, unfocused output |
| 5 | **Style preference not injected into wireframe generation** | Stage 3 prompt | Wireframes always orange regardless of user's style choice |
| 6 | **"desktop" platform not handled in CAT dimension scoring** | ai.ts:172-225 | Local-first apps get inappropriate questions |
| 7 | **Stage 6 (Dev Guide) prompt too vague** | DEFAULT_STAGES[5] | No format consistency between runs |

### Medium (noticeable quality gap)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 8 | **No example of MDC format for CURSORRULES** | Stage 7 prompt | Cursor rules format may be wrong |
| 9 | **detailLevel instruction is prepended, not part of system prompt** | routes.ts:1054-1056 | AI may ignore detail level |
| 10 | **CAT survey N/A answers serialized as empty strings** | session-survey.tsx | AI can't distinguish "skipped" from "empty answer" |
| 11 | **No streaming — 7 stages generate sequentially** | routes.ts:1061-1096 | User waits with no progress feedback per-stage |

---

## Recommended Fixes (Priority Order)

### Fix 1: Dual-Mode Prompts for Stages 1-3

Add a `docGenPrompt` field to stages that's used in single-shot generation instead of `systemPrompt`:

**Stage 1 doc-gen prompt:**
```
You are a senior product manager. Generate a comprehensive Requirements Definition document.

Structure your output as:
## Target Users & Personas
## Problem Statement
## Use Cases (prioritized)
## MVP Scope
## Success Metrics
## Technical Constraints
## Out of Scope for V1

Be specific to THIS product. Reference the user's pitch and scope directly.
Don't add features the user didn't mention.
```

**Stage 2 doc-gen prompt:**
```
You are a product manager. Generate a complete Product Requirements Document.

Structure your output as:
## Executive Summary
## User Stories (as "As a [user], I want [action] so that [benefit]")
## Feature Requirements (prioritized: Must/Should/Could/Won't)
## User Flows (step-by-step for each key workflow)
## Non-Functional Requirements
## Acceptance Criteria
## Dependencies & Risks

Use the product context provided. Be specific, not generic.
Write user stories that reference actual features from the V1 scope.
```

**Stage 3 doc-gen prompt:**
```
You are a UI/UX designer. Generate a UI specification with wireframe descriptions.

Reference the user's style preference if provided. If no style specified, use Clean & Professional.

Structure your output as:
## Design Direction
(Color palette, typography feel, layout approach based on style preference)

## Screen Inventory
(List all screens needed for the V1 scope)

## Screen Specifications
For each screen:
### [Screen Name]
- Purpose: what the user does here
- Layout: header, sidebar, content area, etc.
- Key elements: buttons, forms, lists, cards
- Interactions: what happens when user acts
- Mobile considerations

## Navigation Map
(How screens connect)

## Design Tokens
(Colors, spacing, typography values)

Generate simple HTML wireframes ONLY if the product is a web app.
For mobile/desktop, provide detailed layout descriptions instead.
```

### Fix 2: Increase max_tokens

```typescript
// ai.ts line 62
max_tokens: 8192, // was 4096 — comprehensive docs need more room
```

For Stage 7 (multi-format output), consider 12288.

### Fix 3: Inject solutionApproach into context

```typescript
// routes.ts ~line 1039, after uploadedDocs injection
const solutionApproach = project.solutionApproach as { title: string; summary: string; keyFeatures: string[] } | null;
if (solutionApproach) {
  contextParts.push(`\nSELECTED SOLUTION APPROACH:
Title: ${solutionApproach.title}
Summary: ${solutionApproach.summary}
Key Features: ${solutionApproach.keyFeatures.join(", ")}`);
}
```

### Fix 4: Rewrite Stage 5 (Coding Prompts)

```
You are an expert in AI-assisted development. Generate a structured set of implementation prompts
that a developer can feed to their AI coding tool (Claude Code, Cursor, Copilot) to build this product.

Structure your output as a numbered task list:

## Setup & Scaffolding
1. [Prompt for project initialization, including exact commands]
2. [Prompt for folder structure creation]

## Data Layer
3. [Prompt for database schema / data models]
4. [Prompt for API routes / data access]

## Core Features (one prompt per feature)
5-N. [Each feature gets its own prompt with: what to build, which files to create/modify,
      acceptance criteria, and edge cases to handle]

## Authentication & Security
[If applicable]

## Testing
[Prompts for writing tests for each major feature]

## Deployment
[Prompt for deployment setup]

RULES:
- Each prompt should be copy-pasteable into an AI coding tool
- Include specific file paths based on the architecture from Stage 4
- Include specific tech stack commands (not generic "install dependencies")
- Order matters: earlier prompts build foundations for later ones
- Each prompt should be self-contained enough to execute independently
```

### Fix 5: Style-Aware Wireframes

In the context assembly (routes.ts ~1041-1045), for Stage 3 specifically, transform the style into design guidance:

```typescript
if (stage.stageNumber === 3 && appStyle) {
  const styleGuides: Record<string, string> = {
    "clean": "Use a clean, professional aesthetic. Colors: navy/slate blues, minimal accent. Think: Linear, Notion, Stripe. Lots of whitespace, sharp corners, system fonts.",
    "warm": "Use a warm, friendly aesthetic. Colors: earth tones, soft oranges, cream backgrounds. Think: Mailchimp, Slack. Rounded corners, friendly illustrations.",
    "bold": "Use a bold, expressive aesthetic. Colors: vibrant primaries, high contrast. Think: Figma, Spotify. Strong typography, dynamic layouts.",
    "dark": "Use a dark, premium aesthetic. Colors: dark backgrounds, gold/silver accents. Think: Linear dark mode, GitHub dark. Subtle gradients.",
    "bright": "Use a bright, playful aesthetic. Colors: pastels or vivid hues, fun accents. Think: Duolingo, Notion templates. Rounded shapes, emoji-friendly.",
  };
  // Inject into the user message for Stage 3
}
```

### Fix 6: Platform-Aware Architecture

Add to Stage 4 system prompt:
```
PLATFORM-SPECIFIC GUIDANCE:
- If platform is "desktop" or "local": Recommend local-first architecture (SQLite/IndexedDB,
  desktop framework like Electron/Tauri, encryption at rest, optional sync with CRDTs)
- If platform is "mobile": Consider React Native, Flutter, or native.
  Account for offline-first, push notifications, app store requirements
- If platform is "api": Focus on API design, rate limiting, auth, documentation (OpenAPI)
- If platform is "web": Standard web architecture (SSR vs SPA, CDN, etc.)
```

### Fix 7: Stronger Stage 6 (Dev Guide)

```
You are a development project manager. Create a step-by-step implementation playbook.

Structure your output EXACTLY as:

## Phase 1: Foundation (Week 1)
### Tasks
- [ ] Task 1: [specific action with files/commands]
- [ ] Task 2: ...
### Definition of Done
[What must be true before moving to Phase 2]

## Phase 2: Core Features (Week 2-3)
[Same structure]

## Phase 3: Polish & Testing (Week 4)
[Same structure]

## Phase 4: Deployment (Week 4-5)
[Same structure]

## Testing Strategy
- Unit tests: [what to test, which framework]
- Integration tests: [key flows to test]
- Manual QA checklist: [critical paths]

## Environment Setup
- Development: [exact commands to set up local dev]
- Staging: [how to deploy to staging]
- Production: [deployment checklist]

## Monitoring
- Error tracking: [recommended tool]
- Analytics: [what to track]
- Uptime: [recommended tool]

Reference ACTUAL architecture decisions from Stage 4. Include ACTUAL file paths from Stage 5.
Every task should be specific enough that a developer knows exactly what to do.
```

### Fix 8: N/A Signal in CAT Responses

In session-survey.tsx, when serializing N/A answers:
```typescript
// Instead of empty string, use explicit signal
if (isNA) {
  answers[questionId] = "__NA__";  // Clear signal to AI
}
```

And in the generation context, add a note:
```
Note: Survey responses marked "__NA__" mean the user explicitly chose "Not applicable" —
do not try to infer or fill in these dimensions.
```

---

## Combined Output Quality Assessment

### What you'd get TODAY with these prompts (before fixes):

| Stage | Scenario A (Habit Tracker) | Scenario B (Team Docs) | Scenario C (Health Journal) |
|-------|---------------------------|----------------------|---------------------------|
| 1: Requirements | Passable — may ask questions instead of generating | Missing solution approach context | Passable |
| 2: PRD | **BROKEN** — will ask a question | **BROKEN** — same | **BROKEN** — same |
| 3: UI/UX | Orange wireframes regardless of style choice | Same issue | HTML wireframes for a desktop app (wrong format) |
| 4: Architecture | Good — assumptions are valuable | Good | **Misses local-first** — will suggest cloud |
| 5: Coding Prompts | Vague, generic | Vague | Vague |
| 6: Dev Guide | Unstructured | Unstructured | Unstructured |
| 7: Rules File | Good structure, may hit token limit | Good | Good, but tech stack may be wrong (from Stage 4) |

### What you'd get AFTER fixes:

| Stage | Expected Quality |
|-------|-----------------|
| 1: Requirements | Structured, specific to product |
| 2: PRD | Complete PRD with user stories referencing actual features |
| 3: UI/UX | Style-matched, platform-appropriate |
| 4: Architecture | Platform-aware with transparent assumptions |
| 5: Coding Prompts | Copy-pasteable task list for AI tools |
| 6: Dev Guide | Week-by-week playbook with specific tasks |
| 7: Rules File | Multi-format, project-specific, accurate |

---

## Implementation Priority

1. **Fix 1** (dual-mode prompts) — Stage 2 is literally broken in single-shot mode
2. **Fix 2** (max_tokens) — docs getting truncated is invisible but deadly
3. **Fix 3** (solutionApproach context) — Entry B flow loses critical context
4. **Fix 4** (Stage 5 rewrite) — highest impact on "vibe code" output quality
5. **Fix 5** (style-aware wireframes) — respects user's CAT survey answer
6. **Fix 6** (platform-aware architecture) — critical for desktop/local apps
7. **Fix 7** (Stage 6 structure) — consistency and actionability
8. **Fix 8** (N/A signal) — minor but prevents confusion
