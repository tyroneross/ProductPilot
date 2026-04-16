// Pure, deterministic transformer from a DesignProfile into an "AI Prompt
// Pack" — markdown prose (second-person imperative) that gets injected into
// the Stage 3 wireframe system prompt and both doc-generation endpoints.

import {
  CATEGORIES,
  DesignProfile,
  QuestionState,
  getOption,
} from "./ui-preferences";

function selectedOptionsInOrder(state: QuestionState) {
  const order = state.ranked && state.rankOrder.length > 0
    ? state.rankOrder
    : state.selectedIds;
  return order.filter((id) => state.selectedIds.includes(id));
}

function renderCategorySection(categoryId: string, state: QuestionState): string | null {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;
  if (state.selectedIds.length === 0) return null;

  const ordered = selectedOptionsInOrder(state);
  const lines: string[] = [`### ${category.title}`];

  ordered.forEach((optionId, idx) => {
    const option = getOption(categoryId, optionId);
    if (!option) return;

    const rankLabel = state.ranked && ordered.length > 1 ? ` [priority ${idx + 1}]` : "";
    lines.push(`- **${option.label}**${rankLabel}`);
    option.specLines.forEach((spec) => lines.push(`  - ${spec}`));

    const context = state.context[optionId]?.trim();
    if (context) {
      lines.push(`  - _Apply when:_ ${context}`);
    } else if (option.whenToUse) {
      lines.push(`  - _Apply when:_ ${option.whenToUse}`);
    }
  });

  if (state.notes.trim()) {
    lines.push(`- _Notes:_ ${state.notes.trim()}`);
  }

  return lines.join("\n");
}

export function buildPromptPack(profile: DesignProfile): string {
  const header = [
    "# UI/UX PREFERENCES (AI PROMPT PACK)",
    "",
    `Platform: ${profile.platform}. Source: ${profile.source} (preset: ${profile.presetId}).`,
    "Treat these preferences as the authoritative design spec when generating wireframes, layouts, and UI copy. If a preference conflicts with another requirement, surface the conflict explicitly rather than silently overriding.",
    "",
  ].join("\n");

  const sections: string[] = [];
  for (const cat of CATEGORIES) {
    const state = profile.categories[cat.id];
    if (!state) continue;
    const section = renderCategorySection(cat.id, state);
    if (section) sections.push(section);
  }

  if (sections.length === 0) {
    return `${header}\n_No preferences captured — use sensible defaults for the selected preset._\n`;
  }

  return `${header}\n${sections.join("\n\n")}\n`;
}
