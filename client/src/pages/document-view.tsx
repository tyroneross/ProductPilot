import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Nav from "@/components/nav";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, FileText, Code, Layout, ListTodo, Palette, Copy, Check, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Stage, Message } from "@shared/schema";

const DOC_TYPES = [
  {
    stageNumber: 1,
    shortLabel: "Requirements",
    title: "Requirements Definition",
    icon: FileText,
  },
  {
    stageNumber: 2,
    shortLabel: "PRD",
    title: "Product Requirements",
    icon: ListTodo,
  },
  {
    stageNumber: 3,
    shortLabel: "Wireframes",
    title: "UI Wireframes",
    icon: Palette,
  },
  {
    stageNumber: 4,
    shortLabel: "Architecture",
    title: "System Architecture",
    icon: Layout,
  },
  {
    stageNumber: 5,
    shortLabel: "Coding Prompts",
    title: "Coding Prompts",
    icon: Code,
  },
  {
    stageNumber: 6,
    shortLabel: "Dev Guide",
    title: "Development Guide",
    icon: ListTodo,
  },
];

export default function DocumentViewPage() {
  const { projectId, stageId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"detailed" | "summary">("detailed");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const tablistRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

  const stage = stages.find((s) => s.id === stageId);

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/stages", stageId, "messages"],
    enabled: !!stageId,
  });

  const documentContent = [...messages].reverse().find((m) => m.role === "assistant")?.content || "";

  // Build ordered list of docs with their stage data
  const orderedDocs = DOC_TYPES.map((dt) => ({
    ...dt,
    stage: stages.find((s) => s.stageNumber === dt.stageNumber) ?? null,
  }));

  const currentIndex = stage ? orderedDocs.findIndex((d) => d.stageNumber === stage.stageNumber) : -1;

  const prevDoc = currentIndex > 0 ? orderedDocs[currentIndex - 1] : null;
  const nextDoc = currentIndex >= 0 && currentIndex < orderedDocs.length - 1 ? orderedDocs[currentIndex + 1] : null;

  const navigateToDoc = useCallback(
    (doc: typeof orderedDocs[number]) => {
      if (doc.stage && doc.stage.progress === 100) {
        setLocation(`/document/${projectId}/${doc.stage.id}`);
      }
    },
    [projectId, setLocation]
  );

  // Scroll active tab into view on mount / stage change — important on mobile viewports
  // where the 6-tab row overflows and the current doc might be off-screen otherwise.
  useEffect(() => {
    if (activeTabRef.current && tablistRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [stageId]);

  // J/K keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (e.key === "j" && nextDoc) {
        navigateToDoc(nextDoc);
      } else if (e.key === "k" && prevDoc) {
        navigateToDoc(prevDoc);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextDoc, prevDoc, navigateToDoc]);

  const getStageIcon = (stageNumber: number) => {
    const dt = DOC_TYPES.find((d) => d.stageNumber === stageNumber);
    return dt ? dt.icon : FileText;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(documentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Document content has been copied.",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try selecting and copying manually.",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    if (!projectId) return;
    setIsExporting(true);
    try {
      const res = await apiRequest("GET", `/api/projects/${projectId}/export`);
      const data = await res.json();
      const lines: string[] = [];
      lines.push(`# ${data.project?.name ?? "ProductPilot Export"}\n`);
      lines.push(`Exported: ${data.exportedAt ?? new Date().toISOString()}\n`);
      for (const s of data.stages ?? []) {
        lines.push(`\n## ${s.title ?? s.stageNumber}\n`);
        const lastAssistant = [...(s.messages ?? [])].reverse().find((m: { role: string }) => m.role === "assistant");
        if (lastAssistant) {
          lines.push(lastAssistant.content);
        }
      }
      const markdown = lines.join("\n");
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name ?? "productpilot"}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded", description: `${project?.name ?? "Project"}.md saved.` });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!stage || !project) return;

    setIsRegenerating(true);
    setShowRegenerateDialog(false);

    try {
      await apiRequest("POST", `/api/projects/${projectId}/generate-docs-from-survey`, {
        documentPreferences: [{ stageId: stage.id, detailLevel }],
      });

      await refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });

      toast({
        title: "Document regenerated",
        description: `${stage.title} has been regenerated with ${detailLevel} level.`,
      });
    } catch {
      toast({
        title: "Regeneration failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!project || !stage) {
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

  const Icon = getStageIcon(stage.stageNumber);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Nav />

      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#1a1714",
          borderBottom: "1px solid rgba(200,180,160,0.08)",
        }}
      >
        {/* Top bar: back + title + actions */}
        <div
          style={{
            maxWidth: "52rem",
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Back to docs list */}
          <button
            onClick={() => setLocation(`/documents/${projectId}`)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid rgba(200,180,160,0.12)",
              background: "transparent",
              color: "#a89a8c",
              cursor: "pointer",
              flexShrink: 0,
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f5f0eb";
              e.currentTarget.style.borderColor = "rgba(200,180,160,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#a89a8c";
              e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
            }}
            aria-label="Back to documents"
            data-testid="button-back-documents"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
          </button>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#f5f0eb",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {stage.title}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#6b5d52",
                marginTop: 1,
              }}
            >
              {project.name}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <ActionButton
              onClick={handleCopy}
              data-testid="button-copy-document"
              aria-label={copied ? "Copied" : "Copy document"}
            >
              {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </ActionButton>
            <ActionButton
              onClick={handleExport}
              disabled={isExporting}
              data-testid="button-export-all"
              aria-label="Export all documents"
            >
              <Download style={{ width: 13, height: 13 }} />
              <span>{isExporting ? "Exporting…" : "Export All"}</span>
            </ActionButton>
            <ActionButton
              onClick={() => setShowRegenerateDialog(true)}
              disabled={isRegenerating}
              data-testid="button-regenerate-document"
              aria-label="Regenerate document"
            >
              <RefreshCw style={{ width: 13, height: 13, animation: isRegenerating ? "spin 0.8s linear infinite" : "none" }} />
              <span>{isRegenerating ? "Regenerating…" : "Regenerate"}</span>
            </ActionButton>
          </div>
        </div>

        {/* Artifact stepper — horizontal scroll on narrow screens */}
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Documents"
          style={{
            maxWidth: "52rem",
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            gap: 0,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {orderedDocs.map((doc, idx) => {
            const isActive = doc.stageNumber === stage.stageNumber;
            const isReady = doc.stage && doc.stage.progress === 100;
            const DocIcon = doc.icon;
            const firstIncomplete = orderedDocs.find((d) => !(d.stage && d.stage.progress === 100));
            const tipForIncomplete =
              !isReady && firstIncomplete
                ? `Complete ${firstIncomplete.shortLabel} first`
                : undefined;

            return (
              <button
                key={doc.stageNumber}
                ref={isActive ? activeTabRef : null}
                role="tab"
                aria-selected={isActive}
                aria-disabled={!isReady}
                title={!isReady ? tipForIncomplete : undefined}
                onClick={() => navigateToDoc(doc)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "9px 12px",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid #f0b65e"
                    : "2px solid transparent",
                  background: "transparent",
                  color: isActive
                    ? "#f5f0eb"
                    : isReady
                    ? "#a89a8c"
                    : "#3d3228",
                  cursor: isReady ? "pointer" : "default",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: "nowrap",
                  transition: "color 0.15s",
                  flexShrink: 0,
                  marginBottom: -1,
                }}
                onMouseEnter={(e) => {
                  if (isReady && !isActive) e.currentTarget.style.color = "#f5f0eb";
                }}
                onMouseLeave={(e) => {
                  if (isReady && !isActive) e.currentTarget.style.color = "#a89a8c";
                }}
                data-testid={`tab-doc-${doc.stageNumber}`}
              >
                <DocIcon style={{ width: 12, height: 12, flexShrink: 0 }} aria-hidden="true" />
                {doc.shortLabel}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          maxWidth: "52rem",
          margin: "0 auto",
          width: "100%",
          padding: "32px 24px 80px",
        }}
      >
        {isRegenerating ? (
          <div
            style={{
              background: "#1a1714",
              borderRadius: 8,
              border: "1px solid rgba(200,180,160,0.08)",
              padding: "80px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "2px solid rgba(240,182,94,0.2)",
                borderTopColor: "#f0b65e",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontSize: 13, color: "#a89a8c" }}>
              Regenerating with {detailLevel} level…
            </p>
          </div>
        ) : documentContent ? (
          <div
            style={{
              background: "#1a1714",
              borderRadius: 8,
              border: "1px solid rgba(200,180,160,0.08)",
              padding: "32px 36px",
            }}
          >
            <div
              className="prose prose-sm max-w-none prose-invert prose-a:text-[#f0b65e] prose-headings:text-[#f5f0eb] prose-code:text-[#f0b65e] prose-p:text-[#c8b4a0] prose-li:text-[#c8b4a0]"
              style={{ fontSize: 14, lineHeight: 1.7 }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentContent}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "#1a1714",
              borderRadius: 8,
              border: "1px solid rgba(200,180,160,0.08)",
              padding: "80px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 13, color: "#a89a8c", marginBottom: 16 }}>
              No content has been generated for this document yet.
            </p>
            <button
              onClick={() => setShowRegenerateDialog(true)}
              style={{
                padding: "8px 16px",
                background: "#f0b65e",
                color: "#110f0d",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                minHeight: 36,
              }}
              data-testid="button-generate-document"
            >
              Generate Document
            </button>
          </div>
        )}
      </main>

      {/* J/K keyboard nav footer — quiet hint */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 14px",
          background: "rgba(17,15,13,0.85)",
          border: "1px solid rgba(200,180,160,0.10)",
          borderRadius: 20,
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}
      >
        {prevDoc && prevDoc.stage?.progress === 100 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6b5d52" }}>
            <kbd
              style={{
                display: "inline-block",
                padding: "1px 5px",
                border: "1px solid rgba(200,180,160,0.15)",
                borderRadius: 3,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#a89a8c",
                lineHeight: 1.6,
              }}
            >
              K
            </kbd>
            {prevDoc.shortLabel}
          </span>
        )}
        {prevDoc && nextDoc && prevDoc.stage?.progress === 100 && nextDoc.stage?.progress === 100 && (
          <span style={{ color: "rgba(200,180,160,0.15)", fontSize: 10 }}>·</span>
        )}
        {nextDoc && nextDoc.stage?.progress === 100 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6b5d52" }}>
            {nextDoc.shortLabel}
            <kbd
              style={{
                display: "inline-block",
                padding: "1px 5px",
                border: "1px solid rgba(200,180,160,0.15)",
                borderRadius: 3,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#a89a8c",
                lineHeight: 1.6,
              }}
            >
              J
            </kbd>
          </span>
        )}
      </div>

      {/* Regenerate dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate {stage.title}</DialogTitle>
            <DialogDescription>
              Choose the level of detail for this document. This will replace the current content.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={detailLevel} onValueChange={(v) => setDetailLevel(v as "detailed" | "summary")}>
              <div
                className="flex items-start space-x-3 p-3 rounded-lg border border-[rgba(200,180,160,0.08)] mb-2 cursor-pointer hover:bg-surface-secondary"
                onClick={() => setDetailLevel("summary")}
              >
                <RadioGroupItem value="summary" id="summary" className="mt-1" />
                <div>
                  <Label htmlFor="summary" className="text-title font-medium cursor-pointer">
                    Summary
                  </Label>
                  <p className="text-description text-contrast-medium">Concise overview with key points</p>
                </div>
              </div>
              <div
                className="flex items-start space-x-3 p-3 rounded-lg border border-[rgba(200,180,160,0.08)] cursor-pointer hover:bg-surface-secondary"
                onClick={() => setDetailLevel("detailed")}
              >
                <RadioGroupItem value="detailed" id="detailed" className="mt-1" />
                <div>
                  <Label htmlFor="detailed" className="text-title font-medium cursor-pointer">
                    Detailed
                  </Label>
                  <p className="text-description text-contrast-medium">Comprehensive document with full details</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegenerate} className="btn-primary">
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline action button component — keeps header DRY
function ActionButton({
  children,
  onClick,
  disabled = false,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        height: 30,
        border: "1px solid rgba(200,180,160,0.12)",
        borderRadius: 5,
        background: "transparent",
        color: disabled ? "#3d3228" : "#a89a8c",
        fontFamily: "inherit",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = "#f5f0eb";
          e.currentTarget.style.borderColor = "rgba(200,180,160,0.25)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = "#a89a8c";
          e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
        }
      }}
    >
      {children}
    </button>
  );
}
