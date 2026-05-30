import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FolderKanban, Sparkles, ChevronRight, MoreHorizontal, Trash2, Pencil, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { displayProjectName } from "@/lib/project-name";
import Nav from "@/components/nav";
import type { Project } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Warm Craft tokens
const bg = "#110f0d", surface = "#1a1714", textPrimary = "#f5f0eb";
const textSecondary = "#a89a8c", textMuted = "#6b5d52";
const accent = "#f0b65e", accentHover = "#d4a04e";
const border = "rgba(200,180,160,0.08)";

const ctaStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: accent, color: "#110f0d", fontFamily: "inherit",
  fontSize: "14px", fontWeight: 600, border: "none", borderRadius: "8px",
  cursor: "pointer",
};
const ctaClass = "transition-colors duration-150";

// T2-1: route to the right resume point based on surveyPhase. A project
// stuck in "survey" lands back in /session/survey?projectId=... (the page
// already reads projectId from query and resumes). Discovery/complete go
// to /documents — doc-view renders a "Continue intake" CTA when the
// adaptive intake isn't done.
function destForProject(p: Project): string {
  if (p.surveyPhase === "survey") return `/session/survey?projectId=${p.id}`;
  return `/documents/${p.id}`;
}

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
  // T1-2: capture the project the user clicked Delete on, then surface a
  // confirm dialog. Without this guard one misclick destroys all generated
  // documents — Radix AlertDialog gives us focus trap + ESC + Cancel for free.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameSavingId, setRenameSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  // T2-7: client-side fuzzy filter on display name. The list is recency-only
  // by design; power users with 10+ projects can't scan all of them, so the
  // filter is a name-substring match (case-insensitive, trimmed). Empty
  // filter shows everything sorted.
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    setDraft(readDraft());
  }, []);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const sorted = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  // T2-7: derived filtered list. We render `visible` everywhere the page
  // used to render `sorted` (other than the sorted.length empty-state which
  // is preserved — the "no projects yet" affordance stays attached to
  // having zero projects, not zero matches).
  const trimmedQuery = query.trim().toLowerCase();
  const visible = trimmedQuery
    ? sorted.filter((p) => displayProjectName(p).toLowerCase().includes(trimmedQuery))
    : sorted;

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

  function startRename(project: Project) {
    setRenamingId(project.id);
    setRenameValue(displayProjectName(project));
    setOpenMenuId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function commitRename(id: string) {
    const next = renameValue.trim();
    if (next.length === 0) return;
    setRenameSavingId(id);
    try {
      await apiRequest("POST", `/api/projects/${id}/rename`, { name: next });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setRenamingId(null);
      setRenameValue("");
    } catch {
      // leave the input open so the user can retry; the API surfaces a toast
      // via the global queryClient error handler.
    } finally {
      setRenameSavingId(null);
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
          {/* Desktop CTA — hidden in empty state so the hero button is the single primary action */}
          {(isLoading || sorted.length > 0) && (
            <button
              onClick={() => setLocation("/details")}
              data-testid="button-new-product"
              className={`hidden-mobile ${ctaClass}`}
              style={{ ...ctaStyle, height: 40, padding: "0 18px" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent; }}
            >
              Start new product
            </button>
          )}
        </div>

        {/* Mobile CTA — same gating as desktop */}
        {(isLoading || sorted.length > 0) && (
          <button
            onClick={() => setLocation("/details")}
            className={`show-mobile ${ctaClass}`}
            style={{ ...ctaStyle, width: "100%", height: 48, fontSize: 15, borderRadius: 10, marginBottom: 28 }}
          >
            Start new product
          </button>
        )}

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
          .rename-btn:hover { background: rgba(200,180,160,0.06) !important; }
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
              className={ctaClass}
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
              className="transition-colors duration-150"
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
              className={ctaClass}
              style={{ ...ctaStyle, height: 44, padding: "0 24px" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent; }}
            >
              Start your first product
            </button>
          </div>
        )}

        {/* T2-7: project filter. Only show the input when the user actually
            has projects to filter through. Threshold of 3+ keeps the input
            from being noise on a near-empty list. */}
        {!isLoading && sorted.length >= 3 && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${sorted.length} project${sorted.length === 1 ? "" : "s"}…`}
              aria-label="Search projects by name"
              data-testid="input-projects-filter"
              className="focus-ring"
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#110f0d",
                border: `1px solid ${border}`,
                borderRadius: 8,
                color: textPrimary,
                fontFamily: "inherit",
                fontSize: 13,
              }}
            />
          </div>
        )}

        {/* T2-7: no-matches state — keeps the filter input visible so the
            user can clear/correct without losing context. */}
        {!isLoading && sorted.length > 0 && visible.length === 0 && (
          <div data-testid="projects-no-matches" style={{ padding: "24px 4px", color: textSecondary, fontSize: 13 }}>
            No projects match "{query.trim()}".
            <button
              type="button"
              onClick={() => setQuery("")}
              className="focus-ring"
              style={{
                marginLeft: 8,
                background: "transparent",
                border: "none",
                color: accent,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                textDecoration: "underline",
              }}
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Project list */}
        {!isLoading && visible.length > 0 && (
          <div>
            {visible.map((project) => {
              const relTime = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true });
              const menuOpen = openMenuId === project.id;

              return (
                <div key={project.id} className="transition-opacity duration-200" style={{ position: "relative", borderTop: `1px solid ${border}`, opacity: deletingId === project.id ? 0.4 : 1 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="project-row transition-colors duration-150"
                    data-testid={`row-project-${project.id}`}
                    onClick={() => { if (!menuOpen) setLocation(destForProject(project)); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(destForProject(project)); }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 4px", cursor: "pointer", minHeight: 60, userSelect: "none", borderRadius: 6 }}
                  >
                    {/* Icon */}
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(240,182,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FolderKanban size={16} color={accent} />
                    </div>

                    {/* Name + sub */}
                    {(() => {
                      const shownName = displayProjectName(project);
                      // Project rows whose stored name was overwritten by the
                      // server's title-derivation pass carry a marker in
                      // productState.workingMemory.titleDerivation. The
                      // client also falls back to comparing displayed vs raw
                      // for legacy rows where the helper still computes the
                      // displayed value.
                      const derivationMarker =
                        (project.productState as { workingMemory?: { titleDerivation?: unknown; titleRenamedByUser?: unknown } } | null | undefined)
                          ?.workingMemory?.titleDerivation;
                      const userRenamed = Boolean(
                        (project.productState as { workingMemory?: { titleRenamedByUser?: unknown } } | null | undefined)
                          ?.workingMemory?.titleRenamedByUser,
                      );
                      const wasDerived = !userRenamed && (!!derivationMarker || shownName !== project.name);
                      const isRenamingRow = renamingId === project.id;
                      const isSavingRow = renameSavingId === project.id;
                      return (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isRenamingRow ? (
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 6 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(project.id);
                              if (e.key === "Escape") cancelRename();
                            }}
                            maxLength={80}
                            data-testid={`input-rename-${project.id}`}
                            style={{
                              flex: 1,
                              fontFamily: "inherit",
                              fontSize: 14,
                              padding: "6px 10px",
                              minHeight: 32,
                              borderRadius: 6,
                              border: `1px solid ${border}`,
                              background: bg,
                              color: textPrimary,
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(project.id)}
                            disabled={renameValue.trim().length === 0 || isSavingRow}
                            data-testid={`button-rename-confirm-${project.id}`}
                            aria-label="Save name"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: 32,
                              minWidth: 32,
                              padding: "0 8px",
                              borderRadius: 6,
                              border: `1px solid ${renameValue.trim().length === 0 ? border : "rgba(240,182,94,0.4)"}`,
                              background: renameValue.trim().length === 0 ? "transparent" : accent,
                              color: renameValue.trim().length === 0 ? textMuted : "#110f0d",
                              fontFamily: "inherit",
                              fontSize: 12,
                              cursor: renameValue.trim().length === 0 ? "not-allowed" : "pointer",
                            }}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            data-testid={`button-rename-cancel-${project.id}`}
                            aria-label="Cancel rename"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: 32,
                              minWidth: 32,
                              padding: "0 8px",
                              borderRadius: 6,
                              border: `1px solid ${border}`,
                              background: "transparent",
                              color: textMuted,
                              cursor: "pointer",
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <p style={{ fontSize: 15, fontWeight: 500, color: textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {shownName}
                          {wasDerived && (
                            <span
                              data-testid={`tag-auto-title-${project.id}`}
                              title="Title generated from your brief. Use the menu to rename."
                              style={{
                                marginLeft: 8,
                                fontSize: 9,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: textMuted,
                                border: `1px solid ${border}`,
                                borderRadius: 4,
                                padding: "1px 5px",
                                verticalAlign: "middle",
                              }}
                            >
                              AI
                            </span>
                          )}
                        </p>
                      )}
                      <p style={{ fontSize: 12, color: textMuted, margin: "3px 0 0" }}>Last updated {relTime}</p>
                      {/* Mobile chip */}
                      <span className="chip-mobile" style={{ marginTop: 6 }}>
                        <PhaseChip phase={project.surveyPhase} />
                      </span>
                    </div>
                      );
                    })()}

                    {/* Desktop chip */}
                    <span className="chip-desktop"><PhaseChip phase={project.surveyPhase} /></span>

                    {/* Ellipsis */}
                    <button
                      aria-label="Project options"
                      className="menu-btn transition-colors duration-150"
                      data-testid={`button-project-options-${project.id}`}
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : project.id); }}
                      // 44x44 satisfies WCAG 2.5.8 AAA target-size on mobile and matches
                      // Apple HIG / Material guidance. The visible glyph stays 16x16 inside
                      // the larger click area (padding fills the rest), so dense list rows
                      // don't visually shift; the regression IBR mobile-viewport audit flagged
                      // a 32x32 bounding box.
                      style={{ background: "none", border: "none", cursor: "pointer", color: textMuted, padding: 4, borderRadius: 4, display: "flex", alignItems: "center", minHeight: 44, minWidth: 44, justifyContent: "center" }}
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
                          className="rename-btn transition-colors duration-150"
                          onClick={(e) => { e.stopPropagation(); startRename(project); }}
                          data-testid={`button-rename-${project.id}`}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: textPrimary, textAlign: "left" }}
                        >
                          <Pencil size={13} />
                          Rename
                        </button>
                        <button
                          className="delete-btn transition-colors duration-150"
                          onClick={(e) => {
                            e.stopPropagation();
                            // T1-2: open the confirmation dialog instead of
                            // deleting immediately. The dialog's Action calls
                            // handleDelete(); Cancel/ESC closes it as a no-op.
                            setPendingDeleteId(project.id);
                            setOpenMenuId(null);
                          }}
                          disabled={deletingId === project.id}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#e57373", textAlign: "left" }}
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

      {/* T1-2: Delete confirmation. Controlled via pendingDeleteId — open
          when truthy, closes by clearing. The Action triggers the existing
          handleDelete; Cancel/ESC/overlay-click are all no-ops. */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const p = projects.find((x) => x.id === pendingDeleteId);
                const name = p ? displayProjectName(p) : "this project";
                return `"${name}" and all of its generated documents will be permanently removed. This can't be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-project">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-project"
              style={{ background: "#e57373", color: "#110f0d" }}
              onClick={() => {
                const id = pendingDeleteId;
                setPendingDeleteId(null);
                if (id) void handleDelete(id);
              }}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
