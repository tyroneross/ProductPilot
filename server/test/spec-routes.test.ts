/**
 * Phase 3 — spec routes integration test.
 *
 * Asserts:
 *   - /spec/lint     401 unauthed, 403 cross-tenant, 409 non-adaptive, 200 happy.
 *   - /spec/waive    401, 403, 409 on PII rule, 200 happy with audit row, sanitized reason.
 *
 * Strategy mirrors intake-routes.test.ts: mock auth + storage + AIService at the
 * module boundary, boot Express via registerRoutes, exercise via fetch.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";

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
      createIntakeQuestion: vi.fn(),
      updateIntakeQuestionAnswer: vi.fn(),
      getIntakeQuestionsByProject: vi.fn(async () => []),
    },
    __testProjects: projectsById,
    __testAudit: audit,
  };
});

// Force the LLM tier off — keeps lint deterministic for these tests.
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
  // Without a key the LLM tier short-circuits in spec-linter — we want that.
  // 2026-05-02: linter's hasKey gate now reads either GROQ_API_KEY or
  // ANTHROPIC_API_KEY, so clear both.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GROQ_API_KEY;
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

function makeProject(id: string, ownerId: string, intakeMode: string = "adaptive") {
  return {
    id,
    userId: ownerId,
    guestOwnerId: null,
    name: `Project ${id}`,
    description: "Test project description with on-device pipeline that fails loudly.",
    mode: "survey",
    aiModel: "claude-sonnet",
    surveyPhase: null,
    productState: null,
    intakeMode,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("POST /api/projects/:projectId/spec/lint", () => {
  it("returns 401 unauthenticated", async () => {
    testProjects["pl1"] = makeProject("pl1", "ownerA");
    const res = await post("/api/projects/pl1/spec/lint", {});
    expect(res.status).toBe(401);
  });

  it("returns 403 cross-tenant", async () => {
    testProjects["pl2"] = makeProject("pl2", "ownerA");
    const res = await post("/api/projects/pl2/spec/lint", {}, { "x-test-user": "ownerB" });
    expect(res.status).toBe(403);
  });

  it("returns 409 when intakeMode is not adaptive", async () => {
    testProjects["pl3"] = makeProject("pl3", "ownerA", "survey");
    const res = await post("/api/projects/pl3/spec/lint", {}, { "x-test-user": "ownerA" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("intake_mode_not_adaptive");
  });

  it("returns 200 + audit row on a happy path", async () => {
    testProjects["pl4"] = makeProject("pl4", "ownerA");
    const res = await post("/api/projects/pl4/spec/lint", {}, { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.issues)).toBe(true);
    expect(typeof body.blockerCount).toBe("number");
    expect(typeof body.nonWaivableCount).toBe("number");
    expect(testAudit.some((e: any) => e.action === "spec.lint" && e.resourceId === "pl4")).toBe(true);
  });
});

describe("POST /api/projects/:projectId/spec/waive", () => {
  it("returns 401 unauthenticated", async () => {
    testProjects["pw1"] = makeProject("pw1", "ownerA");
    const res = await post("/api/projects/pw1/spec/waive", { issueId: "x", rule: "p0_need_missing_test", reason: "ok" });
    expect(res.status).toBe(401);
  });

  it("returns 403 cross-tenant", async () => {
    testProjects["pw2"] = makeProject("pw2", "ownerA");
    const res = await post(
      "/api/projects/pw2/spec/waive",
      { issueId: "x", rule: "p0_need_missing_test", reason: "ok" },
      { "x-test-user": "ownerB" },
    );
    expect(res.status).toBe(403);
  });

  it("accepts waive on PII rule (advisory post-2026-05-08; no rule is non-waivable)", async () => {
    // Per the no-blocks principle, ALL lint rules became advisory + waivable.
    // Previously PII handling-note was hard-rejected on waive; now the user/
    // builder may freely waive any advisory and the action is audited.
    testProjects["pw3"] = makeProject("pw3", "ownerA");
    const res = await post(
      "/api/projects/pw3/spec/waive",
      { issueId: "x", rule: "pii_handling_note_missing", reason: "we accept the risk" },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(200);
    expect(testAudit.find((e: any) => e.action === "spec.waive" && e.resourceId === "pw3")).toBeDefined();
  });

  it("records a waiver with sanitized reason and writes an audit row", async () => {
    testProjects["pw4"] = makeProject("pw4", "ownerA");
    const reasonRaw = "<script>alert(1)</script>\nWaiving because the story is fine.";
    const res = await post(
      "/api/projects/pw4/spec/waive",
      { issueId: "lint-p0_need-1", rule: "p0_need_missing_test", reason: reasonRaw },
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.waiver.rule).toBe("p0_need_missing_test");
    // Sanitized — angle brackets escaped.
    expect(body.waiver.reason).not.toContain("<script>");
    expect(body.waiver.reason).toContain("&lt;script&gt;");
    // Audit row written.
    expect(testAudit.some((e: any) => e.action === "spec.waive" && e.resourceId === "pw4")).toBe(true);
    // ProductState updated with waiver record.
    const stored = testProjects["pw4"].productState;
    expect(stored.workingMemory.waivers["lint-p0_need-1"]).toBeDefined();
    expect(stored.workingMemory.waivers["lint-p0_need-1"].rule).toBe("p0_need_missing_test");
  });

  it("returns 400 on an invalid payload (missing reason)", async () => {
    testProjects["pw5"] = makeProject("pw5", "ownerA");
    const res = await post(
      "/api/projects/pw5/spec/waive",
      { issueId: "x", rule: "p0_need_missing_test" }, // missing reason
      { "x-test-user": "ownerA" },
    );
    expect(res.status).toBe(400);
  });
});
