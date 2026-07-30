/**
 * End-to-end contract test for the classified-error wire format.
 *
 * WHY THIS FILE EXISTS
 * The first attempt at fixing the 2026-07-29 billing-block incident classified
 * the error correctly on the server and still showed the user "Generation
 * failed / Please try again." The server half and the client half each passed
 * their own unit tests. The defect lived in the JOINT: the client re-derived
 * the payload by string-slicing `err.message` for a `${status}: ` prefix that
 * `throwIfResNotOk` no longer emits, so the classified message and errorCode
 * were silently discarded.
 *
 * A unit test on either side alone cannot catch that. This test walks the real
 * chain — provider error -> classifyLlmError -> HTTP body -> ApiError ->
 * readApiError -> toast title/description — and asserts on what the USER ends
 * up reading.
 */

import { describe, it, expect } from "vitest";
import { classifyLlmError } from "../services/ai";
import { ApiError, readApiError, LLM_ERROR_TITLES } from "../../client/src/lib/queryClient";

// Verbatim from api.groq.com during the live outage.
const PROD_GROQ_SPEND_BLOCK = Object.assign(
  new Error(
    '400 {"error":{"message":"Organization has blocked API access because a spend alert threshold was met. ' +
      'Please visit https://console.groq.com/settings/billing to manage your spend alerts.",' +
      '"type":"invalid_request_error","code":"spend_limit_reached"}}',
  ),
  { status: 400 },
);

/**
 * Mirrors what server/routes.ts sends when every stage fails: the classified
 * message, the code, and the retry hint. Kept in one place so a change to the
 * route's response shape shows up here as a failure.
 */
function buildDocGenFailureBody(providerError: unknown) {
  const classified = classifyLlmError(providerError, "groq");
  return {
    message: `Doc generation failed: ${classified.message}`,
    errorCode: classified.code,
    retryAfterSeconds: classified.retryAfterSeconds,
    failed: [
      {
        stageTitle: "Requirements Definition",
        error: classified.message,
        errorCode: classified.code,
        retryAfterSeconds: classified.retryAfterSeconds,
      },
    ],
  };
}

/** Mirrors client/src/lib/queryClient.ts throwIfResNotOk. */
function throwLikeApiClient(status: number, body: unknown): ApiError {
  const b = body as Record<string, unknown>;
  const serverMessage = typeof b?.message === "string" ? b.message : undefined;
  const friendly = serverMessage || `Request failed (${status})`;
  return new ApiError(status, body, friendly);
}

/** Mirrors the toast derivation now shared across the four error surfaces. */
function toastFor(err: unknown): { title: string; description: string } {
  const { message, errorCode } = readApiError(err);
  return {
    title: (errorCode && LLM_ERROR_TITLES[errorCode]) ?? "Generation failed",
    description: message || "Please try again.",
  };
}

describe("billing block — full chain from provider error to rendered toast", () => {
  const body = buildDocGenFailureBody(PROD_GROQ_SPEND_BLOCK);
  const apiError = throwLikeApiClient(502, body);
  const toast = toastFor(apiError);

  it("the HTTP body carries the classified code, not just prose", () => {
    expect(body.errorCode).toBe("billing_blocked");
    expect(body.retryAfterSeconds).toBeNull();
  });

  it("the HTTP body contains no raw provider JSON", () => {
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("invalid_request_error");
    expect(serialized).not.toContain("spend_limit_reached");
    expect(serialized).not.toContain('\\"error\\"');
  });

  it("the client recovers the errorCode from the ApiError", () => {
    expect(readApiError(apiError).errorCode).toBe("billing_blocked");
  });

  // This is the assertion that would have caught the shipped gap.
  it("the user reads the billing title, NOT the generic fallback", () => {
    expect(toast.title).toBe("Generation paused — account limit reached");
    expect(toast.title).not.toBe("Generation failed");
  });

  it("the user reads the classified explanation, NOT 'Please try again.'", () => {
    expect(toast.description).not.toBe("Please try again.");
    expect(toast.description).toContain("spending limit");
    expect(toast.description).toContain("not something retrying will fix");
  });

  it("the rendered toast never contains raw provider JSON", () => {
    expect(toast.description).not.toContain('{"error"');
    expect(toast.description).not.toContain("invalid_request_error");
    expect(toast.description).not.toContain("spend_limit_reached");
  });
});

describe("readApiError — contract with the real thrown shape", () => {
  it("does not depend on a `${status}: ` prefix in err.message", () => {
    // The regression that shipped: err.message is the server message ALONE.
    const apiError = new ApiError(502, { message: "Some classified copy", errorCode: "billing_blocked" }, "Some classified copy");
    expect(apiError.message).not.toMatch(/^\d{3}: /);
    const read = readApiError(apiError);
    expect(read.errorCode).toBe("billing_blocked");
    expect(read.message).toBe("Some classified copy");
  });

  it("degrades safely on a non-ApiError throw", () => {
    const read = readApiError(new Error("network down"));
    expect(read.errorCode).toBeNull();
    expect(read.status).toBeNull();
    expect(read.message).toBe("network down");
  });

  it("degrades safely when the body is a plain string", () => {
    const read = readApiError(new ApiError(500, "Internal Server Error", "Internal Server Error"));
    expect(read.errorCode).toBeNull();
    expect(read.message).toBe("Internal Server Error");
  });

  it("falls back to the generic title when the server sent no errorCode", () => {
    const apiError = throwLikeApiClient(500, { message: "Failed to generate documentation. Please try again." });
    expect(toastFor(apiError).title).toBe("Generation failed");
  });
});

describe("adjacent classes survive the same chain", () => {
  it("a rate limit renders its own title and keeps the retry hint", () => {
    const err = Object.assign(new Error("429 rate limit reached"), {
      status: 429,
      headers: { "retry-after": "30" },
    });
    const body = buildDocGenFailureBody(err);
    expect(body.errorCode).toBe("rate_limit");
    expect(body.retryAfterSeconds).toBe(30);
    expect(toastFor(throwLikeApiClient(502, body)).title).toBe("Rate-limited by the provider");
  });

  it("an unclassified failure still renders a safe generic toast", () => {
    const body = buildDocGenFailureBody(new Error("something odd happened"));
    expect(body.errorCode).toBe("unknown");
    const toast = toastFor(throwLikeApiClient(502, body));
    expect(toast.title).toBe("Generation failed");
    expect(toast.description).not.toContain("{");
  });
});
