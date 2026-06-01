/**
 * assessDiscoverySufficiency — the self-contained 80/20 gate behind the
 * discovery sufficiency ring.
 *
 * The per-section state is an LLM classification (mocked here), but the `enough`
 * gate is computed deterministically from it: the high-value sections (brief +
 * north-star) must not be open AND at most two sections may remain open.
 *
 * Strategy mirrors intake-controller.test.ts: mock aiService.generateStructuredOutput
 * at the module boundary before importing the controller.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { SECTIONS, type SectionState } from "@shared/intake-sections";

vi.mock("../services/ai", () => ({
  aiService: { generateStructuredOutput: vi.fn() },
}));

import { aiService } from "../services/ai";
import { assessDiscoverySufficiency } from "../services/intake-controller";

const llmMock = aiService.generateStructuredOutput as ReturnType<typeof vi.fn>;

beforeEach(() => llmMock.mockReset());

function convo(): Array<{ role: "user" | "assistant"; content: string }> {
  return [
    { role: "assistant", content: "What are you building and who is it for?" },
    { role: "user", content: "A planning tool for engineering managers whose sprints stall." },
  ];
}

/** Mocked classification as the FLAT { key: state } map the models actually
 *  return (defaults to open). */
function classify(overrides: Partial<Record<string, SectionState>>) {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, overrides[s.key] ?? "open"]));
}

describe("assessDiscoverySufficiency", () => {
  it("returns all-open + enough=false with no user turns, without calling the LLM", async () => {
    const result = await assessDiscoverySufficiency(
      [{ role: "assistant", content: "Hi, what are you building?" }],
      {},
    );
    expect(result.enough).toBe(false);
    expect(result.sections.every((s) => s.state === "open")).toBe(true);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("enough=true when core sections are covered and <=2 remain open", async () => {
    llmMock.mockResolvedValue(
      classify({ brief: "covered", "north-star": "covered", ux: "inferred", architecture: "open", "coding-prompts": "inferred", "dev-guide": "open" }),
    );
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.enough).toBe(true);
    expect(result.sections.find((s) => s.key === "brief")?.state).toBe("covered");
  });

  it("enough=false when a high-value (core) section is still open", async () => {
    llmMock.mockResolvedValue(
      classify({ brief: "covered", "north-star": "open", ux: "covered", architecture: "covered", "coding-prompts": "covered", "dev-guide": "covered" }),
    );
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.enough).toBe(false);
  });

  it("enough=false when more than two sections are open even with core covered", async () => {
    llmMock.mockResolvedValue(
      classify({ brief: "covered", "north-star": "inferred", ux: "open", architecture: "open", "coding-prompts": "open", "dev-guide": "covered" }),
    );
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.enough).toBe(false);
  });

  it("falls back to all-open when no key matches a section", async () => {
    llmMock.mockResolvedValue({ not: "a section", another: "open" });
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.enough).toBe(false);
    expect(result.sections).toHaveLength(SECTIONS.length);
    expect(result.sections.every((s) => s.state === "open")).toBe(true);
  });

  it("also accepts the { sections: [{key,state}] } array shape", async () => {
    llmMock.mockResolvedValue({
      sections: [
        { key: "brief", state: "covered" },
        { key: "north-star", state: "covered" },
        { key: "ux", state: "inferred" },
        { key: "architecture", state: "inferred" },
      ],
    });
    // core covered + only coding-prompts & dev-guide open (2) -> enough.
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.enough).toBe(true);
    expect(result.sections.find((s) => s.key === "brief")?.state).toBe("covered");
  });

  it("matches keys leniently (case / punctuation drift)", async () => {
    llmMock.mockResolvedValue({ Brief: "covered", "NORTH_STAR": "covered", "ux": "covered", architecture: "covered" });
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.sections.find((s) => s.key === "brief")?.state).toBe("covered");
    expect(result.sections.find((s) => s.key === "north-star")?.state).toBe("covered");
  });

  it("always returns all six sections with valid states and labels", async () => {
    llmMock.mockResolvedValue(classify({ brief: "covered", "north-star": "inferred" }));
    const result = await assessDiscoverySufficiency(convo(), {});
    expect(result.sections.map((s) => s.key)).toEqual(SECTIONS.map((s) => s.key));
    for (const s of result.sections) {
      expect(["covered", "inferred", "open"]).toContain(s.state);
      expect(typeof s.label).toBe("string");
    }
  });
});
