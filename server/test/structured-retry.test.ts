/**
 * Test 4 — structured-output retry path on invalid JSON.
 *
 * Asserts the runStructuredWithRetry helper:
 *   - returns {retried: false} when the first response parses
 *   - retries ONCE with the schema-reminder block appended when the first
 *     response fails to parse, and returns {retried: true} on success
 *   - throws when both attempts fail (no silent fallback to {})
 *
 * Mocks the Anthropic call by passing a fake `caller` so we don't hit the
 * network. The retry helper is the contract; the production path
 * (generateStructuredOutputWithBlocks) wraps this same logic.
 */
import { describe, expect, it } from "vitest";
import {
  runStructuredWithRetry,
  extractJSONFromText,
  STRUCTURED_RETRY_REMINDER,
  type SystemBlock,
} from "../services/ai";

const baseBlocks: SystemBlock[] = [
  { type: "text", text: "instruction" },
  { type: "text", text: "<PROJECT_CONTEXT>data</PROJECT_CONTEXT>", cache_control: { type: "ephemeral" } },
];

describe("runStructuredWithRetry", () => {
  it("returns first-pass result when JSON parses", async () => {
    let calls = 0;
    const result = await runStructuredWithRetry(
      baseBlocks,
      async () => {
        calls += 1;
        return { content: '{"ok": true}' };
      },
      extractJSONFromText,
    );
    expect(calls).toBe(1);
    expect(result.retried).toBe(false);
    expect(result.json).toEqual({ ok: true });
  });

  it("retries once with reminder block when first response is unparseable", async () => {
    const calls: SystemBlock[][] = [];
    const result = await runStructuredWithRetry(
      baseBlocks,
      async (blocks) => {
        calls.push(blocks);
        if (calls.length === 1) return { content: "not json at all" };
        return { content: '{"ok": true}' };
      },
      extractJSONFromText,
    );
    expect(calls).toHaveLength(2);
    expect(result.retried).toBe(true);
    expect(result.json).toEqual({ ok: true });
    // Second call must include the schema-reminder block at the end.
    const lastBlock = calls[1][calls[1].length - 1];
    expect(lastBlock.text).toContain("not valid JSON");
    expect(lastBlock).toEqual(STRUCTURED_RETRY_REMINDER);
  });

  it("throws when second pass also fails to parse", async () => {
    let calls = 0;
    await expect(
      runStructuredWithRetry(
        baseBlocks,
        async () => {
          calls += 1;
          return { content: "still garbage" };
        },
        extractJSONFromText,
      ),
    ).rejects.toThrow(/Could not extract JSON/);
    expect(calls).toBe(2); // attempted exactly twice
  });
});
