import { Pencil } from "lucide-react";
import type { DesignProfile } from "@shared/ui-preferences";
import { CATEGORIES, getOption } from "@shared/ui-preferences";

interface ReviewStepProps {
  profile: DesignProfile;
  onJumpToCategory: (categoryId: string) => void;
}

export function ReviewStep({ profile, onJumpToCategory }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h3 font-medium text-contrast-high">Review your preferences</h2>
        <p className="text-description text-contrast-medium mt-1">
          Tap any category to jump back and edit.
        </p>
      </div>

      {CATEGORIES.map((category) => {
        const state = profile.categories[category.id];
        const count = state?.selectedIds.length ?? 0;
        const order = state?.ranked && state.rankOrder.length > 0
          ? state.rankOrder
          : state?.selectedIds ?? [];
        return (
          <div
            key={category.id}
            className="bg-surface-primary rounded-lg border border-gray-200 p-5"
            data-testid={`review-${category.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-title font-semibold text-contrast-high">{category.title}</h3>
                <p className="text-metadata text-contrast-medium">
                  {count === 0 ? "No selections" : `${count} selected${state?.ranked ? " · ranked" : ""}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToCategory(category.id)}
                className="text-metadata text-accent hover:underline flex items-center gap-1"
                data-testid={`review-edit-${category.id}`}
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>

            {count > 0 && (
              <ul className="space-y-2 mt-2">
                {order.map((optionId, idx) => {
                  const option = getOption(category.id, optionId);
                  if (!option) return null;
                  const contextText = state?.context[optionId]?.trim();
                  return (
                    <li key={optionId} className="flex gap-3 items-start">
                      {state?.ranked && (
                        <span className="text-metadata font-semibold text-contrast-high shrink-0 w-5">
                          {idx + 1}.
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-description font-medium text-contrast-high">{option.label}</div>
                        {contextText && (
                          <div className="text-metadata text-contrast-medium">When: {contextText}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {state?.notes?.trim() && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-metadata text-contrast-medium">
                  <span className="font-medium">Notes:</span> {state.notes.trim()}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
