import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Nav from "@/components/nav";
import Breadcrumb from "@/components/breadcrumb";
import { displayProjectName } from "@/lib/project-name";
import type { Project, Stage } from "@shared/schema";

const SHIMMER_STYLE: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(200,180,160,0.05) 0%, rgba(200,180,160,0.10) 40%, rgba(200,180,160,0.05) 80%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.8s ease-in-out infinite",
};

const SPINNER_STYLE: React.CSSProperties = {
  width: 11,
  height: 11,
  border: "1.5px solid rgba(240,182,94,0.25)",
  borderTopColor: "#f0b65e",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
  flexShrink: 0,
};

const DOC_TYPES = [
  { stageNumber: 1, title: "Requirements Definition", description: "Core users, problem space, and success metrics", icon: "📋" },
  { stageNumber: 2, title: "Product Requirements", description: "Feature scope, user stories, and acceptance criteria", icon: "📄" },
  { stageNumber: 3, title: "UI Wireframes", description: "Page layouts, navigation flow, and interaction patterns", icon: "🖼️" },
  { stageNumber: 4, title: "System Architecture", description: "Tech stack, data model, and service design", icon: "🗄️" },
  { stageNumber: 5, title: "Coding Prompts", description: "Implementation instructions for your AI coding assistant", icon: "💻" },
  { stageNumber: 6, title: "Development Guide", description: "Build phases, milestones, and deployment strategy", icon: "🚀" },
];

type DocState = "complete" | "generating" | "not-generated";

function docStateOf(stage: Stage | undefined): DocState {
  if (stage && stage.progress === 100) return "complete";
  if (stage && stage.progress > 0 && stage.progress < 100) return "generating";
  return "not-generated";
}

export default function DocumentsPage() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingStageId, setPendingStageId] = useState<string | "all" | null>(null);

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as Stage[] | undefined;
      const hasGenerating = data?.some((s) => s.progress > 0 && s.progress < 100);
      return hasGenerating ? 3000 : false;
    },
  });

  const docs = DOC_TYPES.map((docType) => ({
    ...docType,
    stage: stages.find((s) => s.stageNumber === docType.stageNumber),
  }));

  const completedDocs = docs.filter((d) => docStateOf(d.stage) === "complete");
  const generatingDocs = docs.filter((d) => docStateOf(d.stage) === "generating");
  const notGeneratedDocs = docs.filter((d) => docStateOf(d.stage) === "not-generated");
  const isGenerating = generatingDocs.length > 0;

  const totalDocs = docs.length;
  const completedCount = completedDocs.length;
  const currentlyGeneratingDoc = generatingDocs[0];
  const progressPct = totalDocs > 0 ? (completedCount / totalDocs) * 100 : 0;
  const firstIncompleteStage = docs.find((d) => docStateOf(d.stage) !== "complete")?.stage;

  const lastGenerated: Date | null = completedDocs
    .map((d) => d.stage?.updatedAt)
    .filter(Boolean)
    .map((t) => new Date(t as string | Date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const timeAgo = lastGenerated
    ? (() => {
        const diffMin = Math.floor((Date.now() - lastGenerated.getTime()) / 60000);
        if (diffMin < 1) return "just now";
        if (diffMin < 60) return `${diffMin} min ago`;
        return `${Math.floor(diffMin / 60)}h ago`;
      })()
    : null;

  // Reuses the existing assumed-content signal (same path document-view reads).
  const inputsAssumed = Boolean(
    (project?.productState as { workingMemory?: { tradeoff_weights_assumed?: boolean } } | null | undefined)
      ?.workingMemory?.tradeoff_weights_assumed,
  );

  // Generation is honest only when the project has captured intake — the
  // existing endpoint 400s otherwise. Gate optimistically; the server stays the
  // source of truth and any 400 message is surfaced via toast.
  const hasIntake = Boolean(
    project &&
      (project.surveyPhase === "complete" ||
        project.surveyResponses ||
        project.minimumDetails ||
        project.intakeMode === "adaptive"),
  );

  const generateMutation = useMutation({
    mutationFn: async (target: { stageId: string } | "all") => {
      const documentPreferences =
        target === "all"
          ? []
          : [{ stageId: target.stageId, detailLevel: "detailed" as const }];
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/generate-docs-from-survey`,
        { documentPreferences },
      );
      return res.json();
    },
    onSuccess: () => {
      // The 3s stages poll picks up progress once invalidated.
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
    },
    onError: (err: unknown) => {
      const description =
        err instanceof Error && err.message ? err.message : "Please try again.";
      toast({ title: "Generation failed", description, variant: "destructive" });
    },
    onSettled: () => setPendingStageId(null),
  });

  function triggerGenerate(target: { stageId: string } | "all", key: string | "all") {
    if (!hasIntake || generateMutation.isPending) return;
    setPendingStageId(key);
    generateMutation.mutate(target);
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#110f0d" }}>
        <div
          style={{
            width: 28,
            height: 28,
            border: "2px solid rgba(240,182,94,0.2)",
            borderTopColor: "#f0b65e",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const projectLabel = displayProjectName(project);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
        @keyframes glow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      <Nav />

      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: "44rem", margin: "0 auto", padding: "2.5rem 1.5rem 3rem" }}>
          {/* Breadcrumb — full navigable hierarchy */}
          <Breadcrumb
            segments={[
              { label: "Projects", href: "/projects" },
              { label: projectLabel },
            ]}
          />

          {/* Page header */}
          <header style={{ marginBottom: "1.75rem" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#f5f0eb", margin: 0 }}>
              Your Documents
            </h1>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b5d52", marginTop: 4 }}>
              {totalDocs} documents{timeAgo ? ` · Generated ${timeAgo}` : ""}
            </p>
            {/* Assumed-input signal — quiet text, no loud badge (signal hierarchy).
                Reuses the existing tradeoff_weights_assumed flag. */}
            {inputsAssumed && (
              <p
                data-testid="documents-inputs-assumed"
                title="Some inputs were inferred — refine your survey responses to improve accuracy."
                style={{ fontSize: 11, color: "#a89a8c", marginTop: 6 }}
              >
                Inputs partly assumed — some details were inferred.
              </p>
            )}
          </header>

          {/* Generation progress — only while generating */}
          {isGenerating && (
            <div
              role="status"
              aria-label={`Generating ${currentlyGeneratingDoc?.title ?? ""}, ${completedCount} of ${totalDocs}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: "1.5rem",
                padding: "10px 14px",
                background: "#1a1714",
                border: "1px solid rgba(200,180,160,0.08)",
                borderRadius: 7,
              }}
            >
              <span style={SPINNER_STYLE} aria-hidden="true" />
              <span style={{ fontSize: 12, color: "#a89a8c", flex: 1 }}>
                Generating {currentlyGeneratingDoc?.title ?? ""}…
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b5d52", flexShrink: 0 }}>
                {completedCount} of {totalDocs}
              </span>
              <div
                style={{ width: 80, height: 2, background: "rgba(200,180,160,0.08)", borderRadius: 9999, overflow: "hidden", flexShrink: 0 }}
                aria-hidden="true"
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "#f0b65e",
                    borderRadius: 9999,
                    animation: "glow-pulse 1.6s ease-in-out infinite",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* Document list */}
          <section aria-label="Generated documents">
            <div style={{ border: "1px solid rgba(200,180,160,0.08)", borderRadius: 8, overflow: "hidden", marginBottom: "1.5rem" }}>
              {docs.map((doc, idx) => {
                const state = docStateOf(doc.stage);
                const isComplete = state === "complete";
                const isRowGenerating = state === "generating";
                const rowPending = doc.stage ? pendingStageId === doc.stage.id : false;

                return (
                  <div
                    key={doc.stageNumber}
                    aria-busy={isComplete ? undefined : true}
                    data-testid={`doc-row-${doc.stageNumber}`}
                    data-doc-state={state}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 18px 14px 16px",
                      borderBottom: idx < docs.length - 1 ? "1px solid rgba(200,180,160,0.06)" : "none",
                      borderLeft: isComplete ? "2px solid #f0b65e" : "2px solid transparent",
                      // Not-generated rows are visibly de-emphasized vs ready ones.
                      opacity: state === "not-generated" ? 0.55 : 1,
                      transition: "background 0.12s, opacity 0.2s",
                      cursor: isComplete ? "pointer" : "default",
                    }}
                    onMouseEnter={(e) => {
                      if (isComplete) e.currentTarget.style.background = "rgba(200,180,160,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    onClick={() => {
                      if (isComplete && doc.stage) setLocation(`/document/${projectId}/${doc.stage.id}`);
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, width: 20, textAlign: "center" }}>
                      {doc.icon}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#f5f0eb",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {doc.title}
                      </div>

                      {/* State is named in TEXT, not shimmer-only. */}
                      {isComplete ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#a89a8c",
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {doc.description}
                        </div>
                      ) : isRowGenerating ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                          <span style={SPINNER_STYLE} aria-hidden="true" />
                          <span style={{ fontSize: 12, color: "#a89a8c" }}>Generating…</span>
                          <span
                            aria-hidden="true"
                            style={{ display: "inline-block", width: 120, height: 9, borderRadius: 4, ...SHIMMER_STYLE }}
                          />
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#6b5d52", marginTop: 2 }}>
                          {rowPending ? "Starting…" : "Not generated yet"}
                        </div>
                      )}
                    </div>

                    {/* Right control: View (complete) | Generate (not-generated) | nothing (generating) */}
                    {isComplete && doc.stage ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/document/${projectId}/${doc.stage!.id}`);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#f0b65e",
                          flexShrink: 0,
                          padding: 0,
                          fontFamily: "inherit",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        View
                      </button>
                    ) : isRowGenerating ? (
                      <span aria-disabled="true" style={{ fontSize: 12, fontWeight: 500, color: "#6b5d52", flexShrink: 0, pointerEvents: "none" }}>
                        View
                      </span>
                    ) : doc.stage ? (
                      <button
                        data-testid={`button-generate-${doc.stageNumber}`}
                        disabled={!hasIntake || generateMutation.isPending}
                        title={hasIntake ? "Generate this document" : "Complete the survey first"}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerGenerate({ stageId: doc.stage!.id }, doc.stage!.id);
                        }}
                        style={{
                          flexShrink: 0,
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          padding: "5px 12px",
                          borderRadius: 6,
                          // Distinct enabled/disabled visual states.
                          background: hasIntake && !generateMutation.isPending ? "#f0b65e" : "transparent",
                          color: hasIntake && !generateMutation.isPending ? "#110f0d" : "#6b5d52",
                          border: hasIntake && !generateMutation.isPending ? "none" : "1px solid rgba(200,180,160,0.12)",
                          cursor: hasIntake && !generateMutation.isPending ? "pointer" : "not-allowed",
                          transition: "background 0.15s",
                        }}
                      >
                        {rowPending ? "Starting…" : "Generate"}
                      </button>
                    ) : (
                      <span aria-disabled="true" style={{ fontSize: 12, fontWeight: 500, color: "#6b5d52", flexShrink: 0, pointerEvents: "none" }}>
                        View
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Generate-all CTA — primary action only while docs remain ungenerated. */}
          {notGeneratedDocs.length > 0 && !isGenerating && (
            <div style={{ marginBottom: "1.25rem" }}>
              <button
                data-testid="button-generate-all"
                disabled={!hasIntake || generateMutation.isPending}
                title={hasIntake ? "Generate all remaining documents" : "Complete the survey first"}
                onClick={() => triggerGenerate("all", "all")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  background: hasIntake && !generateMutation.isPending ? "#f0b65e" : "transparent",
                  color: hasIntake && !generateMutation.isPending ? "#110f0d" : "#6b5d52",
                  border: hasIntake && !generateMutation.isPending ? "none" : "1px solid rgba(200,180,160,0.12)",
                  cursor: hasIntake && !generateMutation.isPending ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                {pendingStageId === "all" ? "Starting…" : "Generate all documents"}
              </button>
              {!hasIntake && (
                <p style={{ fontSize: 11, color: "#6b5d52", marginTop: 6 }}>
                  Complete the survey to enable document generation.
                </p>
              )}
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "1.25rem", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={() => {
                if (firstIncompleteStage) setLocation(`/stage/${firstIncompleteStage.id}`);
                else setLocation(`/session/survey?projectId=${projectId}`);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                border: "1px solid rgba(240,182,94,0.30)",
                borderRadius: 6,
                background: "transparent",
                color: "#f0b65e",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(240,182,94,0.55)";
                e.currentTarget.style.background = "rgba(240,182,94,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(240,182,94,0.30)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              Refine with AI
            </button>

            <button
              onClick={() => setLocation(`/session/survey?projectId=${projectId}`)}
              data-testid="button-edit-survey-responses"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                border: "1px solid rgba(240,182,94,0.30)",
                borderRadius: 6,
                background: "transparent",
                color: "#f0b65e",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(240,182,94,0.55)";
                e.currentTarget.style.background = "rgba(240,182,94,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(240,182,94,0.30)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              Edit survey responses
            </button>

            {completedDocs.length > 0 && completedDocs[0].stage && (
              <button
                onClick={() => setLocation(`/document/${projectId}/${completedDocs[0].stage!.id}`)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: 6,
                  background: "#f0b65e",
                  color: "#110f0d",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#d4a04e";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f0b65e";
                }}
                data-testid="button-read-through"
              >
                Read through
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          {completedDocs.length >= 2 && (
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#3d3228",
                marginTop: "1rem",
                textAlign: "right",
              }}
              aria-hidden="true"
            >
              J / K to navigate between documents in the reader
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
