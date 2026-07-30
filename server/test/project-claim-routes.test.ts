/**
 * Route-level coverage for project ownership transfer (guest cookie -> account).
 *
 * WHY THIS FILE EXISTS
 * Production analysis on 2026-07-30 found 35 of 46 projects stranded: owned by
 * a guest cookie, created more than the 30-day cookie lifetime ago, and
 * therefore unreachable by their creators. The cause was a claim that
 * transferred ONE project and then cleared the cookie, so every remaining
 * project lost the only identity that could prove ownership — and the client
 * swallowed the resulting 403 and reported "saved successfully" anyway.
 *
 * These tests pin both the fix and the security guards it must not weaken.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";

const DEMO_OWNER_COOKIE = "productpilot_demo_owner";
const GUEST_A = "guest-alpha";
const GUEST_B = "guest-beta";
const USER_A = "user-alpha";
const USER_B = "user-beta";

type Row = { id: string; userId: string | null; guestOwnerId: string | null; name: string };
let rows: Row[] = [];

function seed() {
  rows = [
    { id: "p1", userId: null, guestOwnerId: GUEST_A, name: "first idea" },
    { id: "p2", userId: null, guestOwnerId: GUEST_A, name: "second idea" },
    { id: "p3", userId: null, guestOwnerId: GUEST_A, name: "third idea" },
    { id: "other", userId: null, guestOwnerId: GUEST_B, name: "someone else's" },
    { id: "owned", userId: USER_B, guestOwnerId: null, name: "already an account's" },
    { id: "orphan", userId: null, guestOwnerId: null, name: "orphan row" },
  ];
}

let currentUserId: string | null = null;

vi.mock("../auth", () => ({
  extractUser: (req: any, _res: any, next: any) => {
    if (currentUserId) {
      req.userId = currentUserId;
      req.user = { id: currentUserId };
    }
    next();
  },
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    next();
  },
  trustedOrigins: ["http://localhost:5173"],
}));

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return { ...real, aiService: { ...real.aiService, chat: vi.fn(), generateStructuredOutput: vi.fn() } };
});

vi.mock("../storage-hybrid", () => ({
  runWithDbActorContext: <T,>(_c: any, cb: () => T) => cb(),
  updateDbActorContext: () => {},
  storage: {
    getProject: vi.fn(async (id: string) => rows.find((r) => r.id === id)),
    updateProject: vi.fn(async (id: string, u: any) => {
      const r = rows.find((x) => x.id === id);
      if (!r) return undefined;
      Object.assign(r, u);
      return r;
    }),
    // Mirrors the real SQL predicate: guest matches AND user_id IS NULL.
    claimProjectsForUser: vi.fn(async (guestOwnerId: string, userId: string) => {
      const claimed = rows.filter((r) => r.guestOwnerId === guestOwnerId && !r.userId);
      for (const r of claimed) {
        r.userId = userId;
        r.guestOwnerId = null;
      }
      return claimed;
    }),
    getProjectsByUserId: vi.fn(async (uid: string) => rows.filter((r) => r.userId === uid)),
    getProjectsByGuestOwnerId: vi.fn(async (g: string) => rows.filter((r) => r.guestOwnerId === g)),
    createAuditEvent: vi.fn(async () => {}),
    getStagesByProject: vi.fn(async () => []),
    ensureStagesForProject: vi.fn(async () => []),
    createStage: vi.fn(),
    getStage: vi.fn(),
    updateStage: vi.fn(),
    createMessage: vi.fn(),
    getMessagesByStage: vi.fn(async () => []),
    getDeliverablesByStage: vi.fn(async () => []),
    getAllAdminPrompts: vi.fn(async () => []),
    getAdminPromptByTargetKey: vi.fn(),
    getAdminPrompt: vi.fn(),
    createAdminPrompt: vi.fn(),
    updateAdminPrompt: vi.fn(),
    deleteAdminPrompt: vi.fn(),
    seedDefaultPrompts: vi.fn(),
    getUserSettings: vi.fn(async () => null),
    upsertUserSettings: vi.fn(),
    createLlmCall: vi.fn(async () => {}),
    listLlmCalls: vi.fn(async () => ({ rows: [], total: 0 })),
    getLlmCall: vi.fn(),
    listAuditEvents: vi.fn(async () => ({ rows: [], total: 0 })),
    getAuditEvent: vi.fn(),
    getUserDraft: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    getProjectsByUserIdOrGuest: vi.fn(),
    createIntakeQuestion: vi.fn(),
    updateIntakeQuestionAnswer: vi.fn(),
    getIntakeQuestionsByProject: vi.fn(async () => []),
  },
}));

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;

beforeEach(async () => {
  vi.resetModules();
  seed();
  currentUserId = USER_A;
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

function post(path: string, guest?: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(guest ? { Cookie: `${DEMO_OWNER_COOKIE}=${guest}` } : {}),
    },
    body: "{}",
  });
}

describe("claiming a project transfers the whole guest session", () => {
  it("claims every project the cookie owns, not just the one in the URL", async () => {
    const res = await post("/api/projects/p1/claim", GUEST_A);
    expect(res.status).toBe(200);
    expect(rows.filter((r) => r.userId === USER_A).map((r) => r.id).sort()).toEqual(["p1", "p2", "p3"]);
    expect(rows.filter((r) => r.guestOwnerId === GUEST_A)).toHaveLength(0);
  });

  it("reports how many projects were attached", async () => {
    const body = await (await post("/api/projects/p1/claim", GUEST_A)).json();
    expect(body.claimedCount).toBe(3);
  });

  // The exact production failure: cookie cleared after the first claim, so the
  // second save 403'd and the work was stranded.
  it("a SECOND save does not 403 after the cookie is gone", async () => {
    await post("/api/projects/p1/claim", GUEST_A);
    // Cookie cleared by the first claim — the browser sends nothing now.
    const second = await post("/api/projects/p2/claim");
    expect(second.status).not.toBe(403);
    expect(rows.find((r) => r.id === "p2")!.userId).toBe(USER_A);
  });

  it("leaves no project behind for that guest", async () => {
    await post("/api/projects/p1/claim", GUEST_A);
    expect(rows.filter((r) => r.guestOwnerId === GUEST_A)).toHaveLength(0);
  });
});

describe("session-level claim makes signing in sufficient", () => {
  it("attaches all guest work without going through the Save dialog", async () => {
    const body = await (await post("/api/projects/claim-session", GUEST_A)).json();
    expect(body.claimedCount).toBe(3);
    expect(rows.filter((r) => r.userId === USER_A)).toHaveLength(3);
  });

  it("is a harmless no-op with no guest cookie", async () => {
    const body = await (await post("/api/projects/claim-session")).json();
    expect(body.claimedCount).toBe(0);
  });

  it("is idempotent — calling twice claims nothing extra", async () => {
    await post("/api/projects/claim-session", GUEST_A);
    const second = await (await post("/api/projects/claim-session", GUEST_A)).json();
    expect(second.claimedCount).toBe(0);
    expect(rows.filter((r) => r.userId === USER_A)).toHaveLength(3);
  });

  it("requires authentication", async () => {
    currentUserId = null;
    expect((await post("/api/projects/claim-session", GUEST_A)).status).toBe(401);
  });
});

// These guards existed before the fix and must not be weakened by it.
describe("security guards still hold", () => {
  it("does not let a guest cookie claim ANOTHER guest's project", async () => {
    const res = await post("/api/projects/other/claim", GUEST_A);
    expect(res.status).toBe(403);
    expect(rows.find((r) => r.id === "other")!.guestOwnerId).toBe(GUEST_B);
    expect(rows.find((r) => r.id === "other")!.userId).toBeNull();
  });

  it("does not let anyone claim an orphan row", async () => {
    const res = await post("/api/projects/orphan/claim", GUEST_A);
    expect(res.status).toBe(403);
    expect(rows.find((r) => r.id === "orphan")!.userId).toBeNull();
  });

  it("does not let one account steal another account's project", async () => {
    const res = await post("/api/projects/owned/claim", GUEST_A);
    expect(res.status).toBe(403);
    expect(rows.find((r) => r.id === "owned")!.userId).toBe(USER_B);
  });

  it("never reassigns an account-owned row via a matching guest cookie", async () => {
    // Hostile shape: a row carrying BOTH an owner and a matching guest cookie.
    rows.push({ id: "hybrid", userId: USER_B, guestOwnerId: GUEST_A, name: "contested" });
    await post("/api/projects/claim-session", GUEST_A);
    expect(rows.find((r) => r.id === "hybrid")!.userId).toBe(USER_B);
  });

  it("does not touch a different guest's projects during a session claim", async () => {
    await post("/api/projects/claim-session", GUEST_A);
    expect(rows.find((r) => r.id === "other")!.guestOwnerId).toBe(GUEST_B);
  });
});
