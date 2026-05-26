// Defect #1 — inline-answer mechanism for Open Questions / Missing Information.
//
// Extracts structured open-questions from generated doc content. Two sources:
//   (A) Preferred: an HTML-comment trailer the doc-generation prompts emit,
//       e.g.:
//         <!-- open-questions: [{"topicId":"...","prompt":"...","answerKind":"choice","answerChips":[...]}] -->
//       Parsing is strict; an invalid JSON trailer is ignored (legacy docs).
//   (B) Fallback: markdown-section heuristic. When the doc has a heading
//       matching /^#+\s*(open questions|missing information.*)$/i, we walk
//       its list items and emit one OpenQuestion per item with text-input
//       answer kind. No `feedsField` is inferred.
//
// The extractor is pure (no DB). The merge helper applies the parsed list
// onto the project's working-memory openQuestions[], preserving any user
// answers already captured for the same topicId.

import { OpenQuestionSchema, type OpenQuestion } from "@shared/schema";

const TRAILER_RE = /<!--\s*open-questions\s*:\s*(\[[\s\S]*?\])\s*-->/i;
const HEADING_RE = /^#{1,6}\s*(open questions|missing information(\s+needed)?)\s*$/i;
const LIST_ITEM_RE = /^\s*[-*]\s+(.+?)\s*$/;

export interface ExtractInput {
  stageId: string;
  stageNumber?: number;
  content: string;
}

export function extractOpenQuestions(input: ExtractInput): OpenQuestion[] {
  if (!input.content) return [];

  // (A) Structured trailer
  const trailerMatch = input.content.match(TRAILER_RE);
  if (trailerMatch) {
    try {
      const raw = JSON.parse(trailerMatch[1]);
      if (Array.isArray(raw)) {
        const parsed: OpenQuestion[] = [];
        for (const row of raw) {
          const result = OpenQuestionSchema.safeParse({
            ...row,
            stageId: input.stageId,
            stageNumber: input.stageNumber ?? row?.stageNumber,
          });
          if (result.success) parsed.push(result.data);
        }
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // fall through to (B)
    }
  }

  // (B) Markdown-heading heuristic
  const lines = input.content.split(/\r?\n/);
  const collected: OpenQuestion[] = [];
  let inSection = false;
  let topicCounter = 0;
  for (const line of lines) {
    if (HEADING_RE.test(line.trim())) {
      inSection = true;
      continue;
    }
    if (inSection) {
      // Stop on the next heading of equal or higher rank.
      if (/^#{1,6}\s+/.test(line)) {
        inSection = false;
        continue;
      }
      const match = line.match(LIST_ITEM_RE);
      if (match) {
        const prompt = match[1].trim();
        if (prompt.length >= 6 && prompt.length <= 500) {
          collected.push({
            topicId: `oq-${input.stageId}-${topicCounter++}`,
            prompt,
            stageId: input.stageId,
            stageNumber: input.stageNumber,
            answerKind: "text",
          });
        }
      }
    }
  }
  return collected;
}

// Merge a freshly extracted list onto the persisted working-memory list,
// preserving prior answers when the same topicId is still present.
export function mergeOpenQuestions(
  existing: OpenQuestion[] | undefined,
  incoming: OpenQuestion[],
): OpenQuestion[] {
  const byKey = new Map<string, OpenQuestion>();
  for (const row of existing ?? []) {
    byKey.set(`${row.stageId ?? ""}::${row.topicId}`, row);
  }
  const merged: OpenQuestion[] = [];
  for (const row of incoming) {
    const key = `${row.stageId ?? ""}::${row.topicId}`;
    const prior = byKey.get(key);
    if (prior?.answeredValue) {
      merged.push({
        ...row,
        answeredValue: prior.answeredValue,
        answeredAt: prior.answeredAt,
      });
    } else {
      merged.push(row);
    }
    byKey.delete(key);
  }
  // Preserve open-questions from OTHER stages we didn't extract this pass.
  byKey.forEach((remaining) => {
    merged.push(remaining);
  });
  return merged;
}

// Apply a user answer. Returns the updated list and whether the topic was
// found (so the route can 404 cleanly).
export function applyAnswer(
  list: OpenQuestion[],
  args: { stageId?: string; topicId: string; answer: string },
): { list: OpenQuestion[]; found: boolean } {
  let found = false;
  const updated = list.map((row) => {
    const stageMatches = !args.stageId || row.stageId === args.stageId;
    if (stageMatches && row.topicId === args.topicId) {
      found = true;
      return {
        ...row,
        answeredValue: args.answer,
        answeredAt: new Date().toISOString(),
      };
    }
    return row;
  });
  return { list: updated, found };
}
