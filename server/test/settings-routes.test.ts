/**
 * T1-3 — settings GET response shape.
 *
 * Asserts that GET /api/settings:
 *   - Returns 401 unauthenticated.
 *   - Never includes raw key fields (llm_api_key, llmApiKey, snake/camel
 *     variants) regardless of what shape the storage row carries.
 *   - Returns only the four allowlisted fields the UI consumes:
 *       llmProvider, llmModel, llmApiKeyMasked, platformKeysAvailable.
 *   - Masks the key with first 7 + ... + last 4 when present.
 *   - Returns llmApiKeyMasked: null when no key is configured.
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

let mockSettings: any = null;

vi.mock("../storage-hybrid", () => ({
  runWithDbActorContext: <T,>(_ctx: any, cb: () => T) => cb(),
  updateDbActorContext: () => {},
  storage: {
    // Routes that get loaded by registerRoutes but the settings test doesn't exercise.
    // Provide enough no-ops to satisfy registration without booting a DB.
    getProject: vi.fn(),
    getProjectsByUserId: vi.fn(async () => []),
    getProjectsByGuestOwnerId: vi.fn(async () => []),
    getUserDraft: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getStagesByProject: vi.fn(async () => []),
    ensureStagesForProject: vi.fn(async () => []),
    getStage: vi.fn(),
    updateStage: vi.fn(),
    getMessagesByStage: vi.fn(async () => []),
    createMessage: vi.fn(),
    getDeliverablesByStage: vi.fn(async () => []),
    getAllAdminPrompts: vi.fn(async () => []),
    getAdminPrompt: vi.fn(),
    getAdminPromptByTargetKey: vi.fn(),
    createAdminPrompt: vi.fn(),
    updateAdminPrompt: vi.fn(),
    deleteAdminPrompt: vi.fn(),
    seedDefaultPrompts: vi.fn(),
    // The one that matters for this suite:
    getUserSettings: vi.fn(async () => mockSettings),
    upsertUserSettings: vi.fn(),
    createLlmCall: vi.fn(async () => {}),
    listLlmCalls: vi.fn(async () => ({ rows: [], total: 0 })),
    getLlmCall: vi.fn(),
    createAuditEvent: vi.fn(async () => {}),
    listAuditEvents: vi.fn(async () => ({ rows: [], total: 0 })),
    getAuditEvent: vi.fn(),
    createIntakeQuestion: vi.fn(),
    updateIntakeQuestionAnswer: vi.fn(),
    getIntakeQuestionsByProject: vi.fn(async () => []),
  },
  __setMockSettings: (s: any) => { mockSettings = s; },
}));

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real,
    aiService: {
      ...real.aiService,
      generateStructuredOutput: vi.fn(),
    },
  };
});

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;

beforeEach(async () => {
  vi.resetModules();
  mockSettings = null;
  const { registerRoutes } = await import("../routes");

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

async function getSettings(headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/settings`, {
    method: "GET",
    headers,
  });
}

describe("GET /api/settings — response shape (T1-3)", () => {
  it("returns 401 without a test-user header", async () => {
    const res = await getSettings();
    expect(res.status).toBe(401);
  });

  it("returns null masked key + defaults when the user has no settings row", async () => {
    mockSettings = null;
    const res = await getSettings({ "x-test-user": "u1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmProvider).toBe("groq");
    expect(body.llmModel).toBe("openai/gpt-oss-120b");
    expect(body.llmApiKeyMasked).toBeNull();
    expect(body.platformKeysAvailable).toBeDefined();
  });

  it("masks the key when one is configured (camelCase storage field)", async () => {
    const rawKey = "sk_test_abcdef1234567890XYZ";
    mockSettings = { llmProvider: "anthropic", llmModel: "claude-sonnet-4", llmApiKey: rawKey };
    const res = await getSettings({ "x-test-user": "u1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmApiKeyMasked).toBe(`${rawKey.slice(0, 7)}...${rawKey.slice(-4)}`);
    expect(body.llmProvider).toBe("anthropic");
    expect(body.llmModel).toBe("claude-sonnet-4");
  });

  it("masks the key when storage uses snake_case (llm_api_key)", async () => {
    const rawKey = "sk_test_SNAKEcase1234567890";
    mockSettings = { llm_provider: "anthropic", llm_model: "claude-sonnet-4", llm_api_key: rawKey };
    const res = await getSettings({ "x-test-user": "u1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmApiKeyMasked).toBe(`${rawKey.slice(0, 7)}...${rawKey.slice(-4)}`);
    expect(body.llmProvider).toBe("anthropic");
    expect(body.llmModel).toBe("claude-sonnet-4");
  });

  it("NEVER returns a raw key field — regardless of casing on the storage row", async () => {
    // Hostile-shape storage row: both camel + snake variants present, plus a
    // hypothetical future-rename field. Allowlist must drop all of them.
    const rawKey = "sk_test_REGRESSION_GUARD_xyz";
    mockSettings = {
      id: "settings-1",
      user_id: "u1",
      llmProvider: "groq",
      llm_provider: "groq",
      llmModel: "openai/gpt-oss-120b",
      llm_model: "openai/gpt-oss-120b",
      llmApiKey: rawKey,
      llm_api_key: rawKey,
      llm_api_key_v2: rawKey,   // hypothetical future column rename
      llmKeyEncrypted: rawKey,  // hypothetical join column
      updated_at: new Date(),
    };
    const res = await getSettings({ "x-test-user": "u1" });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Spec: the response is exactly the four allowlisted top-level keys.
    expect(Object.keys(body).sort()).toEqual(
      ["llmApiKeyMasked", "llmModel", "llmProvider", "platformKeysAvailable"].sort(),
    );

    // Spec: no raw-key field (any variant) is present.
    const serialized = JSON.stringify(body);
    expect(body).not.toHaveProperty("llmApiKey");
    expect(body).not.toHaveProperty("llm_api_key");
    expect(body).not.toHaveProperty("llm_api_key_v2");
    expect(body).not.toHaveProperty("llmKeyEncrypted");
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("updated_at");

    // Defense-in-depth: the raw key string itself never appears anywhere in
    // the response body (catches a future bug where a nested field carries
    // the key under a renamed top-level path).
    expect(serialized).not.toContain(rawKey);

    // Mask is still produced.
    expect(body.llmApiKeyMasked).toBe(`${rawKey.slice(0, 7)}...${rawKey.slice(-4)}`);
  });
});
