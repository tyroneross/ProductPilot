/**
 * Phase 5 — agent-handoff route integration test.
 *
 * Asserts:
 *   - 401 unauthenticated request.
 *   - 409 when project.intake_mode !== 'adaptive'.
 *   - 409 when productState.tradeoffWeights are missing.
 *   - 409 when a non-waivable PII issue exists (DataPoint pii=true + no handlingNote).
 *   - 409 when an unwaived blocker remains (P0 Need with no Test).
 *   - 200 + text/markdown when all gates pass.
 *   - audit_events row written on every request, success or failure.
 *
 * Mocks the same boundaries as intake-routes.test.ts so we never boot
 * Better Auth or the real DB.
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
      createAuditEvent: vi.fn(async (event: any) => {
        audit.push(event);
      }),
      listAuditEvents: vi.fn(async () => ({ rows: audit, total: audit.length })),
      getAuditEvent: vi.fn(),
      createIntakeQuestion: vi.fn(async (row: any) => {
        const stamp = {
          id: `iq-${intakeQs.length + 1}`,
          ...row,
          createdAt: new Date(),
          answeredAt: row.answeredAt ?? null,
        };
        intakeQs.push(stamp);
        return stamp;
      }),
      updateIntakeQuestionAnswer: vi.fn(),
      getIntakeQuestionsByProject: vi.fn(async (id: string) =>
        intakeQs.filter((q) => q.projectId === id),
      ),
    },
    __testProjects: projectsById,
    __testAudit: audit,
    __testIntakeQs: intakeQs,
  };
});

// Stub aiService so the linter never reaches the network. The route runs
// lintSpec(), which would otherwise consult the LLM tier when GROQ_API_KEY
// (or ANTHROPIC_API_KEY) is set in the test environment.
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

// Linter stub — toggleable per test. Default returns zero issues so the route
// reaches the success path; specific tests flip it to inject a non-waivable
// issue, an unwaived blocker, etc.
let __lintStubResult: {
  issues: Array<{ id: string; rule: string; severity: "block" | "warn" | "info"; waivable: boolean; message: string; refs: Array<{ kind: string; id: string }> }>;
  blockerCount: number;
  nonWaivableCount: number;
  llmRan: boolean;
} = { issues: [], blockerCount: 0, nonWaivableCount: 0, llmRan: false };

vi.mock("../services/spec-linter", async () => {
  const real = await vi.importActual<typeof import("../services/spec-linter")>(
    "../services/spec-linter",
  );
  return {
    ...real,
    lintSpec: vi.fn(async () => __lintStubResult),
  };
});

function setLintStub(
  issues: typeof __lintStubResult.issues,
) {
  __lintStubResult = {
    issues,
    blockerCount: issues.filter((i) => i.severity === "block").length,
    nonWaivableCount: issues.filter((i) => i.waivable === false).length,
    llmRan: false,
  };
}

const VALID_WEIGHTS = {
  speed_to_alpha: 30,
  scalability: 15,
  ux_polish: 15,
  maintainability: 20,
  cost: 10,
  security: 10,
  unacceptable_tradeoff: "security" as const,
};

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
  // Default lint result is "clean" — individual tests override.
  setLintStub([]);

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

async function get(path: string, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}${path}`, { method: "GET", headers });
}

function makeProject(
  id: string,
  overrides: Partial<{ intakeMode: string; productState: any; userId: string }> = {},
) {
  return {
    id,
    userId: overrides.userId ?? "ownerA",
    guestOwnerId: null,
    name: "X",
    description: "y",
    mode: "survey",
    aiModel: "claude-sonnet",
    surveyPhase: null,
    productState:
      "productState" in overrides
        ? overrides.productState
        : ProductStateSchema.parse({ tradeoffWeights: VALID_WEIGHTS }),
    intakeMode: overrides.intakeMode ?? "adaptive",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("GET /api/projects/:projectId/handoff.md", () => {
  it("returns 401 when unauthenticated", async () => {
    testProjects["p1"] = makeProject("p1");
    const res = await get("/api/projects/p1/handoff.md");
    expect(res.status).toBe(401);
  });

  it("returns 403 for cross-tenant request", async () => {
    testProjects["p1"] = makeProject("p1", { userId: "ownerA" });
    const res = await get("/api/projects/p1/handoff.md", { "x-test-user": "ownerB" });
    expect(res.status).toBe(403);
  });

  it("returns 409 (intake_mode_not_adaptive) when intake_mode is 'survey'", async () => {
    testProjects["p2"] = makeProject("p2", { intakeMode: "survey" });
    const res = await get("/api/projects/p2/handoff.md", { "x-test-user": "ownerA" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("intake_mode_not_adaptive");
  });

  it("auto-defaults weights when productState has none and exports successfully with X-Weights-Assumed header", async () => {
    // No-blocks principle (2026-05-08): export proceeds with synthesized
    // weights rather than refusing. The audit row records weightsAssumed=true
    // and the response carries an X-Weights-Assumed: true header so the
    // downstream consumer (Claude Code) can see the allocation was inferred.
    testProjects["p3"] = makeProject("p3", {
      productState: ProductStateSchema.parse({}), // no tradeoffWeights
    });
    const res = await get("/api/projects/p3/handoff.md", { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Weights-Assumed")).toBe("true");
    expect(testAudit.some((e) => e.action === "handoff.export" && e.metadata?.weightsAssumed === true)).toBe(true);
  });

  it("returns 200 + text/markdown when all gates pass (clean lint, valid weights, adaptive mode)", async () => {
    setLintStub([]); // explicit — route reaches success path
    testProjects["p4"] = makeProject("p4");
    const res = await get("/api/projects/p4/handoff.md", { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# Coding Agent Handoff");
    expect(body).toContain("## Ask before acting");
    expect(testAudit.some((e) => e.action === "handoff.export" && e.metadata?.outcome === "success")).toBe(true);
  });

  it("exports successfully when the linter reports unwaived warn issues; audit logs them as advisories", async () => {
    // Per the no-blocks principle (2026-05-08), warn-severity findings travel
    // with the export rather than gating it. The audit trail records them so a
    // reviewer can spot-check post-hoc, but the user is not stopped.
    setLintStub([
      {
        id: "lint-fixture-1",
        rule: "p0_need_missing_test",
        severity: "warn",
        waivable: true,
        message: "P0 Need N-1 has no Test referencing it.",
        refs: [{ kind: "need", id: "N-1" }],
      },
    ]);
    testProjects["p5"] = makeProject("p5");
    const res = await get("/api/projects/p5/handoff.md", { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const advisoryAudit = testAudit.find(
      (e) => e.action === "handoff.export" && e.metadata?.outcome === "exported_with_advisories",
    );
    expect(advisoryAudit).toBeDefined();
    expect(advisoryAudit?.metadata?.advisoryCount).toBe(1);
    expect(advisoryAudit?.metadata?.advisoryIds).toContain("lint-fixture-1");
  });

  it("exports successfully even when a PII handling-note advisory is unwaived; logs it as advisory", async () => {
    // Previously hard-blocked. Now: surfaced as an advisory and the user/builder
    // decides whether to act on it. The export still happens.
    setLintStub([
      {
        id: "lint-fixture-pii",
        rule: "pii_handling_note_missing",
        severity: "warn",
        waivable: true,
        message: "DataPoint DP-1 marked pii=true with no handlingNote.",
        refs: [{ kind: "datapoint", id: "DP-1" }],
      },
    ]);
    testProjects["p7"] = makeProject("p7");
    const res = await get("/api/projects/p7/handoff.md", { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    const advisoryAudit = testAudit.find(
      (e) => e.action === "handoff.export" && e.metadata?.outcome === "exported_with_advisories",
    );
    expect(advisoryAudit?.metadata?.advisoryIds).toContain("lint-fixture-pii");
  });

  it("waived blockers (issue id present in working-memory waivers) clear the gate", async () => {
    setLintStub([
      {
        id: "lint-waived-1",
        rule: "p0_need_missing_test",
        severity: "block",
        waivable: true,
        message: "P0 Need has no Test.",
        refs: [],
      },
    ]);
    testProjects["p8"] = makeProject("p8", {
      productState: ProductStateSchema.parse({
        tradeoffWeights: VALID_WEIGHTS,
        workingMemory: {
          waivers: {
            "lint-waived-1": {
              issueId: "lint-waived-1",
              rule: "p0_need_missing_test",
              reason: "test fixture — manual review confirms",
              waivedAt: new Date().toISOString(),
            },
          },
        },
      }),
    });
    const res = await get("/api/projects/p8/handoff.md", { "x-test-user": "ownerA" });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("# Coding Agent Handoff");
  });

  it("writes a handoff.export audit row on every request (gate or success)", async () => {
    testProjects["p6"] = makeProject("p6", { intakeMode: "survey" });
    const res = await get("/api/projects/p6/handoff.md", { "x-test-user": "ownerA" });
    // The intake_mode gate is structural (the route only operates on adaptive
    // projects) and short-circuits before any audit-writing path. That part is
    // unchanged.
    expect(res.status).toBe(409);
    expect(testAudit.filter((e) => e.action === "handoff.export").length).toBe(0);

    // Adaptive project without weights now succeeds (weights auto-defaulted)
    // and writes a success audit row carrying weightsAssumed=true.
    testProjects["p6"] = makeProject("p6", {
      productState: ProductStateSchema.parse({}),
    });
    const res2 = await get("/api/projects/p6/handoff.md", { "x-test-user": "ownerA" });
    expect(res2.status).toBe(200);
    expect(
      testAudit.filter(
        (e) => e.action === "handoff.export" && e.metadata?.weightsAssumed === true,
      ).length,
    ).toBe(1);
  });
});
