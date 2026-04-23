import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FolderKanban, Sparkles, ChevronRight, MoreHorizontal, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import Nav from "@/components/nav";
import type { Project } from "@shared/schema";

// Warm Craft tokens
const bg = "#110f0d", surface = "#1a1714", textPrimary = "#f5f0eb";
const textSecondary = "#a89a8c", textMuted = "#6b5d52";
const accent = "#f0b65e", accentHover = "#d4a04e";
const border = "rgba(200,180,160,0.08)";

const ctaStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: accent, color: "#110f0d", fontFamily: "inherit",
  fontSize: "14px", fontWeight: 600, border: "none", borderRadius: "8px",
  cursor: "pointer", transition: "background 0.15s",
};

function PhaseChip({ phase }: { phase: string | null | undefined }) {
  const label = phase === "survey" ? "Survey" : phase === "complete" ? "Complete" : "Discovery";
  const done = phase === "complete";
  return (
    <span style={{
      display: "inline-block", fontSize: "11px", fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase", borderRadius: "9999px",
      padding: "3px 10px", flexShrink: 0, whiteSpace: "nowrap",
      color: done ? accent : textMuted,
      border: `1px solid ${done ? "rgba(240,182,94,0.3)" : border}`,
      background: done ? "rgba(240,182,94,0.08)" : "transparent",
    }}>
      {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 0", borderTop: `1px solid ${border}` }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: surface, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "42%", height: 13, borderRadius: 4, background: surface, marginBottom: 6 }} />
        <div style={{ width: "26%", height: 11, borderRadius: 4, background: surface }} />
      </div>
      <div style={{ width: 64, height: 20, borderRadius: 999, background: surface }} />
    </div>
  );
}

const DRAFT_KEY = "productpilot.draft.idea";

function readDraft(): string | null {
  try {
    const v = localStorage.getItem(DRAFT_KEY) ?? sessionStorage.getItem(DRAFT_KEY);
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  } catch {}
  return null;
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem("productpilot.draft.savedAt");
    sessionStorage.removeItem("productpilot.draft.savedAt");
  } catch {}
}

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(readDraft());
  }, []);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const sorted = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  async function handleDelete(id: string) {
    setDeletingId(id);
    setOpenMenuId(null);
    try {
      await apiRequest("DELETE", `/api/projects/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Nav injected by nav component */}
      <Nav />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 36, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: textPrimary, margin: 0 }}>Your projects</h1>
            <p style={{ fontSize: 14, color: textSecondary, marginTop: 6, lineHeight: 1.5 }}>
              Resume where you left off or start a new product.
            </p>
          </div>
          {/* Desktop CTA */}
          <button
            onClick={() => setLocation("/details")}
            data-testid="button-new-product"
            style={{ ...ctaStyle, height: 40, padding: "0 18px" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent; }}
            className="hidden-mobile"
          >
            Start new product
          </button>
        </div>

        {/* Mobile CTA */}
        <button
          onClick={() => setLocation("/details")}
          className="show-mobile"
          style={{ ...ctaStyle, width: "100%", height: 48, fontSize: 15, borderRadius: 10, marginBottom: 28 }}
        >
          Start new product
        </button>

        <style>{`
          .hidden-mobile { display: inline-flex !important; }
          .show-mobile { display: none !important; }
          @media (max-width: 639px) {
            .hidden-mobile { display: none !important; }
            .show-mobile { display: flex !important; }
            .chip-desktop { display: none !important; }
            .chip-mobile { display: inline-block !important; }
          }
          @media (min-width: 640px) {
            .chip-desktop { display: inline-block !important; }
            .chip-mobile { display: none !important; }
          }
          .project-row:hover { background: rgba(200,180,160,0.04) !important; }
          .delete-btn:hover { background: rgba(229,115,115,0.08) !important; }
          .menu-btn:hover { color: ${textSecondary} !important; }
        `}</style>

        {/* Loading */}
        {isLoading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

        {/* Resume draft card (shown when a draft exists, regardless of project count) */}
        {draft && (
          <div
            data-testid="card-resume-draft"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              marginBottom: sorted.length === 0 ? 16 : 20,
              border: `1px solid rgba(240,182,94,0.35)`,
              borderRadius: 10,
              background: "rgba(240,182,94,0.04)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, color: accent, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Resume your draft
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: textPrimary,
                  margin: "4px 0 0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontStyle: "italic",
                }}
                title={draft}
              >
                &ldquo;{draft.length > 80 ? `${draft.slice(0, 80)}…` : draft}&rdquo;
              </p>
            </div>
            <button
              onClick={() => setLocation("/details")}
              data-testid="button-resume-draft"
              style={{ ...ctaStyle, height: 36, padding: "0 14px", fontSize: 13 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent; }}
            >
              Continue →
            </button>
            <button
              onClick={() => { clearDraft(); setDraft(null); }}
              data-testid="button-discard-draft"
              aria-label="Discard draft"
              style={{
                height: 36,
                padding: "0 12px",
                background: "transparent",
                color: textMuted,
                border: `1px solid ${border}`,
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#e57373";
                e.currentTarget.style.borderColor = "rgba(229,115,115,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = textMuted;
                e.currentTarget.style.borderColor = border;
              }}
            >
              Discard
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sorted.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            padding: "48px 24px", border: `1px solid ${border}`, borderRadius: 12, background: surface, gap: 12,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(240,182,94,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={20} color={accent} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: textPrimary, margin: "0 0 4px" }}>No projects yet</p>
            <p style={{ fontSize: 14, color: textSecondary, maxWidth: 340, lineHeight: 1.55, margin: "0 auto 8px" }}>
              Describe your idea and we'll generate a PRD, design requirements, architecture spec, and coding prompts.
            </p>
            <button
              onClick={() => setLocation("/details")}
              data-testid="button-start-first-product"
              style={{ ...ctaStyle, height: 44, padding: "0 24px" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent; }}
            >
              Start your first product
            </button>
          </div>
        )}

        {/* Project list */}
        {!isLoading && sorted.length > 0 && (
          <div>
            {sorted.map((project) => {
              const relTime = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true });
              const menuOpen = openMenuId === project.id;

              return (
                <div key={project.id} style={{ position: "relative", borderTop: `1px solid ${border}`, opacity: deletingId === project.id ? 0.4 : 1, transition: "opacity 0.2s" }}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="project-row"
                    data-testid={`row-project-${project.id}`}
                    onClick={() => { if (!menuOpen) setLocation(`/documents/${project.id}`); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(`/documents/${project.id}`); }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 4px", cursor: "pointer", minHeight: 60, userSelect: "none", borderRadius: 6, transition: "background 0.15s" }}
                  >
                    {/* Icon */}
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(240,182,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FolderKanban size={16} color={accent} />
                    </div>

                    {/* Name + sub */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {project.name}
                      </p>
                      <p style={{ fontSize: 12, color: textMuted, margin: "3px 0 0" }}>Last updated {relTime}</p>
                      {/* Mobile chip */}
                      <span className="chip-mobile" style={{ marginTop: 6 }}>
                        <PhaseChip phase={project.surveyPhase} />
                      </span>
                    </div>

                    {/* Desktop chip */}
                    <span className="chip-desktop"><PhaseChip phase={project.surveyPhase} /></span>

                    {/* Ellipsis */}
                    <button
                      aria-label="Project options"
                      className="menu-btn"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : project.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: textMuted, padding: 4, borderRadius: 4, display: "flex", alignItems: "center", minHeight: 32, minWidth: 32, justifyContent: "center", transition: "color 0.15s" }}
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    <ChevronRight size={14} color={textMuted} style={{ flexShrink: 0 }} />
                  </div>

                  {/* Dropdown */}
                  {menuOpen && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpenMenuId(null)} />
                      <div style={{ position: "absolute", right: 32, top: 12, zIndex: 10, background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 140 }}>
                        <button
                          className="delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                          disabled={deletingId === project.id}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#e57373", textAlign: "left", transition: "background 0.15s" }}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
