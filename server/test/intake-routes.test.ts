/**
 * Phase 2 — intake routes integration test.
 *
 * Asserts:
 *   - Unauthenticated request → 401.
 *   - Cross-tenant request (project owned by another user) → 403.
 *   - Authed owner request → 200 with the expected JSON shape.
 *   - 409 when project.intakeMode !== 'adaptive'.
 *   - audit_events row written on every request.
 *
 * Strategy: rather than spin up Better Auth + a real DB, we mock the auth middleware
 * and the storage layer at the module boundary, then boot an Express app via
 * registerRoutes. We poke the app via the global fetch API + http.createServer.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";
import { ProductStateSchema, SpecSchema } from "@shared/schema";

// ---------------------------------------------------------------------------
// Module mocks. Hoisted by Vitest so the controller picks the mocks up at import time.
// ---------------------------------------------------------------------------

vi.mock("../auth", () => ({
  // extractUser middleware reads the X-Test-User header into req.userId. Tests use
  // it to simulate an authed session without booting Better Auth.
  extractUser: (req: any, _res: any, next: any) => {
    const u = req.headers["x-test-user"];
    if (typeof u === "string" && u !== "") {
      req.userId = u;
      req.user = { id: u, email: `${u}@test.local` };
    }
    next();
  },
  // requireAuth — match the real signature; reject when no userId on req.
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    next();
  },
  trustedOrigins: ["http://localhost:5173"],
}));

vi.mock("../storage-hybrid", () => {
  const audit: any[] = [];
  const intakeQs: any[] = [];
  const projectsById: Record<string, any> = {};

  return {
    // No-op AsyncLocalStorage wiring — the test pretends RLS is satisfied.
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
      getStagesByProject: vi.fn(async () => []),
      ensureStagesForProject: vi.fn(async () => []),
      getStage: vi.fn(async () => undefined),
      updateStage: vi.fn(),
      getMessagesByStage: vi.fn(async () => []),
      createMessage: vi.fn(),
      getAllAdminPrompts: vi.fn(async () => []),
      getAdminPrompt: vi.fn(),
      getAdminPromptByTargetKey: vi.fn(),
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
      // Phase 2 intake methods
      createIntakeQuestion: vi.fn(async (row: any) => {
        const stamp = { id: `iq-${intakeQs.length + 1}`, ...row, createdAt: new Date(), answeredAt: row.answeredAt ?? null };
        intakeQs.push(stamp);
        return stamp;
      }),
      updateIntakeQuestionAnswer: vi.fn(),
      getIntakeQuestionsByProject: vi.fn(async (id: string) => intakeQs.filter((q) => q.projectId === id)),
    },
    __testProjects: projectsById,
    __testAudit: audit,
    __testIntakeQs: intakeQs,
  };
});

// Mock the AIService so nextStep doesn't hit a network.
vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real,
    aiService: {
      ...real.aiService,
      generateStructuredOutput: vi.fn(async () => [
        { topic: "primary_persona_and_trigger", evidence: 0, reversibility: 0, risk: 5, blocking: 15, decision: "ask", reason: "no personas" },
      ]),
    },
  };
});

// ---------------------------------------------------------------------------
// Boot the Express app once for all tests in this file.
// ---------------------------------------------------------------------------

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;
let testProjects: Record<string, any>;
let testAudit: any[];

beforeEach(async () => {
  vi.resetModules();
  // Re-mock with fresh module state for every test (vi.resetModules forces re-execution).
  // We also re-import dynamically so module-level closures see fresh test state.
  const { registerRoutes } = await import("../routes");
  const storageMod = await import("../storage-hybrid");
  testProjects = (storageMod as any).__testProjects;
  testAudit = (storageMod as any).__testAudit;

  // Reset mock state between tests.
  for (const k of Object.keys(testProjects)) delete testProjects[k];
  testAudit.length = 0;

  const app = express();
  app.use(express.json());

  // Override generateStructuredOutput response per test if needed by re-mocking later.
  await registerRoutes(app);

  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const addr = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

import { afterEach } from "vitest";

async function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/projects/:projectId/intake/next", () => {
  it("returns 401 for unauthenticated requests (no test-user header, no guest cookie)", async () => {
    testProjects["p1"] = {
      id: "p1",
      userId: "ownerA",
      guestOwnerId: null,
      name: "X",
      description: "y",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyPhase: null,
      productState: null,
      intakeMode: "adaptive",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await post("/api/projects/p1/intake/next");
    expect(res.status).toBe(401);
  });

  it("returns 403 for cross-tenant request (project owned by ownerA, accessed by ownerB)", async () => {
    testProjects["p1"] = {
      id: "p1",
      userId: "ownerA",
      guestOwnerId: null,
      name: "X",
      description: "y",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyPhase: null,
      productState: null,
      intakeMode: "adaptive",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await post("/api/projects/p1/intake/next", undefined, { "x-test-user": "ownerB" });
    expect(res.status).toBe(403);
  });

  it("returns 409 when intake_mode is 'survey'", async () => {
    testProjects["p2"] = {
      id: "p2",
      userId: "ownerA",
      guestOwnerId: null,
      name: "X",
      description: "y",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyPhase: null,
      productState: null,
      intakeMode: "survey",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await post("/api/projects/p2/intake/next", undefined, { "x-test-user": "ownerA" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("intake_mode_not_adaptive");
  });

  it("returns 200 + audit row for authed owner with intake_mode='adaptive'", async () => {
    testProjects["p3"] = {
      id: "p3",
      userId: "ownerA",
      guestOwnerId: null,
      name: "X",
      description: "y",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyPhase: null,
      productState: null,
      intakeMode: "adaptive",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await post("/api/projects/p3/intake/next", undefined, { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(["ask", "infer", "done"]).toContain(body.action);
    // Audit row written.
    expect(testAudit.some((e: any) => e.action === "intake.next" && e.resourceId === "p3")).toBe(true);
  });
});

describe("POST /api/projects/:projectId/intake/finalize", () => {
  it("returns SpecDraft + renderedMarkdown for authed owner", async () => {
    testProjects["p4"] = {
      id: "p4",
      userId: "ownerA",
      guestOwnerId: null,
      name: "TestProduct",
      description: "Description",
      mode: "survey",
      aiModel: "claude-sonnet",
      surveyPhase: null,
      productState: ProductStateSchema.parse({}),
      intakeMode: "adaptive",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Phase 4: finalize now requires tradeoffWeights — supply a valid allocation.
    const res = await post(
      "/api/projects/p4/intake/finalize",
      {
        tradeoffWeights: {
          speed_to_alpha: 30,
          scalability: 20,
          ux_polish: 10,
          maintainability: 20,
          cost: 10,
          security: 10,
          unacceptable_tradeoff: "security",
        },
      },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spec).toBeDefined();
    expect(body.spec.id).toBe("spec-p4");
    expect(typeof body.renderedMarkdown).toBe("string");
    expect(body.renderedMarkdown.length).toBeGreaterThan(0);
    // Audit row.
    expect(testAudit.some((e: any) => e.action === "intake.finalize" && e.resourceId === "p4")).toBe(true);
  });
});
