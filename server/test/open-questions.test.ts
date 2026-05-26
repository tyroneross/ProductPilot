/**
 * Defect #1 — open-questions parser/merge coverage.
 *
 * Covers the structured-trailer path, the markdown-heading fallback, the
 * merge that preserves user answers across regenerations, and applyAnswer.
 */

import { describe, expect, it } from "vitest";
import {
  extractOpenQuestions,
  mergeOpenQuestions,
  applyAnswer,
} from "../services/open-questions";
import type { OpenQuestion } from "@shared/schema";

const STAGE_ID = "stage-arch-1";

describe("extractOpenQuestions — structured trailer", () => {
  it("parses a valid JSON trailer", () => {
    const trailer = `<!-- open-questions: ${JSON.stringify([
      { topicId: "auth-mode", prompt: "Magic-link or password?", answerKind: "choice", answerChips: ["magic-link", "password"] },
      { topicId: "db", prompt: "Postgres or SQLite?", answerKind: "text", feedsField: "architecture.persistence" },
    ])} -->`;
    const result = extractOpenQuestions({ stageId: STAGE_ID, stageNumber: 4, content: `# Doc\n\nBody.\n\n${trailer}` });
    expect(result).toHaveLength(2);
    expect(result[0].topicId).toBe("auth-mode");
    expect(result[0].answerKind).toBe("choice");
    expect(result[0].answerChips).toEqual(["magic-link", "password"]);
    expect(result[0].stageId).toBe(STAGE_ID);
    expect(result[1].feedsField).toBe("architecture.persistence");
  });

  it("falls through to markdown heuristic when trailer JSON is invalid", () => {
    const content = "# Doc\n\n## Open Questions\n- What auth flow?\n- Which database?\n\n<!-- open-questions: not-json -->";
    const result = extractOpenQuestions({ stageId: STAGE_ID, content });
    expect(result.length).toBe(2);
    expect(result[0].prompt).toContain("auth");
    expect(result[0].answerKind).toBe("text");
  });
});

describe("extractOpenQuestions — markdown heuristic", () => {
  it("collects list items under an Open Questions heading", () => {
    const content = `
# Architecture

Body text.

## Open Questions

- Should we use OAuth or magic link?
- What's the persistence strategy?

## Next Steps
- ship something
`;
    const result = extractOpenQuestions({ stageId: STAGE_ID, content });
    expect(result.length).toBe(2);
    expect(result[0].prompt).toContain("OAuth or magic link");
    expect(result[1].prompt).toContain("persistence");
  });

  it("collects under Missing Information Needed", () => {
    const content = `
# Coding Prompts

## Missing Information Needed
- API base URL
- Error reporting endpoint

## Tasks
- foo
`;
    const result = extractOpenQuestions({ stageId: STAGE_ID, content });
    expect(result.length).toBe(2);
    expect(result[0].prompt).toBe("API base URL");
  });

  it("returns empty when no Open Questions section exists", () => {
    expect(extractOpenQuestions({ stageId: STAGE_ID, content: "# Doc\n\nJust body." })).toEqual([]);
  });
});

describe("mergeOpenQuestions", () => {
  it("preserves a prior answer when the same topicId is still present", () => {
    const existing: OpenQuestion[] = [
      {
        topicId: "auth-mode",
        stageId: STAGE_ID,
        prompt: "Auth?",
        answerKind: "text",
        answeredValue: "magic-link",
        answeredAt: "2026-05-26T00:00:00Z",
      },
    ];
    const incoming: OpenQuestion[] = [
      {
        topicId: "auth-mode",
        stageId: STAGE_ID,
        prompt: "Pick the auth flow (regenerated)",
        answerKind: "text",
      },
    ];
    const merged = mergeOpenQuestions(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].answeredValue).toBe("magic-link");
    expect(merged[0].prompt).toContain("regenerated");
  });

  it("keeps questions from OTHER stages we didn't extract this pass", () => {
    const existing: OpenQuestion[] = [
      { topicId: "x", stageId: "stage-prd", prompt: "P", answerKind: "text" },
    ];
    const incoming: OpenQuestion[] = [
      { topicId: "y", stageId: STAGE_ID, prompt: "Q", answerKind: "text" },
    ];
    const merged = mergeOpenQuestions(existing, incoming);
    expect(merged.map((m) => `${m.stageId}/${m.topicId}`).sort()).toEqual([
      `${STAGE_ID}/y`,
      "stage-prd/x",
    ]);
  });
});

describe("applyAnswer", () => {
  const base: OpenQuestion[] = [
    { topicId: "a", stageId: STAGE_ID, prompt: "P", answerKind: "text" },
    { topicId: "b", stageId: STAGE_ID, prompt: "Q", answerKind: "text" },
  ];

  it("marks the matching topic as answered", () => {
    const { list, found } = applyAnswer(base, { topicId: "b", stageId: STAGE_ID, answer: "yes" });
    expect(found).toBe(true);
    expect(list.find((r) => r.topicId === "b")?.answeredValue).toBe("yes");
    expect(list.find((r) => r.topicId === "a")?.answeredValue).toBeUndefined();
  });

  it("reports found=false when the topic does not exist", () => {
    const { found } = applyAnswer(base, { topicId: "missing", answer: "x" });
    expect(found).toBe(false);
  });
});
