/**
 * Phase 2 — secret-scrub gate.
 *
 * Asserts that productState containing secret-shaped strings is redacted BEFORE
 * reaching the AIService mock. We capture the AIService call args and grep for
 * patterns that should never make it through.
 */

import { describe, expect, it, vi } from "vitest";
import { ProductStateSchema, SpecSchema } from "@shared/schema";

vi.mock("../services/ai", () => ({
  aiService: { generateStructuredOutput: vi.fn() },
}));

import { aiService } from "../services/ai";
import { callBlockingScorer, callMethodRouter } from "../services/intake-controller";
import { scrubString, scrubSecretsDeep } from "../lib/secret-crypto";

const generateStructuredOutputMock = aiService.generateStructuredOutput as ReturnType<typeof vi.fn>;

describe("scrubString — direct unit", () => {
  it("redacts Anthropic key shapes", () => {
    const out = scrubString("Use sk-ant-abcdefghijklmnopqrstuvwxyz123 for Claude.");
    expect(out).not.toContain("sk-ant-");
    expect(out).toContain("[REDACTED:anthropic-key]");
  });

  it("redacts ANTHROPIC_API_KEY=value shapes", () => {
    const out = scrubString("config: ANTHROPIC_API_KEY=sk-ant-aaaaaaaaaaaaaaaaaaaaaaaaaa here");
    // Either the kv-pair or the anthropic-key pattern should fire — both redact.
    expect(out).not.toContain("sk-ant-aaaaa");
    expect(out).toMatch(/\[REDACTED:(kv-pair|anthropic-key)\]/);
  });

  it("redacts our own enc:v1 markers", () => {
    const out = scrubString("Stored: enc:v1:aaaa:bbbb:cccc — copy carefully.");
    expect(out).not.toContain("enc:v1:aaaa");
    expect(out).toContain("[REDACTED:enc]");
  });

  it("leaves non-secret strings alone", () => {
    const out = scrubString("This is a totally normal sentence with no secrets.");
    expect(out).toBe("This is a totally normal sentence with no secrets.");
  });
});

describe("scrubSecretsDeep — recursion through productState", () => {
  it("walks nested objects and arrays", () => {
    const input = {
      a: "innocent",
      b: { c: "sk-ant-zzzzzzzzzzzzzzzzzzzzzzzzzzzz" },
      d: ["clean", "ANTHROPIC_API_KEY=sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaa"],
      n: 42,
      bool: true,
      nul: null,
    };
    const out = scrubSecretsDeep(input);
    expect(out.a).toBe("innocent");
    expect(out.b.c).not.toContain("sk-ant-zzz");
    expect(out.d[0]).toBe("clean");
    expect(out.d[1]).not.toContain("sk-proj-");
    expect(out.n).toBe(42);
    expect(out.bool).toBe(true);
    expect(out.nul).toBeNull();
  });

  it("does not mutate the input object", () => {
    const input = { a: "sk-ant-aaaaaaaaaaaaaaaaaaaaaaaaa" };
    scrubSecretsDeep(input);
    expect(input.a).toContain("sk-ant-");
  });
});

describe("controller end-to-end: AIService never sees raw secrets", () => {
  it("strips secret-shaped strings from productState before generateStructuredOutput is called", async () => {
    generateStructuredOutputMock.mockReset();
    generateStructuredOutputMock.mockResolvedValueOnce([
      { topic: "x", evidence: 0, reversibility: 0, risk: 5, blocking: 15, decision: "ask", reason: "" },
    ]);

    const dirtyState = ProductStateSchema.parse({
      workingMemory: {
        userNote: "I store ANTHROPIC_API_KEY=sk-ant-leakedleakedleakedleakedleakedleak in env",
        priorAnswer: "We use sk-ant-otherKEYotherKEYotherKEYotherKEYotherKEY for Claude",
      },
    });

    await callBlockingScorer(
      {
        productState: dirtyState,
        spec: SpecSchema.parse({ id: "s", productName: "x", productDescription: "y" }),
        candidates: [{ topic: "x", why_it_matters: "y" }],
      },
      {},
    );

    expect(generateStructuredOutputMock).toHaveBeenCalledTimes(1);
    const callArgs = generateStructuredOutputMock.mock.calls[0];
    // First arg is `messages: AIMessage[]`; user message holds the JSON-stringified payload.
    const userMessage = callArgs[0].find((m: any) => m.role === "user");
    expect(userMessage).toBeDefined();
    expect(userMessage.content).not.toContain("sk-ant-leakedleaked");
    expect(userMessage.content).not.toContain("sk-ant-otherKEY");
    // At least one redaction marker should appear.
    expect(userMessage.content).toMatch(/\[REDACTED:/);
  });

  it("method-router LLM call also redacts before send", async () => {
    generateStructuredOutputMock.mockReset();
    generateStructuredOutputMock.mockResolvedValueOnce({ method: "jtbd", reason: "" });

    const dirtyState = ProductStateSchema.parse({
      workingMemory: { token: "ghp_abcdefghijklmnopqrstuvwxyz0123456789AB" },
    });

    await callMethodRouter(
      {
        productState: dirtyState,
        spec: SpecSchema.parse({ id: "s", productName: "x", productDescription: "y" }),
      },
      {},
    );

    const userMessage = generateStructuredOutputMock.mock.calls[0][0].find((m: any) => m.role === "user");
    expect(userMessage.content).not.toContain("ghp_abcdef");
    expect(userMessage.content).toContain("[REDACTED:github-token]");
  });
});
