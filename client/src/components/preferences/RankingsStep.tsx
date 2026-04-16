import { Button } from "@/components/ui/button";
import type { Category, QuestionState } from "@shared/ui-preferences";
import { getOption } from "@shared/ui-preferences";

interface RankingsStepProps {
  categories: { category: Category; state: QuestionState }[];
  onChange: (categoryId: string, next: QuestionState) => void;
}

// Tap-to-rank: each selected option shows a rank badge. Tapping an unranked
// item assigns it the next available rank. Tapping a ranked item clears it
// (and shifts higher ranks down).
export function RankingsStep({ categories, onChange }: RankingsStepProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-description text-contrast-medium">
          No priorities to rank — none of your categories have more than one selection.
        </p>
      </div>
    );
  }

  const toggleRank = (categoryId: string, state: QuestionState, optionId: string) => {
    const currentIdx = state.rankOrder.indexOf(optionId);
    let nextOrder: string[];
    if (currentIdx >= 0) {
      nextOrder = state.rankOrder.filter((id) => id !== optionId);
    } else {
      nextOrder = [...state.rankOrder.filter((id) => state.selectedIds.includes(id)), optionId];
    }
    onChange(categoryId, {
      ...state,
      rankOrder: nextOrder,
      ranked: nextOrder.length === state.selectedIds.length,
    });
  };

  const clearRank = (categoryId: string, state: QuestionState) => {
    onChange(categoryId, { ...state, rankOrder: [], ranked: false });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-h3 font-medium text-contrast-high">Rank your priorities</h2>
        <p className="text-description text-contrast-medium mt-1">
          Tap each option in the order you want the AI to prioritize. Tap again to clear.
        </p>
      </div>

      {categories.map(({ category, state }) => {
        return (
          <div key={category.id} className="bg-surface-primary rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title font-semibold text-contrast-high">{category.title}</h3>
              {state.rankOrder.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearRank(category.id, state)}
                  data-testid={`rank-clear-${category.id}`}
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {state.selectedIds.map((optionId) => {
                const option = getOption(category.id, optionId);
                if (!option) return null;
                const rank = state.rankOrder.indexOf(optionId);
                const hasRank = rank >= 0;
                return (
                  <button
                    key={optionId}
                    type="button"
                    onClick={() => toggleRank(category.id, state, optionId)}
                    className="flex items-center gap-3 p-3 rounded-lg border transition-all text-left"
                    style={{
                      borderColor: hasRank ? "#111" : "#e5e7eb",
                      background: hasRank ? "#f9fafb" : "#fff",
                    }}
                    data-testid={`rank-option-${category.id}-${optionId}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
                      style={{
                        background: hasRank ? "#111" : "#f3f4f6",
                        color: hasRank ? "#fff" : "#9ca3af",
                      }}
                    >
                      {hasRank ? rank + 1 : "·"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-title font-medium text-contrast-high">{option.label}</div>
                      <div className="text-metadata text-contrast-medium truncate">{option.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
