/**
 * Phase 4 — /api/projects/:projectId/intake/finalize route — tradeoffWeights
 * body extension.
 *
 * Asserts:
 *   - Valid weights body persists tradeoffWeights to productState and the
 *     audit row carries the JSON.
 *   - Invalid sum (sum != 100) returns 400 with field-level Zod issues.
 *   - Missing weights AND no prior weights on productState returns 400 with
 *     code=tradeoff_weights_required.
 *   - Body weights with bad unacceptable_tradeoff enum returns 400.
 *   - Pre-set weights on productState — finalize succeeds without body.
 *
 * Strategy: same module-mocking pattern as intake-routes.test.ts so we can
 * boot Express without Better Auth + a real DB.
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
  const intakeQs: any[] = [];
  const projectsById: Record<string, any> = {};

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

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real,
    aiService: {
      ...real.aiService,
      generateStructuredOutput: vi.fn(async () => []),
    },
  };
});

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;
let testProjects: Record<string, any>;
let testAudit: any[];

beforeEach(async () => {
  vi.resetModules();
  const { registerRoutes } = await import("../routes");
  const storageMod = await import("../storage-hybrid");
  testProjects = (storageMod as any).__testProjects;
  testAudit = (storageMod as any).__testAudit;

  for (const k of Object.keys(testProjects)) delete testProjects[k];
  testAudit.length = 0;

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

function makeProject(id: string, productState: unknown = ProductStateSchema.parse({})) {
  testProjects[id] = {
    id,
    userId: "ownerA",
    guestOwnerId: null,
    name: "TestProduct",
    description: "Description",
    mode: "survey",
    aiModel: "claude-sonnet",
    surveyPhase: null,
    productState,
    intakeMode: "adaptive",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const VALID_WEIGHTS = {
  speed_to_alpha: 30,
  scalability: 20,
  ux_polish: 10,
  maintainability: 20,
  cost: 10,
  security: 10,
  unacceptable_tradeoff: "security" as const,
};

describe("POST /api/projects/:projectId/intake/finalize — Phase 4 weights body", () => {
  it("returns 200 + persists weights to productState + audit row carries the JSON", async () => {
    makeProject("p-finalize-1");

    const res = await post(
      "/api/projects/p-finalize-1/intake/finalize",
      { tradeoffWeights: VALID_WEIGHTS },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spec).toBeDefined();
    expect(body.productState?.tradeoffWeights?.speed_to_alpha).toBe(30);
    expect(body.productState?.tradeoffWeights?.unacceptable_tradeoff).toBe("security");

    // Persisted to projects[id].productState.
    expect(testProjects["p-finalize-1"].productState.tradeoffWeights.cost).toBe(10);

    // Audit row has the weights JSON.
    const audit = testAudit.find(
      (e: any) => e.action === "intake.finalize" && e.resourceId === "p-finalize-1",
    );
    expect(audit).toBeDefined();
    expect(audit?.metadata?.weightsApplied).toBe(true);
    expect(audit?.metadata?.tradeoffWeights?.speed_to_alpha).toBe(30);
  });

  it("returns 400 when weights body sums to a value other than 100", async () => {
    makeProject("p-finalize-2");
    const res = await post(
      "/api/projects/p-finalize-2/intake/finalize",
      {
        tradeoffWeights: {
          ...VALID_WEIGHTS,
          cost: 5, // sum becomes 95
        },
      },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Invalid tradeoff weights/i);
    expect(Array.isArray(body.errors)).toBe(true);
    // The Zod refine surfaces under path:["__sum"].
    const sumErr = body.errors.find((e: any) => Array.isArray(e.path) && e.path.includes("__sum"));
    expect(sumErr).toBeDefined();
  });

  it("returns 400 with code=tradeoff_weights_required when body omits weights AND productState has none", async () => {
    makeProject("p-finalize-3"); // productState has no tradeoffWeights
    const res = await post(
      "/api/projects/p-finalize-3/intake/finalize",
      {}, // no weights
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("tradeoff_weights_required");
  });

  it("returns 400 when unacceptable_tradeoff is outside the six-axis enum", async () => {
    makeProject("p-finalize-4");
    const res = await post(
      "/api/projects/p-finalize-4/intake/finalize",
      {
        tradeoffWeights: {
          ...VALID_WEIGHTS,
          unacceptable_tradeoff: "delivery_date" as any,
        },
      },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Invalid tradeoff weights/i);
  });

  it("returns 200 when productState already carries valid weights and body omits them", async () => {
    const stateWithWeights = ProductStateSchema.parse({
      tradeoffWeights: VALID_WEIGHTS,
    });
    makeProject("p-finalize-5", stateWithWeights);

    const res = await post(
      "/api/projects/p-finalize-5/intake/finalize",
      {}, // no weights — already on productState
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.productState?.tradeoffWeights?.speed_to_alpha).toBe(30);
    const audit = testAudit.find(
      (e: any) => e.action === "intake.finalize" && e.resourceId === "p-finalize-5",
    );
    expect(audit?.metadata?.weightsApplied).toBe(false);
    expect(audit?.metadata?.tradeoffWeights?.cost).toBe(10);
  });
});
