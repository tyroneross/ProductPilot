/**
 * Adaptive-intake regenerate routing — fix-pack 2026-05-08.
 *
 * Asserts that POST /api/projects/:projectId/generate-docs-from-survey now
 * accepts adaptive-mode projects (no surveyDefinition / surveyResponses
 * columns) by synthesizing the survey shape from
 * productState.workingMemory.intakeAnswers[]. Before the fix this returned
 * 400 "Survey not completed" because the legacy guard required both columns.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";
import { ProductStateSchema } from "@shared/schema";

vi.mock("../auth", () => ({
  extractUser: (req: any, _res: any, next: any) => {
    const u = req.headers["x-test-user"];
    if (typeof u === "string" && u !== "") {
      req.userId = u;
      req.user = { id: u, email: `${u}@test.local` };
    }
    next();
  },
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    next();
  },
  trustedOrigins: ["http://localhost:5173"],
}));

vi.mock("../storage-hybrid", () => {
  const audit: any[] = [];
  const projectsById: Record<string, any> = {};
  const stagesByProject: Record<string, any[]> = {};
  const messages: any[] = [];

  return {
    runWithDbActorContext: <T,>(_ctx: any, cb: () => T) => cb(),
    updateDbActorContext: () => {},
    storage: {
      getProject: vi.fn(async (id: string) => projectsById[id]),
      getProjectsByUserId: vi.fn(async () => []),
      getProjectsByGuestOwnerId: vi.fn(async () => []),
      getUserDraft: vi.fn(async () => undefined),
      createProject: vi.fn(async () => ({})),
      updateProject: vi.fn(async (id: string, updates: any) => {
        projectsById[id] = { ...projectsById[id], ...updates };
        return projectsById[id];
      }),
      deleteProject: vi.fn(async () => true),
      getStagesByProject: vi.fn(async (id: string) => stagesByProject[id] ?? []),
      ensureStagesForProject: vi.fn(async () => []),
      getStage: vi.fn(),
      updateStage: vi.fn(async () => {}),
      getMessagesByStage: vi.fn(async () => []),
      getDeliverablesByStage: vi.fn(async (stageId: string) =>
        messages
          .filter((m: any) => m.stageId === stageId && m.kind === "deliverable")
          .sort((a: any, b: any) => (a.version ?? 1) - (b.version ?? 1)),
      ),
      createMessage: vi.fn(async (m: any) => {
        messages.push(m);
        return { id: `m-${messages.length}`, ...m };
      }),
      getAllAdminPrompts: vi.fn(async () => []),
      getAdminPrompt: vi.fn(),
      getAdminPromptByTargetKey: vi.fn(async () => undefined),
      createAdminPrompt: vi.fn(),
      updateAdminPrompt: vi.fn(),
      deleteAdminPrompt: vi.fn(),
      seedDefaultPrompts: vi.fn(),
      getUserSettings: vi.fn(async () => undefined),
      upsertUserSettings: vi.fn(),
      createLlmCall: vi.fn(async () => {}),
      listLlmCalls: vi.fn(async () => ({ rows: [], total: 0 })),
      getLlmCall: vi.fn(),
      createAuditEvent: vi.fn(async (event: any) => { audit.push(event); }),
      listAuditEvents: vi.fn(async () => ({ rows: audit, total: audit.length })),
      getAuditEvent: vi.fn(),
      createIntakeQuestion: vi.fn(),
      updateIntakeQuestionAnswer: vi.fn(),
      getIntakeQuestionsByProject: vi.fn(async () => []),
    },
    __testProjects: projectsById,
    __testStages: stagesByProject,
    __testAudit: audit,
    __testMessages: messages,
  };
});

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real,
    aiService: {
      ...real.aiService,
      chat: vi.fn(async () => ({ content: "Generated test document content." })),
      generateStructuredOutput: vi.fn(async () => ({})),
      calculateProgress: vi.fn(async () => 100),
    },
  };
});

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;
let testProjects: Record<string, any>;
let testStages: Record<string, any[]>;

beforeEach(async () => {
  vi.resetModules();
  const { registerRoutes } = await import("../routes");
  const storageMod = await import("../storage-hybrid");
  testProjects = (storageMod as any).__testProjects;
  testStages = (storageMod as any).__testStages;
  for (const k of Object.keys(testProjects)) delete testProjects[k];
  for (const k of Object.keys(testStages)) delete testStages[k];

  const app = express();
  app.use(express.json());
  await registerRoutes(app);

  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const addr = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

async function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/projects/:projectId/generate-docs-from-survey — adaptive intake", () => {
  it("returns 400 with adaptive_intake_incomplete when adaptive project has no intakeAnswers yet", async () => {
    testProjects["pA1"] = {
      id: "pA1",
      userId: "ownerA",
      guestOwnerId: null,
      name: "Adaptive Empty",
      description: "test",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyDefinition: null,
      surveyResponses: null,
      productState: ProductStateSchema.parse({}),
      intakeMode: "adaptive",
      customPrompts: null,
      minimumDetails: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    testStages["pA1"] = [];

    const res = await post(
      "/api/projects/pA1/generate-docs-from-survey",
      { documentPreferences: [] },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("adaptive_intake_incomplete");
  });

  it("returns 200 for adaptive project with captured intakeAnswers", async () => {
    const productState = ProductStateSchema.parse({
      workingMemory: {
        intakeAnswers: [
          {
            step: "PRIMARY_PERSONA",
            method: "JTBD",
            question: "Who is the primary user?",
            answer: "Solo product builders prototyping new ideas.",
            metadata: { topic: "primary_persona_and_trigger" },
            answeredAt: new Date().toISOString(),
          },
          {
            step: "MVP_SCOPE",
            method: null,
            question: "What's in V1 scope?",
            answer: "Idea capture + 6-stage doc generation.",
            metadata: {},
            answeredAt: new Date().toISOString(),
          },
        ],
      },
    });

    testProjects["pA2"] = {
      id: "pA2",
      userId: "ownerA",
      guestOwnerId: null,
      name: "Adaptive With Answers",
      description: "test",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyDefinition: null,
      surveyResponses: null,
      productState,
      intakeMode: "adaptive",
      customPrompts: null,
      minimumDetails: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    testStages["pA2"] = [
      {
        id: "stage1",
        projectId: "pA2",
        stageNumber: 1,
        title: "Requirements Definition",
        description: "Stage 1",
        progress: 0,
        systemPrompt: "You are a doc generator.",
        aiModel: null,
      },
    ];

    const res = await post(
      "/api/projects/pA2/generate-docs-from-survey",
      { documentPreferences: [{ stageId: "stage1", detailLevel: "detailed" }] },
      { "x-test-user": "ownerA" },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/generated/i);
    // succeeded counter present (added in the existing fix-pack edits)
    expect(body.succeeded).toBe(1);
  });

  it("legacy survey path still works (surveyDefinition + surveyResponses present)", async () => {
    testProjects["pL1"] = {
      id: "pL1",
      userId: "ownerA",
      guestOwnerId: null,
      name: "Legacy Survey",
      description: "test",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyDefinition: { questions: [{ id: "q1", text: "What?" }] },
      surveyResponses: { q1: "An app." },
      productState: null,
      intakeMode: "survey",
      customPrompts: null,
      minimumDetails: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    testStages["pL1"] = [
      {
        id: "stageL1",
        projectId: "pL1",
        stageNumber: 1,
        title: "Requirements Definition",
        description: "Stage 1",
        progress: 0,
        systemPrompt: "Sys.",
        aiModel: null,
      },
    ];

    const res = await post(
      "/api/projects/pL1/generate-docs-from-survey",
      { documentPreferences: [{ stageId: "stageL1", detailLevel: "detailed" }] },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(200);
  });
});
