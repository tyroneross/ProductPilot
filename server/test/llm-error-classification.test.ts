import { describe, it, expect, afterEach } from "vitest";
import { classifyLlmError, toSafeUserMessage } from "../services/ai";

// Captured verbatim from api.groq.com on 2026-07-29 while the outage was live
// (direct curl against the same key prod uses). The Groq SDK surfaces the
// upstream body inside .message. Note the `code` here is `spend_limit_reached`,
// which does NOT match the code Groq documents for this state
// (`blocked_api_access`, per console.groq.com/docs/spend-limits) — that
// mismatch is exactly why the classifier matches code, code-family, AND text
// rather than trusting any single signal.
const PROD_GROQ_SPEND_BLOCK = Object.assign(
  new Error(
    '400 {"error":{"message":"Organization has blocked API access because a spend alert threshold was met. ' +
      'Please visit https://console.groq.com/settings/billing to manage your spend alerts.",' +
      '"type":"invalid_request_error","code":"spend_limit_reached"}}',
  ),
  { status: 400 },
);

const DOCUMENTED_GROQ_BLOCK = Object.assign(
  new Error('400 {"error":{"message":"API access blocked.","type":"invalid_request_error","code":"blocked_api_access"}}'),
  { status: 400 },
);

const ANTHROPIC_CREDIT_BLOCK = Object.assign(
  new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}'),
  { status: 400 },
);

describe("classifyLlmError — billing / spend block", () => {
  it("classifies the exact production Groq spend-block payload as billing_blocked", () => {
    const result = classifyLlmError(PROD_GROQ_SPEND_BLOCK, "groq");
    expect(result.code).toBe("billing_blocked");
  });

  it("classifies Groq's documented blocked_api_access code as billing_blocked", () => {
    expect(classifyLlmError(DOCUMENTED_GROQ_BLOCK, "groq").code).toBe("billing_blocked");
  });

  it("classifies an Anthropic low-credit-balance error as billing_blocked", () => {
    expect(classifyLlmError(ANTHROPIC_CREDIT_BLOCK, "anthropic").code).toBe("billing_blocked");
  });

  // This is the defect the user actually saw: raw provider JSON in a toast.
  it("never leaks raw provider JSON into the user-facing message", () => {
    const result = classifyLlmError(PROD_GROQ_SPEND_BLOCK, "groq");
    expect(result.message).not.toContain('{"error"');
    expect(result.message).not.toContain("invalid_request_error");
    expect(result.message).not.toContain("spend_limit_reached");
    // The original text is preserved for logs, just not for the user.
    expect(result.details).toContain("spend_limit_reached");
  });

  it("does not tell the user to retry a state that retrying cannot clear", () => {
    const result = classifyLlmError(PROD_GROQ_SPEND_BLOCK, "groq");
    expect(result.retryAfterSeconds).toBeNull();
    expect(result.message.toLowerCase()).toContain("not something retrying will fix");
  });
});

describe("classifyLlmError — no regression on adjacent classes", () => {
  it("still classifies 429 as rate_limit, not billing_blocked", () => {
    const err = Object.assign(new Error("429 rate limit reached for model"), { status: 429 });
    expect(classifyLlmError(err, "groq").code).toBe("rate_limit");
  });

  it("still classifies 401 as invalid_key", () => {
    const err = Object.assign(new Error("401 Invalid API Key"), { status: 401 });
    expect(classifyLlmError(err, "groq").code).toBe("invalid_key");
  });

  it("still classifies 503 as provider_unavailable", () => {
    const err = Object.assign(new Error("503 service unavailable"), { status: 503 });
    expect(classifyLlmError(err, "groq").code).toBe("provider_unavailable");
  });

  it("still classifies a context-window 400 as context_too_large, not billing_blocked", () => {
    const err = Object.assign(
      new Error("400 Please reduce the length of the messages: maximum context length is 8192 tokens"),
      { status: 400 },
    );
    expect(classifyLlmError(err, "groq").code).toBe("context_too_large");
  });

  it("leaves an ordinary 400 as unknown", () => {
    const err = Object.assign(new Error("400 malformed request body"), { status: 400 });
    expect(classifyLlmError(err, "groq").code).toBe("unknown");
  });
});

describe("toSafeUserMessage", () => {
  it("returns the classified copy for a recognized LLM failure", () => {
    const safe = toSafeUserMessage(PROD_GROQ_SPEND_BLOCK, "groq", "fallback copy");
    expect(safe.errorCode).toBe("billing_blocked");
    expect(safe.message).not.toBe("fallback copy");
    expect(safe.message).not.toContain('{"error"');
  });

  it("returns the caller's fallback for a non-LLM error, never the raw message", () => {
    const dbErr = new Error('relation "projects" does not exist at character 42');
    const safe = toSafeUserMessage(dbErr, "groq", "Failed to generate documentation. Please try again.");
    expect(safe.errorCode).toBeNull();
    expect(safe.message).toBe("Failed to generate documentation. Please try again.");
    expect(safe.message).not.toContain("relation");
  });
});

describe("provider failover — hard-block only", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  // resolveFailover is private; these assert the policy it encodes via the
  // classification layer it depends on. A hard block must be failover-eligible;
  // a transient fault must not be, or a rate limit would double-spend across
  // both providers instead of backing off.
  it("treats billing_blocked and invalid_key as hard blocks", () => {
    expect(classifyLlmError(PROD_GROQ_SPEND_BLOCK, "groq").code).toBe("billing_blocked");
    expect(
      classifyLlmError(Object.assign(new Error("401 bad key"), { status: 401 }), "groq").code,
    ).toBe("invalid_key");
  });

  it("does not treat transient faults as hard blocks", () => {
    const transient = [
      Object.assign(new Error("429 rate limit"), { status: 429 }),
      Object.assign(new Error("503 service unavailable"), { status: 503 }),
      Object.assign(new Error("request timed out"), { status: null }),
    ];
    for (const err of transient) {
      expect(["rate_limit", "provider_unavailable", "timeout"]).toContain(
        classifyLlmError(err, "groq").code,
      );
    }
  });
});
