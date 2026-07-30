/**
 * Authorization coverage for the admin operations surface.
 *
 * The server-side `isAdmin` middleware is the real boundary — the client route
 * gate only removes the surface. These tests pin the boundary, because a
 * regression here exposes every user's aggregate data to any signed-in account.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";

const ADMIN_EMAIL = "tyrone.ross@gmail.com";
let currentUser: { id: string; email: string } | null = null;

vi.mock("../auth", () => ({
  extractUser: (req: any, _res: any, next: any) => {
    if (currentUser) {
      req.userId = currentUser.id;
      req.user = currentUser;
    }
    next();
  },
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    next();
  },
  trustedOrigins: ["http://localhost:5173"],
}));

const OPS = {
  users: { registeredAccounts: 6, accountsWithProjects: 2, distinctGuests: 26, guestsWithRealWork: 16 },
  ownership: { accountOwned: 5, guestOwnedAtRisk: 6, strandedProjects: 35, orphaned: 0, totalProjects: 46 },
  engagement: { projectsPerGuest: [{ projects: 1, guests: 22 }], totalStages: 276, totalMessages: 87 },
  spend: { windowDays: 30, calls: 2826, inputTokens: 100, outputTokens: 50, costUsd: 1.23, errorCalls: 4, byModel: [] },
  generatedAt: "2026-07-30T23:00:00.000Z",
};

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real,
    aiService: { ...real.aiService, chat: vi.fn(async () => ({ content: "ok" })), generateStructuredOutput: vi.fn() },
  };
});

vi.mock("../storage-hybrid", () => ({
  runWithDbActorContext: <T,>(_c: any, cb: () => T) => cb(),
  updateDbActorContext: () => {},
  storage: {
    getOpsSummary: vi.fn(async () => OPS),
    getProject: vi.fn(),
    getProjectsByUserId: vi.fn(async () => []),
    getProjectsByGuestOwnerId: vi.fn(async () => []),
    claimProjectsForUser: vi.fn(async () => []),
    updateProject: vi.fn(),
    createAuditEvent: vi.fn(async () => {}),
    getStagesByProject: vi.fn(async () => []),
    ensureStagesForProject: vi.fn(async () => []),
    createStage: vi.fn(), getStage: vi.fn(), updateStage: vi.fn(),
    createMessage: vi.fn(), getMessagesByStage: vi.fn(async () => []),
    getDeliverablesByStage: vi.fn(async () => []),
    getAllAdminPrompts: vi.fn(async () => []), getAdminPromptByTargetKey: vi.fn(),
    getAdminPrompt: vi.fn(), createAdminPrompt: vi.fn(), updateAdminPrompt: vi.fn(),
    deleteAdminPrompt: vi.fn(), seedDefaultPrompts: vi.fn(),
    getUserSettings: vi.fn(async () => null), upsertUserSettings: vi.fn(),
    createLlmCall: vi.fn(async () => {}), listLlmCalls: vi.fn(async () => ({ rows: [], total: 0 })),
    getLlmCall: vi.fn(), listAuditEvents: vi.fn(async () => ({ rows: [], total: 0 })), getAuditEvent: vi.fn(),
    getUserDraft: vi.fn(), createProject: vi.fn(), deleteProject: vi.fn(),
    createIntakeQuestion: vi.fn(), updateIntakeQuestionAnswer: vi.fn(),
    getIntakeQuestionsByProject: vi.fn(async () => []),
  },
}));

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;
const ENV = { ...process.env };

beforeEach(async () => {
  vi.resetModules();
  currentUser = null;
  delete process.env.GROQ_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
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
  process.env = { ...ENV };
});

const get = (p: string) => fetch(`${baseUrl}${p}`);

describe("GET /api/admin/ops-summary — authorization", () => {
  it("401s when signed out", async () => {
    expect((await get("/api/admin/ops-summary")).status).toBe(401);
  });

  it("403s for a signed-in NON-admin", async () => {
    currentUser = { id: "u-regular", email: "someone@example.com" };
    expect((await get("/api/admin/ops-summary")).status).toBe(403);
  });

  it("403s for an email that merely resembles the admin's", async () => {
    for (const email of [
      "tyrone.ross@gmail.com.evil.com",
      "xtyrone.ross@gmail.com",
      "tyrone.ross@gmail.co",
    ]) {
      currentUser = { id: "u-attacker", email };
      expect((await get("/api/admin/ops-summary")).status).toBe(403);
    }
  });

  it("200s for the admin", async () => {
    currentUser = { id: "u-admin", email: ADMIN_EMAIL };
    expect((await get("/api/admin/ops-summary")).status).toBe(200);
  });

  it("matches the admin email case-insensitively", async () => {
    currentUser = { id: "u-admin", email: "TYRONE.ROSS@GMAIL.COM" };
    expect((await get("/api/admin/ops-summary")).status).toBe(200);
  });
});

describe("GET /api/admin/ops-summary — payload", () => {
  beforeEach(() => {
    currentUser = { id: "u-admin", email: ADMIN_EMAIL };
  });

  it("returns the real aggregate shape", async () => {
    const body = await (await get("/api/admin/ops-summary")).json();
    expect(body.ownership.strandedProjects).toBe(35);
    expect(body.users.guestsWithRealWork).toBe(16);
    expect(body.spend.windowDays).toBe(30);
    expect(body.modelFallback).toBeDefined();
    expect(body.modelFallback.coversAccountBlock).toBe(false);
  });

  // Aggregates only. An admin needs counts to make decisions, not the contents
  // of other people's product ideas.
  it("leaks no per-user identifiers or project content", async () => {
    const serialized = JSON.stringify(await (await get("/api/admin/ops-summary")).json());
    expect(serialized).not.toContain("@");
    expect(serialized.toLowerCase()).not.toContain("guest_owner");
    expect(serialized).not.toContain("problemStatement");
  });

  it("reports no providers when no key is configured, rather than guessing", async () => {
    const body = await (await get("/api/admin/ops-summary")).json();
    expect(body.providers).toEqual({});
  });
});

describe("GET /api/admin/check — drives the client route gate", () => {
  it("401s when signed out, so the gate falls through to NotFound", async () => {
    expect((await get("/api/admin/check")).status).toBe(401);
  });

  it("returns isAdmin:false for a regular signed-in user", async () => {
    currentUser = { id: "u-regular", email: "someone@example.com" };
    const body = await (await get("/api/admin/check")).json();
    expect(body.isAdmin).toBe(false);
  });

  it("returns isAdmin:true for the admin", async () => {
    currentUser = { id: "u-admin", email: ADMIN_EMAIL };
    const body = await (await get("/api/admin/check")).json();
    expect(body.isAdmin).toBe(true);
  });
});
