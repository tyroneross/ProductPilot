import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryStep } from "@/components/preferences/CategoryStep";
import { RankingsStep } from "@/components/preferences/RankingsStep";
import { ReviewStep } from "@/components/preferences/ReviewStep";
import {
  CATEGORIES,
  categoriesWithMultiPicks,
  deriveFromPreset,
  buildEmptyProfile,
  type Category,
  type DesignProfile,
  type QuestionState,
} from "@shared/ui-preferences";
import { buildPromptPack } from "@shared/prompt-pack";

type Step =
  | { kind: "orient" }
  | { kind: "category"; index: number }
  | { kind: "rankings" }
  | { kind: "review" };

function loadInitialProfile(): DesignProfile {
  try {
    const saved = sessionStorage.getItem("designProfile");
    if (saved) {
      const parsed = JSON.parse(saved) as DesignProfile;
      // Ensure all current categories have a state slot (forward-compat).
      const empty = buildEmptyProfile(parsed.presetId || "custom");
      return { ...parsed, categories: { ...empty.categories, ...parsed.categories } };
    }
  } catch {
    /* noop */
  }

  try {
    const raw = sessionStorage.getItem("appStyle");
    if (raw) {
      const style = JSON.parse(raw) as { id?: string };
      if (style?.id) return deriveFromPreset(style.id);
    }
  } catch {
    /* noop */
  }

  return buildEmptyProfile("custom");
}

export default function PreferencesPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>({ kind: "orient" });
  const [profile, setProfile] = useState<DesignProfile>(() => loadInitialProfile());

  const rankingCategories = useMemo<{ category: Category; state: QuestionState }[]>(() => {
    const result: { category: Category; state: QuestionState }[] = [];
    for (const id of categoriesWithMultiPicks(profile)) {
      const cat = CATEGORIES.find((c) => c.id === id);
      if (cat) result.push({ category: cat, state: profile.categories[id] });
    }
    return result;
  }, [profile]);

  const updateCategory = (categoryId: string, next: QuestionState) => {
    setProfile((prev) => ({
      ...prev,
      source: "focused",
      categories: { ...prev.categories, [categoryId]: next },
      updatedAt: new Date().toISOString(),
    }));
  };

  const persist = (next: DesignProfile) => {
    sessionStorage.setItem("designProfile", JSON.stringify(next));
    sessionStorage.setItem("promptPack", buildPromptPack(next));
  };

  const goNext = () => {
    if (step.kind === "orient") {
      setStep({ kind: "category", index: 0 });
      return;
    }
    if (step.kind === "category") {
      if (step.index < CATEGORIES.length - 1) {
        setStep({ kind: "category", index: step.index + 1 });
      } else {
        if (rankingCategories.length > 0) setStep({ kind: "rankings" });
        else setStep({ kind: "review" });
      }
      return;
    }
    if (step.kind === "rankings") {
      setStep({ kind: "review" });
      return;
    }
    if (step.kind === "review") {
      const finalProfile: DesignProfile = { ...profile, updatedAt: new Date().toISOString() };
      persist(finalProfile);
      setLocation("/details");
    }
  };

  const goBack = () => {
    if (step.kind === "category") {
      if (step.index === 0) setStep({ kind: "orient" });
      else setStep({ kind: "category", index: step.index - 1 });
      return;
    }
    if (step.kind === "rankings") {
      setStep({ kind: "category", index: CATEGORIES.length - 1 });
      return;
    }
    if (step.kind === "review") {
      if (rankingCategories.length > 0) setStep({ kind: "rankings" });
      else setStep({ kind: "category", index: CATEGORIES.length - 1 });
      return;
    }
    // orient -> back to style picker
    setLocation("/style");
  };

  const jumpToCategory = (categoryId: string) => {
    const idx = CATEGORIES.findIndex((c) => c.id === categoryId);
    if (idx >= 0) setStep({ kind: "category", index: idx });
  };

  const skip = () => {
    // Preserve whatever preset-derived profile exists; don't commit focused edits.
    setLocation("/details");
  };

  const progressPct = (() => {
    const total = CATEGORIES.length + 2; // orient handled as step 0
    if (step.kind === "orient") return 0;
    if (step.kind === "category") return ((step.index + 1) / total) * 100;
    if (step.kind === "rankings") return ((CATEGORIES.length + 1) / total) * 100;
    return 100;
  })();

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8">
        <div className="mb-6">
          <p className="text-metadata text-contrast-medium uppercase tracking-widest mb-2">
            Preference Builder
          </p>
          <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {step.kind === "orient" && (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 space-y-6">
            <h1 className="text-h2 font-bold text-contrast-high tracking-tight">
              Fine-tune how your app should look and feel
            </h1>
            <p className="text-description text-contrast-medium leading-relaxed">
              You'll walk through {CATEGORIES.length} design categories — navigation, color,
              typography, motion, sheets, loading, and gestures. Pick one or more options per
              category, optionally say when each applies, then rank priorities if you picked
              more than one.
            </p>
            <p className="text-metadata text-contrast-medium">
              Takes about 5 minutes. We've seeded sensible defaults from your style choice;
              everything you set here will guide the AI's wireframes and documents downstream.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={goNext}
                className="btn-primary min-h-[52px] px-8 text-body"
                data-testid="pref-start"
              >
                Get started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <button
                onClick={skip}
                className="text-description text-contrast-medium hover:text-accent self-center"
                data-testid="pref-skip"
              >
                Skip — use preset defaults
              </button>
            </div>
          </div>
        )}

        {step.kind === "category" && (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 sm:p-8">
            <p className="text-metadata text-contrast-medium mb-4">
              Step {step.index + 1} of {CATEGORIES.length} · {CATEGORIES[step.index].group}
            </p>
            <CategoryStep
              category={CATEGORIES[step.index]}
              state={profile.categories[CATEGORIES[step.index].id]}
              onChange={(next) => updateCategory(CATEGORIES[step.index].id, next)}
            />
          </div>
        )}

        {step.kind === "rankings" && (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 sm:p-8">
            <RankingsStep
              categories={rankingCategories}
              onChange={updateCategory}
            />
          </div>
        )}

        {step.kind === "review" && (
          <div>
            <ReviewStep profile={profile} onJumpToCategory={jumpToCategory} />
          </div>
        )}

        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={goBack}
            className="text-contrast-medium"
            data-testid="pref-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={goNext}
            className="btn-primary min-h-[48px] px-8"
            data-testid="pref-next"
          >
            {step.kind === "review" ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Apply preferences
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
