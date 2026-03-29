import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, FileText, ListTodo, Layout, Code, BookOpen, Layers } from "lucide-react";
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
  {
    stageNumber: 1,
    title: "Requirements Definition",
    description: "Core users, problem space, and success metrics",
    icon: "📋",
  },
  {
    stageNumber: 2,
    title: "Product Requirements",
    description: "Feature scope, user stories, and acceptance criteria",
    icon: "📄",
  },
  {
    stageNumber: 3,
    title: "UI Wireframes",
    description: "Page layouts, navigation flow, and interaction patterns",
    icon: "🖼️",
  },
  {
    stageNumber: 4,
    title: "System Architecture",
    description: "Tech stack, data model, and service design",
    icon: "🗄️",
  },
  {
    stageNumber: 5,
    title: "Coding Prompts",
    description: "Implementation instructions for your AI coding assistant",
    icon: "💻",
  },
  {
    stageNumber: 6,
    title: "Development Guide",
    description: "Build phases, milestones, and deployment strategy",
    icon: "🚀",
  },
];

export default function DocumentsPage() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();

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

  const completedDocs = docs.filter((d) => d.stage && d.stage.progress === 100);
  const generatingDocs = docs.filter((d) => d.stage && d.stage.progress > 0 && d.stage.progress < 100);
  const isGenerating = generatingDocs.length > 0;

  // For generation progress bar
  const totalDocs = docs.length;
  const completedCount = completedDocs.length;
  const currentlyGeneratingDoc = generatingDocs[0];
  const progressPct = totalDocs > 0 ? (completedCount / totalDocs) * 100 : 0;

  // For "Refine with AI" — navigate to first incomplete stage
  const firstIncompleteStage = docs.find((d) => !d.stage || d.stage.progress < 100)?.stage;

  // Stat line: most recent updatedAt among completed stages
  const lastGenerated: Date | null = completedDocs
    .map((d) => d.stage?.updatedAt)
    .filter(Boolean)
    .map((t) => new Date(t as string | Date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const timeAgo = lastGenerated
    ? (() => {
        const diffMs = Date.now() - lastGenerated.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return "just now";
        if (diffMin < 60) return `${diffMin} min ago`;
        const diffHr = Math.floor(diffMin / 60);
        return `${diffHr}h ago`;
      })()
    : null;

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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
        @keyframes glow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: 56,
          display: "flex",
          alignItems: "center",
          background: "rgba(17,15,13,0.80)",
          backdropFilter: "blur(12px) saturate(1.2)",
          WebkitBackdropFilter: "blur(12px) saturate(1.2)",
          borderBottom: "1px solid rgba(200,180,160,0.08)",
        }}
        aria-label="Main navigation"
      >
        <div
          style={{
            maxWidth: "56rem",
            width: "100%",
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setLocation("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 18,
              color: "#f5f0eb",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              padding: 0,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: "#f0b65e",
                transform: "rotate(45deg)",
                borderRadius: 2,
                flexShrink: 0,
                display: "inline-block",
              }}
              aria-hidden="true"
            />
            ProductPilot
          </button>
          <ul
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {[
              { label: "Projects", href: "/projects" },
            ].map(({ label, href }) => (
              <li key={label}>
                <button
                  onClick={() => setLocation(href)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#a89a8c",
                    transition: "color 0.2s",
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f0b65e")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#a89a8c")}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1 }}>
        <div
          style={{
            maxWidth: "44rem",
            margin: "0 auto",
            padding: "2.5rem 1.5rem 3rem",
          }}
        >
          {/* Breadcrumb */}
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setLocation("/projects")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#a89a8c",
                fontSize: 13,
                padding: 0,
                fontFamily: "inherit",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0eb")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a89a8c")}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.6 }}>
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {project.name}
            </button>
          </div>

          {/* Page header */}
          <header style={{ marginBottom: "1.75rem" }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#f5f0eb",
                marginBottom: 4,
                margin: 0,
              }}
            >
              Your Documents
            </h1>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#6b5d52",
                marginTop: 4,
              }}
            >
              {totalDocs} documents{timeAgo ? ` · Generated ${timeAgo}` : ""}
            </p>
          </header>

          {/* Generation progress — only shown while generating */}
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
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#6b5d52",
                  flexShrink: 0,
                }}
              >
                {completedCount} of {totalDocs}
              </span>
              <div
                style={{
                  width: 80,
                  height: 2,
                  background: "rgba(200,180,160,0.08)",
                  borderRadius: 9999,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
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
            <div
              style={{
                border: "1px solid rgba(200,180,160,0.08)",
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: "1.5rem",
              }}
            >
              {docs.map((doc, idx) => {
                const isComplete = doc.stage && doc.stage.progress === 100;
                const isPending = !isComplete;

                return (
                  <div
                    key={doc.stageNumber}
                    aria-busy={isPending ? true : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 18px 14px 16px",
                      borderBottom: idx < docs.length - 1 ? "1px solid rgba(200,180,160,0.06)" : "none",
                      borderLeft: isComplete ? "2px solid #f0b65e" : "2px solid transparent",
                      transition: "background 0.12s",
                      cursor: isComplete ? "pointer" : "default",
                    }}
                    onMouseEnter={(e) => {
                      if (isComplete) e.currentTarget.style.background = "rgba(200,180,160,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    onClick={() => {
                      if (isComplete && doc.stage) {
                        setLocation(`/document/${projectId}/${doc.stage.id}`);
                      }
                    }}
                  >
                    {/* Icon */}
                    <span
                      aria-hidden="true"
                      style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, width: 20, textAlign: "center" }}
                    >
                      {doc.icon}
                    </span>

                    {/* Body */}
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
                      ) : (
                        <div
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            marginTop: 3,
                            width: 220,
                            height: 11,
                            borderRadius: 4,
                            ...SHIMMER_STYLE,
                          }}
                        />
                      )}
                    </div>

                    {/* View link */}
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
                          textDecoration: "none",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        View
                      </button>
                    ) : (
                      <span
                        aria-disabled="true"
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#6b5d52",
                          flexShrink: 0,
                          pointerEvents: "none",
                        }}
                      >
                        View
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bottom actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "1.25rem",
            }}
          >
            <button
              onClick={() => {
                if (firstIncompleteStage) {
                  setLocation(`/stage/${firstIncompleteStage.id}`);
                } else {
                  setLocation(`/session/survey?projectId=${projectId}`);
                }
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
              style={{
                background: "none",
                border: "none",
                color: "#6b5d52",
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
                padding: 0,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#a89a8c")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b5d52")}
              onClick={() => {
                // TODO: Implement export — no backend endpoint exists yet
                console.log("Export All clicked");
              }}
            >
              Export All
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
