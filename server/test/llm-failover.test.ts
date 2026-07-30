/**
 * Execution coverage for the cross-provider failover.
 *
 * The first version of these tests only re-asserted classifyLlmError, so
 * deleting resolveFailover's body entirely would have left the suite green —
 * on the one piece of new code that spends money. These drive AIService with
 * the provider calls stubbed and assert on WHICH provider was actually called.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { aiService } from "../services/ai";

const SPEND_BLOCK = Object.assign(
  new Error(
    '400 {"error":{"message":"Organization has blocked API access because a spend alert threshold was met.",' +
      '"type":"invalid_request_error","code":"spend_limit_reached"}}',
  ),
  { status: 400 },
);
const RATE_LIMIT = Object.assign(new Error("429 rate limit reached"), { status: 429 });
const SERVER_ERROR = Object.assign(new Error("503 service unavailable"), { status: 503 });

const svc = aiService as any;
const MSGS = [{ role: "user" as const, content: "hi" }];

let calls: Array<{ provider: "groq" | "anthropic"; model: string }>;
const ENV = { ...process.env };

/** Stub both provider transports; `failing` decides which ones throw. */
function stubProviders(opts: { groqThrows?: unknown; anthropicThrows?: unknown } = {}) {
  vi.spyOn(svc, "chatWithGroq").mockImplementation(async (...args: any[]) => {
    calls.push({ provider: "groq", model: args[1] });
    if (opts.groqThrows) throw opts.groqThrows;
    return { content: "groq-ok" };
  });
  vi.spyOn(svc, "chatWithClaude").mockImplementation(async (...args: any[]) => {
    calls.push({ provider: "anthropic", model: args[1] });
    if (opts.anthropicThrows) throw opts.anthropicThrows;
    return { content: "anthropic-ok" };
  });
}

beforeEach(() => {
  calls = [];
  process.env.GROQ_API_KEY = "gsk_test";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  delete process.env.LLM_FAILOVER_DISABLED;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

describe("failover fires on a hard block", () => {
  it("retries a Groq spend block on Anthropic and returns its content", async () => {
    stubProviders({ groqThrows: SPEND_BLOCK });
    const res = await aiService.chat(MSGS, "claude-sonnet", null, "chat");
    expect(calls.map((c) => c.provider)).toEqual(["groq", "anthropic"]);
    expect(res.content).toBe("anthropic-ok");
    expect(res.failedOver).toBe(true);
    expect(res.providerUsed).toBe("anthropic");
  });

  it("marks a normal call as not-failed-over", async () => {
    stubProviders();
    const res = await aiService.chat(MSGS, "claude-sonnet", null, "chat");
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
    expect(res.failedOver).toBe(false);
  });

  it("uses the failover's task-tiered model, not the caller's model argument", async () => {
    stubProviders({ groqThrows: SPEND_BLOCK });
    await aiService.chat(MSGS, "claude-sonnet", null, "classification");
    // Was silently collapsing to claude-sonnet-4-5 because dispatchChat
    // resolved the caller's `model` before config.model.
    expect(calls[1]).toMatchObject({ provider: "anthropic", model: "claude-haiku-4-5" });
  });

  it("attempts the secondary exactly once and propagates its error", async () => {
    const secondary = Object.assign(new Error("400 anthropic also blocked"), { status: 400 });
    stubProviders({ groqThrows: SPEND_BLOCK, anthropicThrows: secondary });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow(
      "anthropic also blocked",
    );
    expect(calls.map((c) => c.provider)).toEqual(["groq", "anthropic"]);
  });
});

describe("failover does NOT fire", () => {
  it("does not fail over on a rate limit", async () => {
    stubProviders({ groqThrows: RATE_LIMIT });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
  });

  it("does not fail over on a 5xx", async () => {
    stubProviders({ groqThrows: SERVER_ERROR });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
  });

  it("does not spend platform credit for a BYOK user whose own key is blocked", async () => {
    stubProviders({ groqThrows: SPEND_BLOCK });
    await expect(
      aiService.chat(MSGS, "claude-sonnet", { provider: "groq", apiKey: "user-own-key" }, "chat"),
    ).rejects.toThrow();
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
  });

  it("respects the LLM_FAILOVER_DISABLED kill switch", async () => {
    process.env.LLM_FAILOVER_DISABLED = "1";
    stubProviders({ groqThrows: SPEND_BLOCK });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
  });

  it("does not fail over when the secondary provider has no key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    stubProviders({ groqThrows: SPEND_BLOCK });
    await expect(aiService.chat(MSGS, "claude-sonnet", null, "chat")).rejects.toThrow();
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
  });
});

describe("streaming failover cannot splice two completions", () => {
  function stubStreams(opts: { groqDeltasBeforeThrow: number }) {
    vi.spyOn(svc, "streamGroq").mockImplementation(async function* () {
      calls.push({ provider: "groq", model: "groq" });
      for (let i = 0; i < opts.groqDeltasBeforeThrow; i++) {
        yield { type: "delta", text: `g${i}` };
      }
      throw SPEND_BLOCK;
    });
    vi.spyOn(svc, "streamClaude").mockImplementation(async function* () {
      calls.push({ provider: "anthropic", model: "anthropic" });
      yield { type: "delta", text: "a0" };
      yield { type: "done", fullContent: "a0" };
    });
  }

  it("fails over when the block lands before any delta reaches the client", async () => {
    stubStreams({ groqDeltasBeforeThrow: 0 });
    const out: string[] = [];
    for await (const c of aiService.chatStream(MSGS, "claude-sonnet", null, "chat")) {
      if (c.type === "delta") out.push(c.text);
    }
    expect(calls.map((c) => c.provider)).toEqual(["groq", "anthropic"]);
    expect(out).toEqual(["a0"]);
  });

  it("rethrows instead of failing over once text is already on screen", async () => {
    stubStreams({ groqDeltasBeforeThrow: 2 });
    const out: string[] = [];
    await expect(
      (async () => {
        for await (const c of aiService.chatStream(MSGS, "claude-sonnet", null, "chat")) {
          if (c.type === "delta") out.push(c.text);
        }
      })(),
    ).rejects.toThrow();
    // Only Groq ran, and the partial text was NOT concatenated with an
    // Anthropic completion.
    expect(calls.map((c) => c.provider)).toEqual(["groq"]);
    expect(out).toEqual(["g0", "g1"]);
  });
});
