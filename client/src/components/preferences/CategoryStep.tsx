import { Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { Category, QuestionState } from "@shared/ui-preferences";
import { MiniPreview } from "./MiniPreviews";

interface CategoryStepProps {
  category: Category;
  state: QuestionState;
  onChange: (next: QuestionState) => void;
}

export function CategoryStep({ category, state, onChange }: CategoryStepProps) {
  const toggleOption = (optionId: string) => {
    const alreadySelected = state.selectedIds.includes(optionId);
    const nextIds = alreadySelected
      ? state.selectedIds.filter((id) => id !== optionId)
      : [...state.selectedIds, optionId];

    const nextContext = { ...state.context };
    if (alreadySelected) {
      delete nextContext[optionId];
    }

    const nextRankOrder = state.rankOrder.filter((id) => nextIds.includes(id));
    onChange({
      ...state,
      selectedIds: nextIds,
      context: nextContext,
      rankOrder: nextRankOrder,
      ranked: state.ranked && nextRankOrder.length === nextIds.length && nextIds.length >= 2,
    });
  };

  const updateContext = (optionId: string, value: string) => {
    onChange({ ...state, context: { ...state.context, [optionId]: value } });
  };

  const updateNotes = (notes: string) => onChange({ ...state, notes });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h3 font-medium text-contrast-high">{category.title}</h2>
        <p className="text-description text-contrast-medium mt-1">{category.subtitle}</p>
        {category.allowMulti && (
          <p className="text-metadata text-contrast-medium mt-2">
            Select all that apply — you can rank priorities in a later step.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {category.options.map((option) => {
          const isSelected = state.selectedIds.includes(option.id);
          return (
            <div key={option.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleOption(option.id)}
                className="text-left rounded-xl overflow-hidden transition-all duration-150 bg-surface-primary"
                style={{
                  border: isSelected ? "2px solid #111" : "2px solid transparent",
                  boxShadow: isSelected
                    ? "0 4px 16px rgba(0,0,0,0.12)"
                    : "0 1px 4px rgba(0,0,0,0.06)",
                }}
                data-testid={`pref-option-${category.id}-${option.id}`}
              >
                <div className="h-[120px] bg-gray-50 border-b border-gray-100">
                  <MiniPreview id={option.previewId} />
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </div>
                    )}
                    <span className="text-title font-semibold text-contrast-high truncate">{option.label}</span>
                  </div>
                  <p className="text-metadata text-contrast-medium leading-snug line-clamp-2">{option.desc}</p>
                </div>
              </button>

              {isSelected && (
                <Textarea
                  value={state.context[option.id] ?? ""}
                  onChange={(e) => updateContext(option.id, e.target.value)}
                  placeholder={`When does this apply? (default: ${option.whenToUse})`}
                  className="text-metadata min-h-[56px]"
                  data-testid={`pref-context-${category.id}-${option.id}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="text-description text-contrast-medium mb-2 block">
          Additional notes for this category (optional)
        </label>
        <Textarea
          value={state.notes}
          onChange={(e) => updateNotes(e.target.value)}
          placeholder="Anything specific you want the AI to honor here?"
          className="min-h-[56px]"
          data-testid={`pref-notes-${category.id}`}
        />
      </div>
    </div>
  );
}
