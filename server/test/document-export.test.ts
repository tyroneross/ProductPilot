/**
 * Document export + version control (item 4 fixpack).
 *
 * Pins the version-history substrate that the export/restore endpoints read:
 *   - getDeliverablesByStage returns kind='deliverable' rows, version-ordered.
 *   - A regenerate-style append (version = priorCount + 1) increments, never
 *     deletes prior rows.
 *   - Restore is non-destructive: it appends a copy of an older version as a
 *     new current version; history length grows, old rows survive.
 *   - Aggregate export concatenates each stage's LATEST deliverable in
 *     stageNumber order.
 *
 * Storage-layer test against MemStorage so it runs in the default suite with
 * no DB. The PostgresStorage impl mirrors the same query (asc version) and is
 * separately covered by the RLS suite for tenant isolation.
 */

import { describe, expect, it } from "vitest";
import { MemStorage } from "../storage-hybrid";

async function seedStage(s: MemStorage, projectId: string, stageNumber: number, title: string) {
  return s.createStage({
    projectId,
    stageNumber,
    title,
    description: `${title} desc`,
    systemPrompt: "sys",
  });
}

// Mirrors the route's regenerate version-bump rule.
async function appendDeliverable(s: MemStorage, stageId: string, content: string) {
  const prior = await s.getDeliverablesByStage(stageId);
  return s.createMessage({
    stageId,
    role: "assistant",
    content,
    kind: "deliverable",
    version: prior.length + 1,
  });
}

describe("document version control", () => {
  it("version increments on each regenerate and prior rows are retained", async () => {
    const s = new MemStorage();
    const stage = await seedStage(s, "p1", 1, "Requirements");

    await appendDeliverable(s, stage.id, "v1 content");
    await appendDeliverable(s, stage.id, "v2 content");
    await appendDeliverable(s, stage.id, "v3 content");

    const dels = await s.getDeliverablesByStage(stage.id);
    expect(dels.map((d) => d.version)).toEqual([1, 2, 3]);
    expect(dels.map((d) => d.content)).toEqual(["v1 content", "v2 content", "v3 content"]);
    // Latest is the current document.
    expect(dels[dels.length - 1].content).toBe("v3 content");
  });

  it("getDeliverablesByStage ignores conversational (chat) messages", async () => {
    const s = new MemStorage();
    const stage = await seedStage(s, "p1", 1, "Requirements");

    await s.createMessage({ stageId: stage.id, role: "user", content: "hi" });
    await s.createMessage({ stageId: stage.id, role: "assistant", content: "chat reply" });
    await appendDeliverable(s, stage.id, "the doc");

    const dels = await s.getDeliverablesByStage(stage.id);
    expect(dels).toHaveLength(1);
    expect(dels[0].content).toBe("the doc");
  });

  it("restore is non-destructive: appends a copy of an old version as new current", async () => {
    const s = new MemStorage();
    const stage = await seedStage(s, "p1", 1, "Requirements");

    await appendDeliverable(s, stage.id, "v1 content");
    await appendDeliverable(s, stage.id, "v2 content");

    // Restore v1 (route logic: copy source content as a new deliverable).
    const before = await s.getDeliverablesByStage(stage.id);
    const source = before.find((d) => d.version === 1)!;
    await s.createMessage({
      stageId: stage.id,
      role: "assistant",
      content: source.content,
      kind: "deliverable",
      version: before.length + 1,
    });

    const after = await s.getDeliverablesByStage(stage.id);
    expect(after.map((d) => d.version)).toEqual([1, 2, 3]);
    // Old versions survive.
    expect(after.find((d) => d.version === 1)!.content).toBe("v1 content");
    expect(after.find((d) => d.version === 2)!.content).toBe("v2 content");
    // New current == restored content.
    expect(after[after.length - 1].content).toBe("v1 content");
  });

  it("aggregate export uses each stage's latest deliverable in stageNumber order", async () => {
    const s = new MemStorage();
    const s2 = await seedStage(s, "p1", 2, "PRD");
    const s1 = await seedStage(s, "p1", 1, "Requirements");

    await appendDeliverable(s, s1.id, "req v1");
    await appendDeliverable(s, s1.id, "req v2"); // latest for stage 1
    await appendDeliverable(s, s2.id, "prd v1"); // latest for stage 2

    const stages = (await s.getStagesByProject("p1")).sort(
      (a, b) => a.stageNumber - b.stageNumber,
    );
    const parts: string[] = [];
    for (const st of stages) {
      const dels = await s.getDeliverablesByStage(st.id);
      if (dels.length === 0) continue;
      parts.push(`# ${st.title}\n\n${dels[dels.length - 1].content}`);
    }
    const aggregate = parts.join("\n\n---\n\n");

    expect(aggregate).toBe(
      "# Requirements\n\nreq v2\n\n---\n\n# PRD\n\nprd v1",
    );
  });
});
