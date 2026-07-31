/**
 * Coercion coverage for the best-worst (MaxDiff) scope question.
 *
 * The option set is LLM-generated, which means it silently defines the design
 * space the user chooses within and anchors their answer. A malformed or
 * degenerate set is worse than no question at all: it produces a ranking that
 * looks like signal and is noise, and that ranking then lands in the spec as
 * MVP scope and non-goals.
 *
 * These pin the coercion rules that decide whether a set is shown.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";

let structuredResult: any = {};

vi.mock("../auth", () => ({
  extractUser: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, res: any) => res.status(401).json({ message: "Authentication required" }),
  trustedOrigins: ["http://localhost:5173"],
}));

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real,
    aiService: {
      ...real.aiService,
      chat: vi.fn(),
      generateStructuredOutput: vi.fn(async () => structuredResult),
    },
  };
});

vi.mock("../storage-hybrid", () => ({
  runWithDbActorContext: <T,>(_c: any, cb: () => T) => cb(),
  updateDbActorContext: () => {},
  storage: {
    getUserSettings: vi.fn(async () => null),
    getProject: vi.fn(), getProjectsByUserId: vi.fn(async () => []),
    getProjectsByGuestOwnerId: vi.fn(async () => []), claimProjectsForUser: vi.fn(async () => []),
    getOpsSummary: vi.fn(), updateProject: vi.fn(), createAuditEvent: vi.fn(async () => {}),
    getStagesByProject: vi.fn(async () => []), ensureStagesForProject: vi.fn(async () => []),
    createStage: vi.fn(), getStage: vi.fn(), updateStage: vi.fn(), createMessage: vi.fn(),
    getMessagesByStage: vi.fn(async () => []), getDeliverablesByStage: vi.fn(async () => []),
    getAllAdminPrompts: vi.fn(async () => []), getAdminPromptByTargetKey: vi.fn(),
    getAdminPrompt: vi.fn(), createAdminPrompt: vi.fn(), updateAdminPrompt: vi.fn(),
    deleteAdminPrompt: vi.fn(), seedDefaultPrompts: vi.fn(), upsertUserSettings: vi.fn(),
    createLlmCall: vi.fn(async () => {}), listLlmCalls: vi.fn(async () => ({ rows: [], total: 0 })),
    getLlmCall: vi.fn(), listAuditEvents: vi.fn(async () => ({ rows: [], total: 0 })),
    getAuditEvent: vi.fn(), getUserDraft: vi.fn(), createProject: vi.fn(), deleteProject: vi.fn(),
    createIntakeQuestion: vi.fn(), updateIntakeQuestionAnswer: vi.fn(),
    getIntakeQuestionsByProject: vi.fn(async () => []),
  },
}));

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;

const BASE_QUESTIONS = [
  { id: "audience", question: "Who is this for?", chips: ["Coaches", "Clients", "Both"] },
  { id: "platform", question: "Where first?", chips: ["Web", "iOS", "Android"] },
];

beforeEach(async () => {
  vi.resetModules();
  structuredResult = {};
  const { registerRoutes } = await import("../routes");
  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  server = createServer(app);
  await new Promise<void>((r) => server!.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((r) => server?.close(() => r()));
  vi.restoreAllMocks();
});

async function clarify(idea = "an app that tracks client progress") {
  const res = await fetch(`${baseUrl}/api/clarify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  return res.json();
}

describe("scopeRanking — a usable option set is returned", () => {
  it("returns four options and the prompt", async () => {
    structuredResult = {
      needsClarification: true,
      summary: "Track client progress.",
      questions: BASE_QUESTIONS,
      scopeRanking: {
        prompt: "Which matters MOST for v1 — and which LEAST?",
        options: [
          "Log a session note per client",
          "See progress over time",
          "Share a summary with the client",
          "Set and track goals",
        ],
      },
    };
    const body = await clarify();
    expect(body.scopeRanking.options).toHaveLength(4);
    expect(body.scopeRanking.prompt).toContain("MOST");
  });

  it("supplies a default prompt when the model omits one", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: ["A one", "B two", "C three", "D four"] },
    };
    const body = await clarify();
    expect(body.scopeRanking.prompt).toBeTruthy();
  });
});

describe("scopeRanking — degenerate sets are dropped, not degraded", () => {
  // A two-option "ranking" is just a binary choice wearing a ranking's clothes:
  // picking most and least says nothing a single tap would not have said.
  it("drops a set with fewer than three usable options", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: ["Only one", ""] },
    };
    expect((await clarify()).scopeRanking).toBeNull();
  });

  it("drops the ranking entirely when the model omits it", async () => {
    structuredResult = { needsClarification: true, questions: BASE_QUESTIONS };
    expect((await clarify()).scopeRanking).toBeNull();
  });

  it("drops a non-array options field rather than trusting it", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: "not an array" },
    };
    expect((await clarify()).scopeRanking).toBeNull();
  });

  // Duplicates would let the same capability be both most AND least.
  it("de-duplicates options and drops the set if too few survive", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: ["Same thing", "Same thing", "Same thing"] },
    };
    expect((await clarify()).scopeRanking).toBeNull();
  });

  it("keeps a de-duplicated set that still has three distinct options", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: ["Alpha", "Beta", "Alpha", "Gamma"] },
    };
    const body = await clarify();
    expect(body.scopeRanking.options).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("caps at four options so the comparison stays two taps", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: ["A", "B", "C", "D", "E", "F", "G"] },
    };
    expect((await clarify()).scopeRanking.options).toHaveLength(4);
  });

  it("truncates an over-long option rather than breaking the layout", async () => {
    structuredResult = {
      needsClarification: true,
      questions: BASE_QUESTIONS,
      scopeRanking: { options: ["x".repeat(400), "Beta", "Gamma", "Delta"] },
    };
    const body = await clarify();
    expect(body.scopeRanking.options[0].length).toBeLessThanOrEqual(60);
  });
});

describe("scopeRanking — never blocks the user", () => {
  it("returns null ranking when the LLM call fails, and still 200s", async () => {
    const ai = await import("../services/ai");
    (ai.aiService.generateStructuredOutput as any).mockRejectedValueOnce(new Error("provider down"));
    const res = await fetch(`${baseUrl}/api/clarify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "an app that tracks client progress" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scopeRanking).toBeNull();
    expect(body.needsClarification).toBe(false);
  });
});
