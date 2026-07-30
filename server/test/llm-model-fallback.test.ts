/**
 * Execution coverage for the intra-Groq model fallback.
 *
 * Replaces the earlier cross-provider failover tests. ProductPilot is
 * single-provider on Groq by choice, so an ACCOUNT-level block (spend limit,
 * revoked key) is org-wide and unrecoverable in code — that path is alerted on,
 * not retried. What IS recoverable is a MODEL-level failure: Groq retires
 * models on a rolling schedule, so a pinned id has an expiry we do not control.
 *
 * Error codes verified against the live Groq API on 2026-07-30:
 *   mixtral-8x7b-32768        -> HTTP 400 model_decommissioned
 *   llama-3.1-70b-versatile   -> HTTP 400 model_decommissioned
 *   <unknown id>              -> HTTP 404 model_not_found
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { aiService, classifyLlmError } from "../services/ai";

const DECOMMISSIONED = Object.assign(
  new Error(
    '400 {"error":{"message":"The model `mixtral-8x7b-32768` has been decommissioned and is no longer supported. ' +
      'Please refer to https://console.groq.com/docs/deprecations","type":"invalid_request_error",' +
      '"code":"model_decommissioned"}}',
  ),
  { status: 400 },
);
const MODEL_NOT_FOUND = Object.assign(
  new Error(
    '404 {"error":{"message":"The model `totally-fake-model-xyz` does not exist or you do not have access to it.",' +
      '"type":"invalid_request_error","code":"model_not_found"}}',
  ),
  { status: 404 },
);
const SPEND_BLOCK = Object.assign(
  new Error(
    '400 {"error":{"message":"Organization has blocked API access because a spend alert threshold was met.",' +
      '"type":"invalid_request_error","code":"spend_limit_reached"}}',
  ),
  { status: 400 },
);
const RATE_LIMIT = Object.assign(new Error("429 rate limit reached"), { status: 429 });

const REASONING = "openai/gpt-oss-120b";
const FAST = "llama-3.1-8b-instant";

const svc = aiService as any;
const MSGS = [{ role: "user" as const, content: "hi" }];
const ENV = { ...process.env };

let calls: string[];

/** `failFirstWith` throws on the first call only, so the retry can succeed. */
function stubGroq(opts: { failFirstWith?: unknown; failAlwaysWith?: unknown } = {}) {
  let n = 0;
  vi.spyOn(svc, "chatWithGroq").mockImplementation(async (...args: any[]) => {
    calls.push(args[1]);
    n++;
    if (opts.failAlwaysWith) throw opts.failAlwaysWith;
    if (opts.failFirstWith && n === 1) throw opts.failFirstWith;
    return { content: "ok" };
  });
}

beforeEach(() => {
  calls = [];
  process.env.GROQ_API_KEY = "gsk_test";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.LLM_MODEL_FALLBACK_DISABLED;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

describe("classification of model-level failures", () => {
  it("classifies a decommissioned model as model_unavailable", () => {
    expect(classifyLlmError(DECOMMISSIONED, "groq").code).toBe("model_unavailable");
  });

  it("classifies an unknown model as model_unavailable", () => {
    expect(classifyLlmError(MODEL_NOT_FOUND, "groq").code).toBe("model_unavailable");
  });

  it("keeps an account block distinct from a model failure", () => {
    expect(classifyLlmError(SPEND_BLOCK, "groq").code).toBe("billing_blocked");
  });

  it("never leaks the provider payload for a model failure", () => {
    const r = classifyLlmError(DECOMMISSIONED, "groq");
    expect(r.message).not.toContain('{"error"');
    expect(r.message).not.toContain("model_decommissioned");
    expect(r.details).toContain("model_decommissioned");
  });
});

describe("fallback fires on a retired model", () => {
  it("retries the reasoning tier on the fast model and succeeds", async () => {
    stubGroq({ failFirstWith: DECOMMISSIONED });
    const res = await aiService.chat(MSGS, "claude-sonnet", null, "deliverable");
    expect(calls).toEqual([REASONING, FAST]);
    expect(res.content).toBe("ok");
    expect(res.failedOver).toBe(true);
    expect(res.modelUsed).toBe(FAST);
  });

  it("retries the fast tier on the reasoning model", async () => {
    stubGroq({ failFirstWith: MODEL_NOT_FOUND });
    const res = await aiService.chat(MSGS, "claude-sonnet", null, "chat");
    expect(calls).toEqual([FAST, REASONING]);
    expect(res.failedOver).toBe(true);
  });

  it("never retries the same model that just failed", async () => {
    stubGroq({ failAlwaysWith: DECOMMISSIONED });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "deliverable")).rejects.toThrow();
    expect(calls).toEqual([REASONING, FAST]);
    expect(new Set(calls).size).toBe(calls.length);
  });

  it("attempts the fallback exactly once and propagates its error", async () => {
    stubGroq({ failAlwaysWith: DECOMMISSIONED });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });

  it("applies to BYOK too — switching models spends only the caller's own key", async () => {
    stubGroq({ failFirstWith: DECOMMISSIONED });
    const res = await aiService.chat(
      MSGS,
      "claude-sonnet",
      { provider: "groq", apiKey: "user-own-key", model: REASONING },
      "chat",
    );
    expect(calls).toEqual([REASONING, FAST]);
    expect(res.failedOver).toBe(true);
  });

  it("falls back to a known-good model when the failed id is off-chain", async () => {
    stubGroq({ failFirstWith: DECOMMISSIONED });
    await aiService.chat(
      MSGS,
      "claude-sonnet",
      { provider: "groq", apiKey: "k", model: "some-stale-model-from-a-settings-row" },
      "chat",
    );
    expect(calls).toEqual(["some-stale-model-from-a-settings-row", FAST]);
  });
});

describe("fallback does NOT fire", () => {
  it("does not retry an account-level spend block — it is org-wide", async () => {
    stubGroq({ failFirstWith: SPEND_BLOCK });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls).toEqual([FAST]);
  });

  it("does not retry a rate limit", async () => {
    stubGroq({ failFirstWith: RATE_LIMIT });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls).toEqual([FAST]);
  });

  it("respects the LLM_MODEL_FALLBACK_DISABLED kill switch", async () => {
    process.env.LLM_MODEL_FALLBACK_DISABLED = "1";
    stubGroq({ failFirstWith: DECOMMISSIONED });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls).toEqual([FAST]);
  });

  it("marks a normal call as not-failed-over", async () => {
    stubGroq();
    const res = await aiService.chat(MSGS, "claude-sonnet", null, "chat");
    expect(calls).toEqual([FAST]);
    expect(res.failedOver).toBe(false);
  });
});

describe("streaming fallback cannot splice two completions", () => {
  function stubStreams(deltasBeforeThrow: number) {
    let n = 0;
    vi.spyOn(svc, "streamGroq").mockImplementation(async function* (...args: any[]) {
      calls.push(args[1]);
      n++;
      if (n === 1) {
        for (let i = 0; i < deltasBeforeThrow; i++) yield { type: "delta", text: `g${i}` };
        throw DECOMMISSIONED;
      }
      yield { type: "delta", text: "fallback" };
      yield { type: "done", fullContent: "fallback" };
    });
  }

  it("falls back when the model error lands before any delta", async () => {
    stubStreams(0);
    const out: string[] = [];
    for await (const c of aiService.chatStream(MSGS, "claude-sonnet", null, "chat")) {
      if (c.type === "delta") out.push(c.text);
    }
    expect(calls).toEqual([FAST, REASONING]);
    expect(out).toEqual(["fallback"]);
  });

  it("rethrows rather than splicing once text is already on screen", async () => {
    stubStreams(2);
    const out: string[] = [];
    await expect(
      (async () => {
        for await (const c of aiService.chatStream(MSGS, "claude-sonnet", null, "chat")) {
          if (c.type === "delta") out.push(c.text);
        }
      })(),
    ).rejects.toThrow();
    expect(calls).toEqual([FAST]);
    expect(out).toEqual(["g0", "g1"]);
  });
});
