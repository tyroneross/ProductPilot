import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Sparkles } from "lucide-react";
import Nav from "@/components/nav";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STYLES = [
  { id: "minimal", name: "Minimal", gradient: "linear-gradient(145deg, #f8f8f6 0%, #e8e6e2 100%)" },
  { id: "bold", name: "Bold", gradient: "linear-gradient(145deg, #1a0a2e 0%, #6d28d9 60%, #f59e0b 100%)" },
  { id: "playful", name: "Playful", gradient: "linear-gradient(145deg, #fef3c7 0%, #fbcfe8 50%, #bfdbfe 100%)" },
  { id: "corporate", name: "Corporate", gradient: "linear-gradient(145deg, #1e3a5f 0%, #2563eb 60%, #f1f5f9 100%)" },
  { id: "retro", name: "Retro", gradient: "linear-gradient(145deg, #fef08a 0%, #fb923c 50%, #84cc16 100%)" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

const EXAMPLE_IDEAS = [
  "Habit tracker for couples",
  "Invoice generator for freelancers",
  "Podcast note-taker with summaries",
  "Local farmers market finder",
  "Budget-aware meal planner",
  "Reading-list app with tags",
] as const;

const DRAFT_KEY = "productpilot.draft.idea";
const DRAFT_SAVED_AT_KEY = "productpilot.draft.savedAt";

function formatSavedAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3_000) return "just now";
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DetailsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [productIdea, setProductIdea] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StyleId>("minimal");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Auto-save state
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate existing draft on mount
  useEffect(() => {
    try {
      const existing = localStorage.getItem(DRAFT_KEY) ?? sessionStorage.getItem(DRAFT_KEY);
      const existingTs = Number(localStorage.getItem(DRAFT_SAVED_AT_KEY) ?? sessionStorage.getItem(DRAFT_SAVED_AT_KEY));
      if (existing && existing.trim().length > 0) {
        setProductIdea(existing);
        if (!Number.isNaN(existingTs) && existingTs > 0) setSavedAt(existingTs);
      }
    } catch {
      // ignore storage errors (private mode, quota)
    }
    hydratedRef.current = true;
  }, []);

  // Debounced persist on change
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const trimmed = productIdea.trim();
    saveTimerRef.current = setTimeout(() => {
      try {
        if (trimmed.length === 0) {
          localStorage.removeItem(DRAFT_KEY);
          sessionStorage.removeItem(DRAFT_KEY);
          localStorage.removeItem(DRAFT_SAVED_AT_KEY);
          sessionStorage.removeItem(DRAFT_SAVED_AT_KEY);
          setSavedAt(null);
          return;
        }
        const ts = Date.now();
        localStorage.setItem(DRAFT_KEY, productIdea);
        sessionStorage.setItem(DRAFT_KEY, productIdea);
        localStorage.setItem(DRAFT_SAVED_AT_KEY, String(ts));
        sessionStorage.setItem(DRAFT_SAVED_AT_KEY, String(ts));
        setSavedAt(ts);
      } catch {
        // ignore
      }
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [productIdea]);

  // Refresh "saved Ns ago" label every 10s while visible
  useEffect(() => {
    if (savedAt == null) return;
    const id = setInterval(() => forceTick((x) => x + 1), 10_000);
    return () => clearInterval(id);
  }, [savedAt]);

  const canContinue = productIdea.trim().length > 0;
  const showExtras = productIdea.trim().length > 10;
  const canEnhance = productIdea.trim().length >= 3 && !isEnhancing;

  const clearDraftStorage = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_SAVED_AT_KEY);
      sessionStorage.removeItem(DRAFT_SAVED_AT_KEY);
    } catch {}
  };

  const handleEnhance = async () => {
    const idea = productIdea.trim();
    if (idea.length < 3 || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await apiRequest("POST", "/api/enhance-idea", { idea });
      const data = (await res.json()) as { enhanced?: string };
      if (data?.enhanced && typeof data.enhanced === "string") {
        setProductIdea(data.enhanced);
      } else {
        toast({ title: "Enhance failed", description: "Try again in a moment.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Enhance failed", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleContinueToSurvey = () => {
    const styleObj = STYLES.find((s) => s.id === selectedStyle)!;
    const idea = productIdea.trim();
    sessionStorage.setItem("productIdea", idea);
    sessionStorage.setItem("appStyle", JSON.stringify(styleObj));
    // Seed the survey's expected context shape so discovery-stage prompts get the user's idea.
    // Without this, session-survey.tsx reads intakeAnswers/minimumDetails from sessionStorage
    // and finds nothing, falling through to a generic "Tell me more about your idea" prompt.
    sessionStorage.setItem(
      "intakeAnswers",
      JSON.stringify({ intent: "build", qualityPriority: "balanced" }),
    );
    sessionStorage.setItem(
      "minimumDetails",
      JSON.stringify({ problemStatement: idea, userGoals: [], v1Definition: "" }),
    );
    clearDraftStorage();
    setLocation("/session/survey");
  };

  const handleBuildDocsNow = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/projects", {
        name: productIdea.trim().substring(0, 50) + (productIdea.trim().length > 50 ? "..." : ""),
        description: productIdea.trim(),
        mode: "survey",
        demoMode: true,
      });
      const project = await response.json();
      await apiRequest("POST", `/api/projects/${project.id}/generate-docs-from-minimum`, {
        minimumDetails: { problemStatement: productIdea.trim(), userGoals: [], v1Definition: "" },
      });
      clearDraftStorage();
      setLocation(`/documents/${project.id}`);
    } catch {
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#110f0d", paddingBottom: "100px" }}>
      <Nav />

      {/* Content */}
      <div className="mx-auto px-6" style={{ maxWidth: "672px" }}>
        <div style={{ paddingTop: "48px", paddingBottom: "24px" }}>
          <h2 className="font-bold text-[#f5f0eb] mb-2" style={{ fontSize: "26px", letterSpacing: "-0.03em" }}>
            What are you building?
          </h2>
          <p className="text-base text-[#a89a8c]" style={{ lineHeight: "1.55" }}>
            Describe your idea. We'll generate docs tailored to your vision.
          </p>
        </div>

        {/* The one input */}
        <div style={{ position: "relative" }}>
          <textarea
            rows={5}
            value={productIdea}
            onChange={(e) => setProductIdea(e.target.value)}
            placeholder="e.g. A meal planning app that suggests recipes based on dietary preferences and budget..."
            className="w-full outline-none transition-colors caret-[#f0b65e]"
            style={{
              minHeight: "140px",
              background: "#1a1714",
              border: "1px solid rgba(200,180,160,0.08)",
              borderRadius: "10px",
              color: "#f5f0eb",
              fontFamily: "inherit",
              fontSize: "16px",
              lineHeight: "1.6",
              padding: "16px 18px",
              paddingBottom: "44px",
              resize: "vertical",
              width: "100%",
              display: "block",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#f0b65e";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,182,94,0.14)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(200,180,160,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {/* Enhance button — bottom-right inside the field */}
          <button
            type="button"
            onClick={handleEnhance}
            disabled={!canEnhance}
            aria-label={canEnhance ? "Enhance prompt" : "Write an idea first"}
            title={canEnhance ? "Expand this into a fuller description" : "Write an idea first"}
            data-testid="button-enhance-prompt"
            style={{
              position: "absolute",
              right: "10px",
              bottom: "10px",
              height: "30px",
              padding: "0 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 500,
              fontFamily: "inherit",
              background: "transparent",
              color: canEnhance ? "#f0b65e" : "#6b5d52",
              border: `1px solid ${canEnhance ? "rgba(240,182,94,0.3)" : "rgba(200,180,160,0.08)"}`,
              borderRadius: "6px",
              cursor: canEnhance ? "pointer" : "not-allowed",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (canEnhance) {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,182,94,0.08)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {isEnhancing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {isEnhancing ? "Enhancing..." : "Enhance"}
          </button>
        </div>

        {/* Saved indicator */}
        <div
          aria-live="polite"
          style={{
            minHeight: "18px",
            marginTop: "8px",
            fontSize: "11px",
            color: "#6b5d52",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.02em",
          }}
        >
          {savedAt != null && productIdea.trim().length > 0
            ? `Saved to this device · ${formatSavedAgo(savedAt)}`
            : "\u00A0"}
        </div>

        {/* Example idea chips */}
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
            WebkitOverflowScrolling: "touch",
          }}
          role="list"
          aria-label="Example ideas"
        >
          {EXAMPLE_IDEAS.map((example) => (
            <button
              key={example}
              type="button"
              role="listitem"
              onClick={() => setProductIdea(example)}
              data-testid={`chip-example-${example.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              style={{
                height: "38px",
                padding: "0 14px",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "inherit",
                color: "#a89a8c",
                background: "transparent",
                border: "1px solid rgba(200,180,160,0.12)",
                borderRadius: "999px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "background 0.15s, border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)";
                e.currentTarget.style.color = "#f5f0eb";
                e.currentTarget.style.background = "rgba(240,182,94,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
                e.currentTarget.style.color = "#a89a8c";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {example}
            </button>
          ))}
        </div>

        {/* Style picker — appears after typing */}
        {showExtras && (
          <div style={{ paddingTop: "32px" }}>
            <p className="text-[#6b5d52] text-xs mb-3">Pick a visual direction for your wireframes (optional)</p>
            <div className="flex gap-2.5" style={{ overflowX: "auto", paddingBottom: "4px" }}>
              {STYLES.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className="flex flex-col cursor-pointer transition-all duration-200 outline-none"
                    style={{
                      width: "100px",
                      height: "72px",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid #f0b65e" : "1.5px solid rgba(200,180,160,0.08)",
                      background: "#1a1714",
                      overflow: "hidden",
                      transform: isSelected ? "scale(1.02)" : "scale(1)",
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
                    <div className="flex-1" style={{ background: style.gradient, minHeight: 0 }} />
                    <div className="text-center font-medium" style={{
                      padding: "4px",
                      fontSize: "10px",
                      color: isSelected ? "#f0b65e" : "#6b5d52",
                      background: "#1a1714",
                    }}>
                      {style.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA — appears when there's content */}
      {canContinue && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 border-t"
          style={{
            background: "rgba(17,15,13,0.96)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderColor: "rgba(200,180,160,0.08)",
            padding: "14px 24px",
            paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex items-center gap-4" style={{ maxWidth: "672px" }}>
            <button
              onClick={handleContinueToSurvey}
              disabled={isGenerating}
              className="flex-1 inline-flex items-center justify-center font-bold transition-all"
              style={{
                height: "48px",
                background: "#f0b65e",
                color: "#1a0f00",
                fontSize: "15px",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              Continue →
            </button>
            <button
              onClick={handleBuildDocsNow}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 font-medium flex-shrink-0"
              style={{
                background: "none",
                border: "none",
                fontSize: "14px",
                color: "#a89a8c",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : "or Skip to Docs →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
