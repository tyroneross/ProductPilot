/**
 * Route-level coverage for the doc-generation endpoints under provider failure.
 *
 * WHY THIS FILE EXISTS
 * The 2026-07-29 incident shipped a fix whose unit tests all passed while the
 * user-visible bug remained: the server classified correctly, the client
 * discarded the result. Unit tests on either side could not see it. The
 * fix-critique named the missing layer precisely — no test drives the actual
 * endpoint with a failing provider and asserts on the response body.
 *
 * These do exactly that: real Express app, real route handlers, real
 * classification, with only the LLM transport and storage mocked.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import express from "express";
import type { AddressInfo } from "net";

// Captured verbatim from api.groq.com on 2026-07-29 during the live outage.
const PROD_GROQ_SPEND_BLOCK = Object.assign(
  new Error(
    '400 {"error":{"message":"Organization has blocked API access because a spend alert threshold was met. ' +
      'Please visit https://console.groq.com/settings/billing to manage your spend alerts.",' +
      '"type":"invalid_request_error","code":"spend_limit_reached"}}',
  ),
  { status: 400 },
);

const DEMO_OWNER_COOKIE = "productpilot_demo_owner";
const GUEST_ID = "guest-under-test";
const PROJECT_ID = "project-under-test";

const PROJECT = {
  id: PROJECT_ID,
  name: "tracks client progress",
  description: "an app that tracks client progress",
  userId: null,
  guestOwnerId: GUEST_ID,
  minimumDetails: { problemStatement: "an app that tracks client progress", userGoals: [], v1Definition: "" },
  surveyResponses: null,
  surveyDefinition: null,
  surveyPhase: "complete",
  intakeMode: "minimum",
  productState: null,
  aiModel: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const STAGES = [1, 2].map((n) => ({
  id: `stage-${n}`,
  projectId: PROJECT_ID,
  stageNumber: n,
  title: `Stage ${n}`,
  description: `desc ${n}`,
  systemPrompt: "you are a spec writer",
  progress: 0,
  aiModel: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

// Every route resolves the caller through getActorContext; presenting a guest
// header is the cheapest way in without booting Better Auth.
vi.mock("../auth", () => ({
  extractUser: (req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, res: any, _next: any) => res.status(401).json({ message: "Authentication required" }),
  trustedOrigins: ["http://localhost:5173"],
}));

let chatImpl: () => Promise<any> = async () => ({ content: "generated doc body" });
// generate-survey goes through generateStructuredOutput, not chat().
let structuredImpl: () => Promise<any> = async () => ({ sections: [] });

vi.mock("../services/ai", async () => {
  const real = await vi.importActual<typeof import("../services/ai")>("../services/ai");
  return {
    ...real, // classifyLlmError / toSafeUserMessage stay REAL — they are under test
    aiService: {
      ...real.aiService,
      chat: vi.fn(() => chatImpl()),
      generateStructuredOutput: vi.fn(() => structuredImpl()),
      calculateProgress: vi.fn(async () => 100),
    },
  };
});

vi.mock("../storage-hybrid", () => ({
  runWithDbActorContext: <T,>(_ctx: any, cb: () => T) => cb(),
  updateDbActorContext: () => {},
  storage: {
    getProject: vi.fn(async (id: string) => (id === PROJECT_ID ? PROJECT : undefined)),
    getStagesByProject: vi.fn(async () => STAGES),
    ensureStagesForProject: vi.fn(async () => STAGES),
    createStage: vi.fn(async () => STAGES[0]),
    updateStage: vi.fn(async () => STAGES[0]),
    createMessage: vi.fn(async () => ({ id: "m1" })),
    getMessagesByStage: vi.fn(async () => []),
    getAllAdminPrompts: vi.fn(async () => []),
    getAdminPromptByTargetKey: vi.fn(async () => undefined),
    getUserSettings: vi.fn(async () => null),
    createAuditEvent: vi.fn(async () => {}),
    createLlmCall: vi.fn(async () => {}),
    getProjectsByUserId: vi.fn(async () => []),
    getProjectsByGuestOwnerId: vi.fn(async () => []),
    getUserDraft: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getStage: vi.fn(async () => STAGES[0]),
    getDeliverablesByStage: vi.fn(async () => []),
    getAdminPrompt: vi.fn(),
    createAdminPrompt: vi.fn(),
    updateAdminPrompt: vi.fn(),
    deleteAdminPrompt: vi.fn(),
    seedDefaultPrompts: vi.fn(),
    upsertUserSettings: vi.fn(),
    listLlmCalls: vi.fn(async () => ({ rows: [], total: 0 })),
    getLlmCall: vi.fn(),
    listAuditEvents: vi.fn(async () => ({ rows: [], total: 0 })),
    getAuditEvent: vi.fn(),
    createIntakeQuestion: vi.fn(),
    updateIntakeQuestionAnswer: vi.fn(),
    getIntakeQuestionsByProject: vi.fn(async () => []),
  },
}));

let baseUrl = "";
let server: ReturnType<typeof createServer> | null = null;

beforeEach(async () => {
  vi.resetModules();
  chatImpl = async () => ({ content: "generated doc body" });
  structuredImpl = async () => ({ sections: [] });
  const { registerRoutes } = await import("../routes");
  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  vi.restoreAllMocks();
});

async function postDocGen(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    // getActorContext -> getGuestOwnerId parses the real Cookie header.
    headers: { "Content-Type": "application/json", Cookie: `${DEMO_OWNER_COOKIE}=${GUEST_ID}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const ENDPOINTS = [
  {
    name: "generate-docs-from-minimum",
    path: `/api/projects/${PROJECT_ID}/generate-docs-from-minimum`,
    payload: { minimumDetails: { problemStatement: "an app that tracks client progress", userGoals: [], v1Definition: "" } },
  },
  {
    name: "generate-docs-from-survey",
    path: `/api/projects/${PROJECT_ID}/generate-docs-from-survey`,
    payload: { documentPreferences: [] },
  },
];

for (const ep of ENDPOINTS) {
  describe(`POST ${ep.name} — provider hard-blocked`, () => {
    it("responds with the classified errorCode, not a bare 500", async () => {
      chatImpl = async () => {
        throw PROD_GROQ_SPEND_BLOCK;
      };
      const { status, body } = await postDocGen(ep.path, ep.payload);
      // 401/403/404 would mean the harness failed to reach the handler at all.
      expect([401, 403, 404]).not.toContain(status);
      expect(body.errorCode).toBe("billing_blocked");
    });

    it("never puts raw provider JSON in the response body", async () => {
      chatImpl = async () => {
        throw PROD_GROQ_SPEND_BLOCK;
      };
      const { body } = await postDocGen(ep.path, ep.payload);
      const serialized = JSON.stringify(body);
      // Provider-payload markers must never appear.
      expect(serialized).not.toContain("invalid_request_error");
      expect(serialized).not.toContain("spend_limit_reached");
      expect(serialized).not.toContain('{\\"error\\"');
      expect(serialized).not.toContain("Organization has blocked API access");
      // The billing console URL IS present on purpose — it is actionable
      // guidance for a BYOK user, written by us, not echoed from the provider.
      expect(String(body.message)).toContain("console.groq.com/settings/billing");
    });

    it("does not tell the user to retry a non-retryable state", async () => {
      chatImpl = async () => {
        throw PROD_GROQ_SPEND_BLOCK;
      };
      const { body } = await postDocGen(ep.path, ep.payload);
      expect(body.retryAfterSeconds ?? null).toBeNull();
      expect(String(body.message)).toContain("not something retrying will fix");
    });

    it("carries the code on each per-stage failure, not just the envelope", async () => {
      chatImpl = async () => {
        throw PROD_GROQ_SPEND_BLOCK;
      };
      const { body } = await postDocGen(ep.path, ep.payload);
      const failures = body.failed ?? body.failures ?? [];
      expect(Array.isArray(failures)).toBe(true);
      for (const f of failures) {
        expect(f.errorCode).toBe("billing_blocked");
        expect(JSON.stringify(f)).not.toContain("spend_limit_reached");
      }
    });
  });
}

describe("adjacent failure classes over the wire", () => {
  it("reports a rate limit as rate_limit and preserves the retry hint", async () => {
    chatImpl = async () => {
      throw Object.assign(new Error("429 rate limit reached"), {
        status: 429,
        headers: { "retry-after": "42" },
      });
    };
    const { body } = await postDocGen(ENDPOINTS[0].path, ENDPOINTS[0].payload);
    expect(body.errorCode).toBe("rate_limit");
    expect(body.retryAfterSeconds).toBe(42);
  });

  it("reports a retired model as model_unavailable", async () => {
    chatImpl = async () => {
      throw Object.assign(
        new Error(
          '400 {"error":{"message":"The model `mixtral-8x7b-32768` has been decommissioned and is no longer supported.",' +
            '"type":"invalid_request_error","code":"model_decommissioned"}}',
        ),
        { status: 400 },
      );
    };
    const { body } = await postDocGen(ENDPOINTS[0].path, ENDPOINTS[0].payload);
    expect(body.errorCode).toBe("model_unavailable");
  });

  it("does not label a non-LLM fault as a provider problem", async () => {
    chatImpl = async () => {
      throw new Error('relation "stages" does not exist at character 42');
    };
    const { body } = await postDocGen(ENDPOINTS[0].path, ENDPOINTS[0].payload);
    expect(body.errorCode ?? "unknown").toBe("unknown");
    expect(JSON.stringify(body)).not.toContain("does not exist at character");
  });

  it("succeeds normally when the provider is healthy", async () => {
    const { status, body } = await postDocGen(ENDPOINTS[0].path, ENDPOINTS[0].payload);
    expect(status).toBe(200);
    expect(body.errorCode).toBeUndefined();
  });
});

// C1: routes whose catch previously returned a flat 500 with no errorCode, so
// the client's LLM_ERROR_TITLES mapping could never fire on them.
describe("other LLM-backed routes classify provider faults", () => {
  const ROUTES = [
    { name: "enhance-idea", path: "/api/enhance-idea", payload: { idea: "an app that tracks client progress" } },
    { name: "generate-survey", path: `/api/projects/${PROJECT_ID}/generate-survey`, payload: {} },
  ];

  for (const r of ROUTES) {
    it(`${r.name} returns errorCode for a billing block`, async () => {
      const boom = async () => {
        throw PROD_GROQ_SPEND_BLOCK;
      };
      chatImpl = boom;
      structuredImpl = boom;
      const { body } = await postDocGen(r.path, r.payload);
      expect(body.errorCode).toBe("billing_blocked");
      expect(JSON.stringify(body)).not.toContain("spend_limit_reached");
    });
  }
});
