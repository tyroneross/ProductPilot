/**
 * Synthetic product-idea fixtures for Phase 0 eval harness.
 *
 * Provenance: all fixtures are fully synthetic. No real product names,
 * no proprietary references, no PII-shaped strings, no .env-style tokens.
 * Reviewed manually before commit — all generic.
 *
 * simulatedDiscoveryAnswers: pre-baked user turn-by-turn replies fed to
 * buildSurveyGenerationPrompt as message history. Each entry represents
 * one user message in the discovery conversation.
 *
 * simulatedSurveyResponses: pre-baked answers keyed by question id,
 * fed as surveyResponses to buildDocumentGenerationPrompt.
 */

import { z } from "zod";
import type { Message } from "@shared/schema";

// Fixture schema — fixtures validated against this at startup.
//
// platformTarget defaults to 'web' for backward compatibility with the original
// 5 archetypes (Phase 0). Phase 3 added 4 cross-platform archetypes; each
// declares its target explicitly so the linter can apply per-platform rules.
export const SampleProductSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  archetype: z.enum([
    "clear-b2b-saas",
    "fuzzy-consumer",
    "internal-workflow",
    "ai-automation",
    "data-heavy-dashboard",
    // Cross-platform archetypes added 2026-05-02.
    "ios-native-app",
    "macos-native-app",
    "vite-spa",
    "claude-plugin",
  ]),
  platformTarget: z
    .enum(["web", "vite-spa", "ios", "macos", "claude-plugin"])
    .default("web"),
  initialIdea: z.string().min(10),
  simulatedDiscoveryAnswers: z.array(z.string()).min(1),
  simulatedSurveyResponses: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string()), z.number()]),
  ),
});

export type SampleProduct = z.infer<typeof SampleProductSchema>;

// Phase 0 shipped 5 fixtures; Phase 3 cross-platform expansion adds 4 more.
export const SampleProductsSchema = z.array(SampleProductSchema).length(9);

/**
 * Build a Message array from pre-baked discovery answers.
 * Simulates a back-and-forth: the eval feeds user answers; the assistant
 * questions are implied (we do not re-run discovery chat live, we just
 * pass the accumulated user-turn history to buildSurveyGenerationPrompt).
 */
export function buildSimulatedDiscoveryMessages(
  answers: string[],
): Message[] {
  return answers.map((answer, i) => ({
    id: `sim-msg-${i}`,
    stageId: "sim-stage",
    role: "user" as const,
    content: answer,
    kind: "chat" as const,
    version: 1,
    createdAt: new Date(),
  }));
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: "pp-01",
    label: "TeamTrack",
    archetype: "clear-b2b-saas",
    platformTarget: "web",
    initialIdea:
      "A tool for small engineering teams to run async standups — members post weekly goals and blockers, and the tool surfaces patterns and blockers to the team lead.",
    simulatedDiscoveryAnswers: [
      "Teams of 4 to 12 engineers, fully remote, distributed across at least two time zones.",
      "The main problem is that daily standups waste 20 minutes of everyone's time and half the updates are irrelevant to most people on the call.",
      "I want members to post their goal and any blockers once a week, and the tool should roll them up into a digest the lead reviews on Monday morning.",
      "Must integrate with the tools they already use — at minimum read from a project tracker so people do not have to re-enter task names.",
      "V1 scope: async text posts, weekly digest email, blocker flagging. No video, no real-time chat.",
    ],
    simulatedSurveyResponses: {
      q1: ["blocker-flagging", "weekly-digest", "tracker-integration"],
      q2: "email",
      q3: 8,
      q4: "per-seat-monthly",
    },
  },
  {
    id: "pp-02",
    label: "HabitFlow",
    archetype: "fuzzy-consumer",
    platformTarget: "web",
    initialIdea:
      "An app that helps people build better daily habits, but in a fun way — maybe with streaks or social accountability. Not sure exactly what makes it different yet.",
    simulatedDiscoveryAnswers: [
      "Mostly adults who want to build a morning routine or fitness habits. Age range is probably 25 to 45.",
      "They start strong for a few days and then fall off. The apps out there feel like chores.",
      "I think the social piece matters — sharing a streak with a friend makes you not want to break it.",
      "Mobile first, iOS to start. Maybe Android later.",
    ],
    simulatedSurveyResponses: {
      q1: ["streak-tracking", "friend-accountability", "daily-reminders"],
      q2: "ios",
      q3: "free-with-premium",
      q4: 5,
    },
  },
  {
    id: "pp-03",
    label: "InvoiceBot",
    archetype: "internal-workflow",
    platformTarget: "web",
    initialIdea:
      "An internal tool for our finance team to automate invoice approval routing. Right now approvals sit in inboxes for days because nobody knows who should sign off.",
    simulatedDiscoveryAnswers: [
      "Finance team of 6 people, two approvers at different spend thresholds — under 5k and over 5k require different sign-offs.",
      "Invoices come in via email as PDFs. Someone manually forwards them to the right person. That person approves or rejects in email and forwards the result back.",
      "We need the tool to parse the invoice amount, route to the right approver, collect the approval or rejection with a reason, and log everything for the audit trail.",
      "Must tie into our accounting system for the final entry. We use a mid-market accounting platform, not a startup tool.",
      "Compliance requires we keep a 7-year log of every approval decision with the approver identity and timestamp.",
    ],
    simulatedSurveyResponses: {
      q1: ["pdf-parsing", "threshold-routing", "audit-log"],
      q2: "web",
      q3: "accounting-system-integration",
      q4: 7,
    },
  },
  {
    id: "pp-04",
    label: "ContentPilot",
    archetype: "ai-automation",
    platformTarget: "web",
    initialIdea:
      "An AI-powered tool that takes a one-paragraph content brief and generates a week of social media posts — captions, hashtags, scheduling — so small brand teams do not have to write each post manually.",
    simulatedDiscoveryAnswers: [
      "Small brand and marketing teams at consumer product companies — typically one to three people managing social for the brand.",
      "Writing posts takes hours each week. The real bottleneck is not ideas, it is the mechanical work of formatting each post for each platform.",
      "The AI should adapt tone per platform — more casual on one, more polished on another. The human reviews and approves before anything goes live.",
      "Needs to schedule directly to at least two major platforms without requiring the user to copy-paste.",
    ],
    simulatedSurveyResponses: {
      q1: ["multi-platform-scheduling", "tone-adaptation", "human-review-step"],
      q2: ["platform-a", "platform-b"],
      q3: "subscription-monthly",
      q4: 3,
    },
  },
  {
    id: "pp-05",
    label: "DataLens",
    archetype: "data-heavy-dashboard",
    platformTarget: "web",
    initialIdea:
      "A dashboard for operations teams to monitor data quality across multiple upstream data sources — catch missing values, schema drift, and anomalies before they hit production reports.",
    simulatedDiscoveryAnswers: [
      "Data and ops teams at mid-size companies — typically analysts or data engineers who own the pipelines.",
      "They discover data quality problems after the fact, when a report is wrong or a downstream system fails. There is no proactive alerting.",
      "Key metrics: completeness rate per column, schema change detection, row-count trend anomalies, freshness lag.",
      "Must connect to at least two data warehouse types. REST API for custom sources. Alerting via webhook or email.",
      "Teams run 10 to 50 monitored datasets. Need per-dataset health scores and an org-level rollup view.",
    ],
    simulatedSurveyResponses: {
      q1: ["schema-drift-detection", "freshness-monitoring", "anomaly-alerts"],
      q2: "web-dashboard",
      q3: ["warehouse-type-a", "warehouse-type-b", "rest-api"],
      q4: 9,
    },
  },
  // ───────────────────────────────────────────────────────────────────────
  // Cross-platform fixtures (Phase 3 — 2026-05-02).
  //
  // Each declares platformTarget so the linter can apply per-platform rules:
  //   ios / macos     → expects XCTest or Swift Testing references
  //   vite-spa        → expects Vitest (preferred) or Playwright
  //   claude-plugin   → expects plugin-builder validators (manifest/skill/hook/command)
  //
  // All synthetic. No real product names. Reviewed manually before commit.
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "pp-06",
    label: "DailyJot",
    archetype: "ios-native-app",
    platformTarget: "ios",
    initialIdea:
      "A local-first journaling app for iPhone where entries stay on-device by default. Quick-capture during the day, evening reflection prompt, weekly summary on Sunday.",
    simulatedDiscoveryAnswers: [
      "Adults who already journal on paper but want the search and tagging that paper cannot give them. Privacy-conscious; iCloud sync only if they opt in.",
      "Most journaling apps push everything to a cloud account immediately. That kills the trust required to write honestly.",
      "V1 scope: text entries, optional voice memo with on-device transcription, daily prompt, weekly summary. No social features, no AI-generated entries.",
      "Must support Dynamic Type from XS to XXXL and full VoiceOver navigation. Haptics on save and on weekly-summary unlock.",
      "Pricing: one-time purchase, no subscription. iCloud sync ships behind a toggle off by default.",
    ],
    simulatedSurveyResponses: {
      q1: ["voice-memo-transcription", "weekly-summary", "icloud-optional-sync"],
      q2: "iphone-only-v1",
      q3: "one-time-purchase",
      q4: 6,
    },
  },
  {
    id: "pp-07",
    label: "FocusBar",
    archetype: "macos-native-app",
    platformTarget: "macos",
    initialIdea:
      "A macOS menu-bar utility that shows a single focus block — current task, time remaining, and a kill switch for distracting apps. No window, no dock icon, lives in the menu bar.",
    simulatedDiscoveryAnswers: [
      "Knowledge workers who already block focus time on their calendar but want a single visible source of truth on screen.",
      "Existing apps put a giant timer in the middle of the screen which itself becomes a distraction. We want something glanceable in the menu bar.",
      "V1 scope: 25/50/90 minute presets, app-blocking via Screen Time API, keyboard shortcut to start/stop, no analytics.",
      "Must follow HIG for menu bar utilities — NSStatusItem with template image, accessory view popover, no main window.",
      "Should respect Reduce Motion and Increase Contrast accessibility preferences. Keyboard-first with full menu-bar keyboard navigation.",
    ],
    simulatedSurveyResponses: {
      q1: ["menu-bar-only", "screen-time-api-blocking", "keyboard-shortcuts"],
      q2: "macos-13-plus",
      q3: "one-time-purchase",
      q4: 4,
    },
  },
  {
    id: "pp-08",
    label: "RouteMath",
    archetype: "vite-spa",
    platformTarget: "vite-spa",
    initialIdea:
      "A static single-page app for solo runners to plan a route and see grade-adjusted pace estimates. No login, no backend, runs entirely in the browser using a public map tile service.",
    simulatedDiscoveryAnswers: [
      "Recreational runners who already know their average pace and want a quick what-if calculator before a long run.",
      "Existing tools require an account and upload your data to a server. We want zero-account, zero-tracking, opens-instantly.",
      "V1 scope: click-to-add waypoints on a map, fetch elevation, compute grade-adjusted pace, export GPX. No history, no sync.",
      "Build is plain Vite + React + Vitest. No SSR, no Next.js. Bundle size budget under 250 KB gzipped.",
      "Hosting on a static CDN. Map tiles via a free OpenStreetMap-compatible tile provider with attribution.",
    ],
    simulatedSurveyResponses: {
      q1: ["waypoint-routing", "grade-adjusted-pace", "gpx-export"],
      q2: "static-spa",
      q3: "free-no-account",
      q4: 5,
    },
  },
  {
    id: "pp-09",
    label: "PrChirp",
    archetype: "claude-plugin",
    platformTarget: "claude-plugin",
    initialIdea:
      "A Claude Code plugin that summarizes a stack of open PRs in a repo, ranks them by review-readiness, and offers a single command to draft review comments for the most stale ones.",
    simulatedDiscoveryAnswers: [
      "Engineers on small teams (3 to 10 people) who do peer review but lose track of which PRs have been waiting longest.",
      "GitHub's review queue does not surface staleness, only assignment. We want a daily digest in Claude Code that says 'review this one first'.",
      "V1 scope: one slash command to list ranked PRs, one to draft a review for a chosen PR. Two MCP tools wrapping the GitHub REST API. One skill defining the ranking heuristic.",
      "Plugin manifest must declare commands, skills, and the GitHub-token hook that loads the user's existing gh-cli auth. No bundled OAuth flow.",
      "Fail safely if gh-cli is not installed — emit a single instruction message, do not crash the plugin.",
    ],
    simulatedSurveyResponses: {
      q1: ["staleness-ranking", "draft-review-comments", "gh-cli-auth"],
      q2: "claude-code-plugin",
      q3: "free-open-source",
      q4: 7,
    },
  },
];

// Validate all fixtures at module load time — fails fast if a fixture is malformed.
SampleProductsSchema.parse(SAMPLE_PRODUCTS);
