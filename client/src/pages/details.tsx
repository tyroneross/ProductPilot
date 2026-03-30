import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Style definitions ────────────────────────────────────────────────────────

const STYLES = [
  {
    id: "minimal",
    name: "Minimal",
    gradient: "linear-gradient(145deg, #f8f8f6 0%, #e8e6e2 100%)",
  },
  {
    id: "bold",
    name: "Bold",
    gradient: "linear-gradient(145deg, #1a0a2e 0%, #6d28d9 60%, #f59e0b 100%)",
  },
  {
    id: "playful",
    name: "Playful",
    gradient: "linear-gradient(145deg, #fef3c7 0%, #fbcfe8 50%, #bfdbfe 100%)",
  },
  {
    id: "corporate",
    name: "Corporate",
    gradient: "linear-gradient(145deg, #1e3a5f 0%, #2563eb 60%, #f1f5f9 100%)",
  },
  {
    id: "retro",
    name: "Retro",
    gradient: "linear-gradient(145deg, #fef08a 0%, #fb923c 50%, #84cc16 100%)",
  },
  {
    id: "organic",
    name: "Organic",
    gradient: "linear-gradient(145deg, #d4edda 0%, #6aab76 50%, #3d7a46 100%)",
  },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

// ── Component ────────────────────────────────────────────────────────────────

export default function DetailsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form state
  const [productIdea, setProductIdea] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StyleId>("minimal");
  const [problemStatement, setProblemStatement] = useState("");
  const [primaryUsers, setPrimaryUsers] = useState("");
  const [v1Definition, setV1Definition] = useState("");

  // Optional fields
  const [showCoreDetails, setShowCoreDetails] = useState(false);
  const [mainFeatures, setMainFeatures] = useState("");
  const [techConstraints, setTechConstraints] = useState("");

  // Async state
  const [isGenerating, setIsGenerating] = useState(false);

  // CTA enabled when product idea has content — core details are optional
  const canContinue = productIdea.trim().length > 0;
  const hasIdea = productIdea.trim().length > 10; // Show style + details after typing

  const buildSessionPayload = () => {
    const styleObj = STYLES.find((s) => s.id === selectedStyle)!;
    const details = {
      problemStatement: problemStatement.trim(),
      userGoals: [primaryUsers.trim()],
      v1Definition: v1Definition.trim(),
      ...(mainFeatures.trim() && { mainFeatures: mainFeatures.trim() }),
      ...(techConstraints.trim() && { techConstraints: techConstraints.trim() }),
    };
    return { styleObj, details };
  };

  const handleContinueToSurvey = () => {
    const { styleObj, details } = buildSessionPayload();
    sessionStorage.setItem("productIdea", productIdea.trim());
    sessionStorage.setItem("appStyle", JSON.stringify(styleObj));
    sessionStorage.setItem("minimumDetails", JSON.stringify(details));
    setLocation("/session/survey");
  };

  const handleBuildDocsNow = async () => {
    setIsGenerating(true);
    const { styleObj, details } = buildSessionPayload();

    try {
      const projectPayload = {
        name:
          productIdea.trim().substring(0, 50) +
          (productIdea.trim().length > 50 ? "..." : ""),
        description: v1Definition.trim(),
        mode: "survey",
        appStyle: styleObj,
        minimumDetails: details,
      };

      const response = await apiRequest("POST", "/api/projects", projectPayload);
      const project = await response.json();

      await apiRequest(
        "POST",
        `/api/projects/${project.id}/generate-docs-from-minimum`,
        { minimumDetails: details }
      );

      toast({
        title: "Documents generated!",
        description: "Your product docs are ready to view.",
      });

      setLocation(`/documents/${project.id}`);
    } catch (error) {
      console.error("Failed to generate docs:", error);
      toast({
        title: "Generation failed",
        description: "Please try again or add more details.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Shared input class helpers ───────────────────────────────────────────

  const fieldInputCls =
    "w-full h-11 bg-[#1a1714] border border-[rgba(200,180,160,0.08)] rounded-md " +
    "text-sm text-[#f5f0eb] placeholder:text-[#6b5d52] px-3 outline-none " +
    "focus:border-[#f0b65e] focus:ring-1 focus:ring-[#f0b65e]/20 transition-colors caret-[#f0b65e]";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ background: "#110f0d", paddingBottom: "100px" }}
    >
      {/* ── Nav ── */}
      <div
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(17,15,13,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "rgba(200,180,160,0.08)",
        }}
      >
        <div
          className="flex items-center justify-between mx-auto px-8"
          style={{ maxWidth: "1100px", padding: "18px 32px" }}
        >
          <a
            href="/"
            className="text-base font-bold tracking-tight no-underline"
            style={{ color: "#f5f0eb", letterSpacing: "-0.02em" }}
          >
            Product<span style={{ color: "#f0b65e" }}>Pilot</span>
          </a>
          <div className="flex items-center gap-5">
            <span className="text-xs font-medium" style={{ color: "#6b5d52", letterSpacing: "0.04em" }}>
              Step <strong style={{ color: "#a89a8c" }}>1 of 3</strong>
            </span>
            <a
              href="/auth"
              className="text-sm font-medium no-underline transition-colors"
              style={{ color: "#f0b65e" }}
            >
              Sign in
            </a>
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="mx-auto px-6" style={{ maxWidth: "672px" }}>

        {/* Page header */}
        <div style={{ paddingTop: "48px", paddingBottom: "32px" }}>
          <h2
            className="font-bold text-[#f5f0eb] mb-2"
            style={{ fontSize: "26px", letterSpacing: "-0.03em", lineHeight: "1.25" }}
          >
            What are you building?
          </h2>
          <p className="text-base text-[#a89a8c]" style={{ lineHeight: "1.55" }}>
            Tell us about your product idea. We'll generate docs tailored to your vision.
          </p>
        </div>

        {/* Main textarea */}
        <div>
          <textarea
            rows={5}
            value={productIdea}
            onChange={(e) => setProductIdea(e.target.value)}
            placeholder="Describe your product idea..."
            aria-label="Product description"
            data-testid="input-product-idea"
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
              resize: "vertical",
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
          <p className="mt-2 text-xs text-[#6b5d52]">
            Be as detailed as you like — more context means better docs
          </p>
        </div>

        {/* Style selector — reveals after typing idea */}
        {hasIdea && (
          <div style={{ paddingTop: "36px" }}>
          <p
            className="text-[#a89a8c] font-semibold uppercase mb-3"
            style={{ fontSize: "11px", letterSpacing: "0.1em" }}
          >
            Visual Direction
          </p>

          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              margin: "0 -4px",
              padding: "4px 4px 8px",
            }}
          >
            <div
              role="radiogroup"
              aria-label="Visual style"
              className="flex gap-2.5"
              style={{ width: "max-content" }}
            >
              {STYLES.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedStyle(style.id)}
                    data-testid={`style-card-${style.id}`}
                    className="flex flex-col cursor-pointer transition-all duration-200 outline-none"
                    style={{
                      width: "116px",
                      height: "82px",
                      borderRadius: "8px",
                      border: isSelected
                        ? "2px solid #f0b65e"
                        : "1.5px solid rgba(200,180,160,0.08)",
                      background: "#1a1714",
                      overflow: "hidden",
                      transform: isSelected ? "scale(1.02)" : "scale(1)",
                      boxShadow: isSelected
                        ? "0 0 0 3px rgba(240,182,94,0.14)"
                        : "none",
                      flexShrink: 0,
                      padding: 0,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedStyle(style.id);
                      }
                    }}
                  >
                    {/* Swatch */}
                    <div
                      className="flex-1"
                      style={{ background: style.gradient, minHeight: 0 }}
                    />
                    {/* Label */}
                    <div
                      className="text-center font-medium"
                      style={{
                        padding: "5px 6px",
                        fontSize: "11px",
                        color: isSelected ? "#f0b65e" : "#a89a8c",
                        background: "#1a1714",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {style.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-2 text-xs text-[#6b5d52]">
            Style influences wireframe aesthetics and color suggestions
          </p>
          </div>
        )}

        {/* Core details — optional, collapsible */}
        {hasIdea && (
          <div style={{ paddingTop: "24px" }}>
            <button
              type="button"
              onClick={() => setShowCoreDetails((v) => !v)}
              aria-expanded={showCoreDetails}
              className="flex items-center gap-2 transition-colors"
              style={{
                background: "none",
                border: "none",
                padding: "6px 0",
                color: "#a89a8c",
                fontFamily: "inherit",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0eb")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a89a8c")}
            >
              <ChevronDown
                className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                style={{ transform: showCoreDetails ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              Add more context (optional)
            </button>
            {showCoreDetails && (
              <div className="flex flex-col gap-2.5 pt-3">
            <input
              type="text"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="What problem does this solve?"
              aria-label="Problem statement"
              data-testid="input-problem-statement"
              className={fieldInputCls}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#f0b65e";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,182,94,0.14)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <input
              type="text"
              value={primaryUsers}
              onChange={(e) => setPrimaryUsers(e.target.value)}
              placeholder="Who are the primary users?"
              aria-label="Primary users"
              data-testid="input-primary-users"
              className={fieldInputCls}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#f0b65e";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,182,94,0.14)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <input
              type="text"
              value={v1Definition}
              onChange={(e) => setV1Definition(e.target.value)}
              placeholder="What does v1 look like?"
              aria-label="Version 1 scope"
              data-testid="input-v1-definition"
              className={fieldInputCls}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#f0b65e";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,182,94,0.14)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <input
              type="text"
              value={mainFeatures}
              onChange={(e) => setMainFeatures(e.target.value)}
              placeholder="Key features (optional)"
              aria-label="Main features"
              data-testid="input-main-features"
              className={fieldInputCls}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#f0b65e";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,182,94,0.14)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <input
              type="text"
              value={techConstraints}
              onChange={(e) => setTechConstraints(e.target.value)}
              placeholder="Tech preferences (optional, e.g. React, iOS)"
              aria-label="Tech constraints"
              data-testid="input-tech-constraints"
              className={fieldInputCls}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#f0b65e";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,182,94,0.14)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
              </div>
            )}
          </div>
        )}

      </div>
      {/* /page-content */}

      {/* ── Sticky CTA bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          background: "rgba(17,15,13,0.96)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderColor: "rgba(200,180,160,0.08)",
          padding: "14px 24px",
        }}
      >
        <div
          className="mx-auto flex items-center flex-wrap gap-4"
          style={{ maxWidth: "672px" }}
        >
          {/* Primary CTA */}
          <button
            type="button"
            onClick={handleContinueToSurvey}
            disabled={!canContinue || isGenerating}
            data-testid="button-continue-survey"
            className="flex-1 inline-flex items-center justify-center gap-1.5 font-bold transition-all duration-150"
            style={{
              height: "48px",
              padding: "0 28px",
              background: "#f0b65e",
              color: "#1a0f00",
              fontFamily: "inherit",
              fontSize: "15px",
              border: "none",
              borderRadius: "10px",
              cursor: canContinue && !isGenerating ? "pointer" : "not-allowed",
              opacity: canContinue && !isGenerating ? 1 : 0.38,
              letterSpacing: "-0.01em",
            }}
          >
            Continue to Survey &rarr;
          </button>

          <span className="text-[#6b5d52] text-sm flex-shrink-0">or</span>

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={handleBuildDocsNow}
            disabled={!canContinue || isGenerating}
            data-testid="button-build-docs-now"
            className="inline-flex items-center gap-1.5 font-medium transition-colors flex-shrink-0"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "inherit",
              fontSize: "14px",
              color: "#a89a8c",
              cursor: canContinue && !isGenerating ? "pointer" : "not-allowed",
              opacity: canContinue && !isGenerating ? 1 : 0.4,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (canContinue && !isGenerating) e.currentTarget.style.color = "#f5f0eb";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#a89a8c")}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              "or Build Docs Now →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
