import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
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

export default function DetailsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [productIdea, setProductIdea] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StyleId>("minimal");
  const [isGenerating, setIsGenerating] = useState(false);

  const canContinue = productIdea.trim().length > 0;
  const showExtras = productIdea.trim().length > 10;

  const handleContinueToSurvey = () => {
    const styleObj = STYLES.find((s) => s.id === selectedStyle)!;
    sessionStorage.setItem("productIdea", productIdea.trim());
    sessionStorage.setItem("appStyle", JSON.stringify(styleObj));
    setLocation("/session/survey");
  };

  const handleBuildDocsNow = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/projects", {
        name: productIdea.trim().substring(0, 50) + (productIdea.trim().length > 50 ? "..." : ""),
        description: productIdea.trim(),
        mode: "survey",
      });
      const project = await response.json();
      await apiRequest("POST", `/api/projects/${project.id}/generate-docs-from-minimum`, {
        minimumDetails: { problemStatement: productIdea.trim(), userGoals: [], v1Definition: "" },
      });
      setLocation(`/documents/${project.id}`);
    } catch {
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#110f0d", paddingBottom: "100px" }}>
      {/* Nav */}
      <div
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(17,15,13,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "rgba(200,180,160,0.08)",
        }}
      >
        <div className="flex items-center justify-between mx-auto" style={{ maxWidth: "1100px", padding: "18px 32px" }}>
          <a href="/" className="text-base font-bold tracking-tight no-underline" style={{ color: "#f5f0eb", letterSpacing: "-0.02em" }}>
            Product<span style={{ color: "#f0b65e" }}>Pilot</span>
          </a>
          <a href="/settings" className="text-sm font-medium no-underline" style={{ color: "#f0b65e" }}>Sign in</a>
        </div>
      </div>

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
