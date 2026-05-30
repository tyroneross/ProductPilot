import { useState, useEffect, useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renderer for the `[ASSUMED]` marker the LLM emits when synthesizing content
// not directly supported by the user's brief. Splits any text node that
// contains the marker and replaces the literal token with a small amber chip
// so the user can scan a generated doc and immediately see what was inferred
// vs what came from their input.
function highlightAssumed(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    if (!node.includes("[ASSUMED]")) return node;
    const parts = node.split("[ASSUMED]");
    return parts.flatMap((part, i) =>
      i === 0
        ? [part]
        : [
            <span
              key={`a-${i}`}
              style={{
                display: "inline-block",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#f0b65e",
                background: "rgba(240,182,94,0.12)",
                border: "1px solid rgba(240,182,94,0.32)",
                borderRadius: "4px",
                padding: "1px 6px",
                marginRight: "6px",
                verticalAlign: "1px",
              }}
              title="Synthesized from defaults — not derived from your brief"
            >
              Assumed
            </span>,
            part,
          ],
    );
  }
  if (Array.isArray(node)) return node.map((c, i) => <span key={i}>{highlightAssumed(c)}</span>);
  return node;
}
import Nav from "@/components/nav";
import Breadcrumb from "@/components/breadcrumb";
import { displayProjectName } from "@/lib/project-name";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, FileText, Code, Layout, ListTodo, Palette, Copy, Check, Download, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert, Info, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Stage, Message, OpenQuestion } from "@shared/schema";
import OpenQuestionRow from "@/components/open-question-row";
import { CrossFade } from "@/components/cross-fade";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

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

// Warm Craft loading skeleton for the document view. Shown while the project,
// stages, OR the stage's messages are still fetching so the user never sees a
// bare empty frame flash before content arrives (the prior gate ignored the
// messages query, so `documentContent` was "" for a beat and the whole page
// rendered blank).
function DocumentViewSkeleton() {
  const shimmer = "dv-skel-shimmer";
  const bar = (w: string, h = 14, mb = 12) => (
    <div
      className={shimmer}
      style={{ width: w, height: h, borderRadius: 6, marginBottom: mb }}
    />
  );
  return (
    <div
      data-testid="document-view-skeleton"
      className="min-h-screen flex flex-col"
      style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      aria-busy="true"
      aria-label="Loading document"
    >
      <style>{`
        @keyframes dvSkelPulse { 0% { opacity: .55 } 50% { opacity: 1 } 100% { opacity: .55 } }
        .dv-skel-shimmer {
          background: linear-gradient(90deg, rgba(240,182,94,0.06), rgba(240,182,94,0.12), rgba(240,182,94,0.06));
          animation: dvSkelPulse 1.4s ease-in-out infinite;
        }
      `}</style>
      <Nav />
      {/* Header bar */}
      <div style={{ background: "#1a1714", borderBottom: "1px solid rgba(200,180,160,0.08)" }}>
        <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div className={shimmer} style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div className={shimmer} style={{ width: 220, height: 18, borderRadius: 6 }} />
          <div style={{ flex: 1 }} />
          <div className={shimmer} style={{ width: 90, height: 30, borderRadius: 8 }} />
          <div className={shimmer} style={{ width: 90, height: 30, borderRadius: 8 }} />
        </div>
        {/* Tab strip */}
        <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "0 24px 10px", display: "flex", gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={shimmer} style={{ width: 86, height: 28, borderRadius: 6 }} />
          ))}
        </div>
      </div>
      {/* Body shimmer lines */}
      <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        {bar("38%", 22, 24)}
        {bar("100%")}
        {bar("96%")}
        {bar("88%")}
        {bar("100%")}
        {bar("72%", 14, 28)}
        {bar("100%")}
        {bar("90%")}
        {bar("60%")}
      </div>
    </div>
  );
}

export default function DocumentViewPage() {
  const { projectId, stageId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"detailed" | "summary">("detailed");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [handoffCopied, setHandoffCopied] = useState(false);
  const [isCopyingHandoff, setIsCopyingHandoff] = useState(false);
  const [isDownloadingDoc, setIsDownloadingDoc] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  // T2-3: overflow menu for History / Export JSON / Download all — moves
  // those three off the primary action bar so the eye lands on Copy /
  // Download .md / Copy-for-Claude-Code / Regenerate first.
  const [moreOpen, setMoreOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<
    Array<{ version: number; createdAt: string; charCount: number }> | null
  >(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

  const stage = stages.find((s) => s.id === stageId);

  const {
    data: messages = [],
    refetch: refetchMessages,
    isLoading: messagesLoading,
    isFetching: messagesFetching,
    dataUpdatedAt: messagesDataUpdatedAt,
  } = useQuery<Message[]>({
    queryKey: ["/api/stages", stageId, "messages"],
    enabled: !!stageId,
  });

  const documentContent = [...messages].reverse().find((m) => m.role === "assistant")?.content || "";

  // Defect #1 — surface inline-answer rows for any structured Open Questions
  // the LLM emitted in this stage's doc. The endpoint returns the merged list
  // across all stages; we filter to the current stage here.
  const { data: openQuestionsResp } = useQuery<{ openQuestions: OpenQuestion[] }>({
    queryKey: ["/api/projects", projectId, "open-questions"],
    enabled: !!projectId && !!documentContent,
  });
  const openQuestionsForStage = (openQuestionsResp?.openQuestions ?? []).filter(
    (q) => q.stageId === stageId,
  );

  // Defect #2 root-cause guard. The flash of "Continue intake" during tab
  // switches happens when (a) the current `messages` query has just re-keyed
  // to a new `stageId` and (b) React Query's per-render state reports
  // `isLoading === false` for one frame because the new observer mounts
  // after a frame in which data is `undefined` but `isFetching` hasn't yet
  // flipped to `true`. The original predicate at the skeleton gate only
  // checked `messagesLoading` so a single such frame leaked through to the
  // body and rendered the Continue-intake control because `documentContent`
  // was "". Tracking the stage we've *actually settled on* (a non-fetching,
  // post-mount paint) lets the gate hold the skeleton until the data for the
  // NEW stageId has arrived, not just until the OLD query reports done.
  const settledStageIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (stageId && !messagesFetching && messagesDataUpdatedAt > 0) {
      settledStageIdRef.current = stageId;
    }
  }, [stageId, messagesFetching, messagesDataUpdatedAt]);
  const stageDataIsStale = !!stageId && settledStageIdRef.current !== stageId;

  // ── Spec linter (Phase 3) ────────────────────────────────────────────
  // Only runs for adaptive-mode projects; otherwise we skip to keep noise
  // out of legacy survey/minimum projects which the linter doesn't validate.
  type LintIssue = {
    id: string;
    rule: string;
    severity: "block" | "warn" | "info";
    waivable: boolean;
    message: string;
    refs: Array<{ kind: string; id: string }>;
  };
  type LintResult = {
    issues: LintIssue[];
    blockerCount: number;
    nonWaivableCount: number;
    llmRan: boolean;
  };

  const lintEnabled = !!projectId && project?.intakeMode === "adaptive";
  const { data: lintResult } = useQuery<LintResult>({
    queryKey: ["/api/projects", projectId, "spec/lint"],
    queryFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/spec/lint`, {});
      return res.json();
    },
    enabled: lintEnabled,
  });

  const projectWaivers = ((project?.productState as { workingMemory?: { waivers?: Record<string, unknown> } } | null | undefined)?.workingMemory?.waivers) ?? {};
  const isWaived = (issueId: string) => Object.prototype.hasOwnProperty.call(projectWaivers, issueId);
  // Lint surfaces are advisory — they inform the user but don't block actions.
  // A single severity flag is kept so the panel can warn-tint when there are
  // un-waived warnings, but no button is disabled because of it.
  const visibleIssues = (lintResult?.issues ?? []).filter(
    (i) => i.severity !== "info" && !isWaived(i.id),
  );
  const hasAdvisories = visibleIssues.length > 0;

  // Adaptive-intake gating: when project is in adaptive mode AND no answers
  // have been captured yet, the regenerate endpoint will 400 with
  // `adaptive_intake_incomplete`. Surface a "Continue intake" link rather than
  // a button that 400s, so the user knows where to go.
  const adaptiveIntakeAnswers = ((project?.productState as
    | { workingMemory?: { intakeAnswers?: unknown[] } }
    | null
    | undefined)?.workingMemory?.intakeAnswers) ?? [];
  const adaptiveIntakeIncomplete =
    project?.intakeMode === "adaptive" && adaptiveIntakeAnswers.length === 0;
  const continueIntakeHref = projectId ? `/details?projectId=${projectId}&adaptive=1` : "/details";

  // Tradeoff weights flagged as auto-defaulted (when finalize/export was
  // called without the user allocating). Server sets the flag inside
  // productState.workingMemory; we surface it as a small advisory in the
  // document view so the user can choose to allocate explicitly.
  const tradeoffWeightsAssumed = Boolean(
    (project?.productState as { workingMemory?: { tradeoff_weights_assumed?: boolean } } | null | undefined)
      ?.workingMemory?.tradeoff_weights_assumed,
  );

  // Defect #3 — the user explicitly chose "fill remaining sections with AI
  // assumptions". Each [ASSUMED] tag in the rendered markdown is already
  // surfaced by highlightAssumed; this flag drives a per-section banner
  // that replaces the global "Brief is light" nag with "N assumed values —
  // review or refine".
  const userChoseAssumptionFill = Boolean(
    (project?.productState as { workingMemory?: { user_chose_assumption_fill?: boolean } } | null | undefined)
      ?.workingMemory?.user_chose_assumption_fill,
  );
  const assumedCountForStage = (() => {
    if (!documentContent) return 0;
    const matches = documentContent.match(/\[ASSUMED\]/g);
    return matches ? matches.length : 0;
  })();

  // Build ordered list of docs with their stage data
  const orderedDocs = DOC_TYPES.map((dt) => ({
    ...dt,
    stage: stages.find((s) => s.stageNumber === dt.stageNumber) ?? null,
  }));

  const currentIndex = stage ? orderedDocs.findIndex((d) => d.stageNumber === stage.stageNumber) : -1;

  const prevDoc = currentIndex > 0 ? orderedDocs[currentIndex - 1] : null;
  const nextDoc = currentIndex >= 0 && currentIndex < orderedDocs.length - 1 ? orderedDocs[currentIndex + 1] : null;

  const reducedMotion = useReducedMotion();

  const navigateToDoc = useCallback(
    (doc: typeof orderedDocs[number]) => {
      if (!doc.stage || doc.stage.progress !== 100) return;
      const go = () => setLocation(`/document/${projectId}/${doc.stage!.id}`);
      // Progressive enhancement: when document.startViewTransition exists
      // (Chrome/Edge 111+; Safari 18.2+), wrap the route swap so the
      // browser snapshots before/after and cross-fades them. CrossFade
      // continues to handle the per-stage content fade as a fallback in
      // browsers without the API. We deliberately don't use the API for
      // reduced-motion users — startViewTransition still animates.
      const docAny = typeof document !== "undefined" ? (document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      }) : undefined;
      if (!reducedMotion && docAny && typeof docAny.startViewTransition === "function") {
        docAny.startViewTransition(go);
      } else {
        go();
      }
    },
    [projectId, setLocation, reducedMotion]
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

  // Sliding underline indicator. Tracks the active tab's left/width so a
  // single bar can translate + grow between tabs instead of the per-button
  // borderBottom snapping. Measured in useLayoutEffect to land in the same
  // frame as the new active state (avoids a flash of "no underline").
  const [underline, setUnderline] = useState<{ left: number; width: number; ready: boolean }>(
    { left: 0, width: 0, ready: false },
  );
  useLayoutEffect(() => {
    const btn = activeTabRef.current;
    const list = tablistRef.current;
    if (!btn || !list) return;
    // offsetLeft is relative to the offsetParent. tablistRef is the parent;
    // ensure it's `position: relative` (set in the style block below). The
    // underline lives inside the scrollable tablist so it scrolls naturally
    // with the tabs.
    setUnderline({ left: btn.offsetLeft, width: btn.offsetWidth, ready: true });
  }, [stageId, stages.length]);

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

  // Download a server-rendered markdown blob from an endpoint that sets a
  // Content-Disposition filename. Shared by per-doc and aggregate export.
  const downloadMarkdown = async (url: string, fallbackName: string) => {
    const res = await fetch(url, { method: "GET", credentials: "include" });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    const text = await res.text();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? fallbackName;
    const blob = new Blob([text], { type: "text/markdown" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadDoc = async () => {
    if (!projectId || !stage) return;
    setIsDownloadingDoc(true);
    try {
      await downloadMarkdown(
        `/api/projects/${projectId}/stages/${stage.id}/document.md`,
        `${stage.title}.md`,
      );
      toast({ title: "Document downloaded", description: `${stage.title}.md saved.` });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingDoc(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!projectId) return;
    setIsDownloadingAll(true);
    try {
      await downloadMarkdown(
        `/api/projects/${projectId}/documents.md`,
        `${project?.name ?? "project"}-all-documents.md`,
      );
      toast({ title: "All documents downloaded", description: "Combined markdown saved." });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const openHistory = async () => {
    if (!projectId || !stage) return;
    setShowHistory(true);
    setVersionsLoading(true);
    setVersions(null);
    try {
      const res = await apiRequest(
        "GET",
        `/api/projects/${projectId}/stages/${stage.id}/versions`,
      );
      setVersions(await res.json());
    } catch {
      toast({
        title: "Couldn't load history",
        description: "Please try again.",
        variant: "destructive",
      });
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!projectId || !stage) return;
    setRestoringVersion(version);
    try {
      await apiRequest(
        "POST",
        `/api/projects/${projectId}/stages/${stage.id}/versions/${version}/restore`,
      );
      await refetchMessages();
      setShowHistory(false);
      toast({
        title: "Version restored",
        description: `Version ${version} is now the current document (saved as a new version).`,
      });
    } catch (err) {
      toast({
        title: "Restore failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRestoringVersion(null);
    }
  };

  // Phase 5 — Copy the agent-handoff.md content to the clipboard. Distinct
  // from handleCopy (which copies the currently-rendered stage) and handleExport
  // (which downloads a multi-stage zipless markdown). This one fetches the
  // server-rendered handoff endpoint, which gates on lint cleanliness + PII +
  // weights. Any 409 surface as an inline toast describing the gate.
  // T2-2: surface the handoff button for all projects. The server endpoint
  // only succeeds for adaptive mode (it synthesizes the artifact from
  // productState), so survey-mode users see a disabled button with a
  // tooltip explaining the upgrade path instead of the button being hidden
  // entirely (which made the core value prop invisible to default-path
  // users). isHandoffPlatform stays the "actually clickable" signal;
  // handoffSupported is the "visible at all" signal.
  const isHandoffPlatform = !!project?.intakeMode && project.intakeMode === "adaptive";
  const handoffSupported = !!project;
  const handoffDisabled =
    !projectId || !isHandoffPlatform || isCopyingHandoff;
  const handoffTooltip = !isHandoffPlatform
    ? "Available for projects built with adaptive intake. Start a new project from the Details page to use this."
    : isCopyingHandoff
      ? "Preparing handoff…"
      : "Copies a Claude Code-ready brief to your clipboard.";

  const handleCopyHandoff = async () => {
    if (!projectId || handoffDisabled) return;
    setIsCopyingHandoff(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/handoff.md`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        let serverMessage: string | undefined;
        let code: string | undefined;
        try {
          const body = await res.json();
          serverMessage = body?.message;
          code = body?.code;
        } catch {
          // server returned non-JSON; fall through with status text
        }
        const description =
          serverMessage ??
          (code === "intake_mode_not_adaptive"
            ? "This project is not in adaptive intake mode."
            : `Handoff request failed (${res.status}).`);
        toast({
          title: "Handoff blocked",
          description,
          variant: "destructive",
        });
        return;
      }
      const markdown = await res.text();
      await navigator.clipboard.writeText(markdown);
      setHandoffCopied(true);
      setTimeout(() => setHandoffCopied(false), 2000);
      toast({
        title: "Copied for Claude Code",
        description: "Paste the handoff into Claude Code, Cursor, or Codex.",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCopyingHandoff(false);
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
    } catch (err) {
      // apiRequest throws Error(`${status}: ${body}`). Body may be JSON
      // ({message, errorCode, retryAfterSeconds}) or plain text.
      // T2-4: prefer the classified message + use errorCode to pick the toast title.
      const raw = err instanceof Error ? err.message : String(err);
      const colon = raw.indexOf(": ");
      const status = colon > 0 ? raw.slice(0, colon) : "";
      const body = colon > 0 ? raw.slice(colon + 2) : raw;
      let serverMessage = body;
      let errorCode: string | null = null;
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed.message === "string") serverMessage = parsed.message;
        if (parsed && typeof parsed.errorCode === "string") errorCode = parsed.errorCode;
      } catch {
        // body wasn't JSON — fall through with the raw text
      }
      const title =
        status === "400"
          ? "Can't generate yet"
          : errorCode === "rate_limit"
            ? "Rate-limited by the provider"
            : errorCode === "invalid_key"
              ? "API key problem"
              : errorCode === "provider_unavailable"
                ? "Provider unavailable"
                : errorCode === "timeout"
                  ? "Request timed out"
                  : errorCode === "context_too_large"
                    ? "Request too large"
                    : "Regeneration failed";
      toast({
        title,
        description: serverMessage || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Loading: project still fetching, OR stages still fetching.
  // Empty: project loaded, stages loaded, but the requested stageId is not in
  // the project's stage set (fresh project before docs generation, or a stale
  // / mistyped URL). Show a friendly empty state so the page isn't a silent
  // infinite spinner.
  // Show the Warm Craft skeleton while project/stages are fetching OR while the
  // requested stage exists but its messages (the document body) are still
  // loading and nothing has rendered yet. This removes the empty-frame flash
  // the user saw when clicking "View".
  // Hold the skeleton while ANY of these are true:
  //   - project query has not resolved
  //   - stages query is in its first fetch
  //   - we have a stageId but we have not yet *settled* on it (the new
  //     messages query has not produced a non-fetching paint with data for
  //     this exact stageId). This covers tab switches even when React Query
  //     briefly reports messagesLoading === false on the new key.
  //   - the messages query is mid-fetch and we have no document content yet
  if (
    !project ||
    stagesLoading ||
    (stage && stageDataIsStale) ||
    (stage && (messagesLoading || messagesFetching) && documentContent === "")
  ) {
    return <DocumentViewSkeleton />;
  }

  if (!stage) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <Nav />
        <div
          data-testid="document-view-empty"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>
              No document for this stage yet
            </h1>
            <p style={{ fontSize: 14, color: "#a89a8c", lineHeight: 1.5, marginBottom: 24 }}>
              {project.name} hasn't generated this stage yet, or the stage URL is stale. Head back to the project's documents page to see what's available.
            </p>
            <button
              onClick={() => setLocation(`/documents/${projectId}`)}
              data-testid="button-back-to-documents"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 36,
                padding: "8px 16px",
                background: "#f0b65e",
                color: "#110f0d",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back to documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  const Icon = getStageIcon(stage.stageNumber);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* T2-3: bump touch targets to 44px on phones (WCAG 2.5.5). */
        @media (max-width: 640px) {
          .action-button { min-height: 44px !important; }
        }
        .more-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 30;
          background: #1a1714;
          border: 1px solid rgba(200,180,160,0.18);
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
      `}</style>
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
        {/* Breadcrumb — full navigable hierarchy */}
        <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "10px 24px 0" }}>
          <Breadcrumb
            segments={[
              { label: "Projects", href: "/projects" },
              { label: displayProjectName(project), href: `/documents/${projectId}` },
              { label: stage.title },
            ]}
          />
        </div>

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
            className="transition-colors duration-150"
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
              {displayProjectName(project)}
            </div>
          </div>

          {/* T2-3: tiered action bar. Primary = the one action this view
              optimizes for (handoff if the platform supports it; otherwise
              Continue intake / Regenerate). Secondary = peer actions (Copy,
              Download .md). Overflow (More) = History, Export JSON,
              Download all — actions the user rarely needs on the hot path. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <ActionButton
              onClick={handleCopy}
              variant="secondary"
              data-testid="button-copy-document"
              aria-label={copied ? "Copied" : "Copy document"}
            >
              {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </ActionButton>
            <ActionButton
              onClick={handleDownloadDoc}
              disabled={isDownloadingDoc}
              variant="secondary"
              data-testid="button-download-doc"
              aria-label="Download this document as markdown"
            >
              <Download style={{ width: 13, height: 13 }} />
              <span>{isDownloadingDoc ? "Saving…" : "Download .md"}</span>
            </ActionButton>

            {/* Overflow dropdown — three actions tucked behind one button to
                cut Hick's-law load from 7 visible affordances down to 3. */}
            <div style={{ position: "relative" }}>
              <ActionButton
                onClick={() => setMoreOpen((v) => !v)}
                variant="secondary"
                data-testid="button-more-actions"
                aria-label="More document actions"
              >
                <MoreHorizontal style={{ width: 13, height: 13 }} />
                <span>More</span>
              </ActionButton>
              {moreOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 20 }}
                    onClick={() => setMoreOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="more-menu" role="menu">
                    <ActionButton
                      onClick={() => { setMoreOpen(false); openHistory(); }}
                      variant="ghost"
                      data-testid="button-version-history"
                      aria-label="View version history"
                    >
                      <ListTodo style={{ width: 13, height: 13 }} />
                      <span>History</span>
                    </ActionButton>
                    <ActionButton
                      onClick={() => { setMoreOpen(false); handleDownloadAll(); }}
                      disabled={isDownloadingAll}
                      variant="ghost"
                      data-testid="button-download-all-md"
                      aria-label="Download all documents as one markdown file"
                    >
                      <Download style={{ width: 13, height: 13 }} />
                      <span>{isDownloadingAll ? "Saving…" : "Download all"}</span>
                    </ActionButton>
                    <ActionButton
                      onClick={() => { setMoreOpen(false); handleExport(); }}
                      disabled={isExporting}
                      variant="ghost"
                      data-testid="button-export-all"
                      aria-label="Export all documents as JSON"
                    >
                      <Download style={{ width: 13, height: 13 }} />
                      <span>{isExporting ? "Exporting…" : "Export JSON"}</span>
                    </ActionButton>
                  </div>
                </>
              )}
            </div>

            {/* Primary action — exactly one. Selection order:
                  1. Adaptive intake incomplete → Continue intake.
                  2. Otherwise → Copy for Claude Code (T2-2: visible to every
                     user, even survey-mode; disabled+tooltip when their
                     project can't produce a handoff so the value prop is
                     discoverable rather than hidden).
                  3. Regenerate becomes secondary in the more menu for
                     non-adaptive (T2-2 fallback path). */}
            {adaptiveIntakeIncomplete && !messagesFetching ? (
              <ActionButton
                onClick={() => setLocation(continueIntakeHref)}
                disabled={false}
                variant="primary"
                data-testid="button-continue-intake"
                aria-label="Continue adaptive intake"
              >
                <ArrowLeft style={{ width: 13, height: 13 }} />
                <span>Continue intake</span>
              </ActionButton>
            ) : !isHandoffPlatform ? (
              // Non-adaptive: show Regenerate as the primary action and a
              // dimmed Handoff hint after it so users see the feature exists.
              <>
                <ActionButton
                  onClick={() => setShowRegenerateDialog(true)}
                  disabled={isRegenerating}
                  variant="primary"
                  data-testid="button-regenerate-document"
                  aria-label="Regenerate document"
                >
                  <RefreshCw style={{ width: 13, height: 13, animation: isRegenerating ? "spin 0.8s linear infinite" : "none" }} />
                  <span>{isRegenerating ? "Regenerating…" : "Regenerate"}</span>
                </ActionButton>
                {handoffSupported && (
                  <span title={handoffTooltip} style={{ display: "inline-flex" }}>
                    <ActionButton
                      onClick={() => { /* disabled — title carries the why */ }}
                      disabled={true}
                      variant="secondary"
                      data-testid="button-copy-handoff-locked"
                      aria-label="Copy for Claude Code (available with adaptive intake)"
                    >
                      <Code style={{ width: 13, height: 13 }} />
                      <span>Copy for Claude Code</span>
                    </ActionButton>
                  </span>
                )}
              </>
            ) : (
              <ActionButton
                onClick={handleCopyHandoff}
                disabled={handoffDisabled}
                variant="primary"
                data-testid="button-copy-handoff"
                aria-label={isCopyingHandoff ? "Preparing handoff…" : "Copy for Claude Code"}
              >
                {handoffCopied ? <Check style={{ width: 13, height: 13 }} /> : <Code style={{ width: 13, height: 13 }} />}
                <span>
                  {isCopyingHandoff ? "Copying…" : handoffCopied ? "Copied" : "Copy for Claude Code"}
                </span>
              </ActionButton>
            )}
          </div>
        </div>

        {/* Artifact stepper — horizontal scroll on narrow screens.
            position:relative so the sliding-underline indicator (absolutely
            positioned at the end of this list) anchors to the scroll content
            and translates with the active tab instead of snapping. */}
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
            position: "relative",
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
                className="transition-colors duration-150"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "9px 12px",
                  border: "none",
                  // Layout reserves 2px below each tab for the sliding-underline
                  // indicator (rendered as an absolutely-positioned bar inside
                  // the tablist, see end of orderedDocs.map). Keeping a
                  // transparent border-bottom preserves the previous per-tab
                  // height so removing this and adding the bar is a no-op for
                  // layout.
                  borderBottom: "2px solid transparent",
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
          {/* Sliding underline indicator. Single bar that translates between
              the active tab positions (measured via offsetLeft / offsetWidth
              in the useLayoutEffect above). Snaps when prefers-reduced-motion
              is set — the JS check skips the 200ms transform/width transition
              and the CSS media block strips any residual transition. */}
          <span
            aria-hidden="true"
            data-testid="active-tab-underline"
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              height: 2,
              width: underline.width,
              background: "#f0b65e",
              transform: `translateX(${underline.left}px)`,
              transition: reducedMotion
                ? "none"
                : "transform 200ms ease, width 200ms ease",
              opacity: underline.ready ? 1 : 0,
              pointerEvents: "none",
            }}
          />
        </div>
      </header>

      {/* Main content
          ─────────────
          Wrapped in CrossFade so a tab switch fades the outgoing stage's
          content out (~150ms) and the incoming stage's content in (~150ms)
          instead of snapping. CrossFade honors prefers-reduced-motion and
          snaps when the user has expressed that preference. The skeleton
          path (DocumentViewSkeleton, see early return above) still owns the
          "data not yet ready" window — this fade is content-to-content only. */}
      <main
        style={{
          flex: 1,
          maxWidth: "52rem",
          margin: "0 auto",
          width: "100%",
          padding: "32px 24px 80px",
        }}
      >
      <CrossFade keyId={stage.id} duration={150}>
        {/* Defect #3 — per-section assumption banner. Replaces the generic
            "Brief is light" nag with a section-scoped, count-driven message
            after the user opts into "fill remaining with assumptions". The
            count comes from [ASSUMED] markers the doc generator emitted. */}
        {userChoseAssumptionFill && assumedCountForStage > 0 && stage && (
          <div
            data-testid="section-assumptions-banner"
            style={{
              background: "#1a1714",
              borderRadius: 8,
              border: "1px solid rgba(240,182,94,0.22)",
              padding: "10px 14px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "#c8b4a0",
            }}
          >
            <Info style={{ width: 14, height: 14, color: "#f0b65e", flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              {assumedCountForStage} assumed value{assumedCountForStage === 1 ? "" : "s"} in {stage.title}. Review or refine — each is flagged inline.
            </span>
            <button
              onClick={() => setLocation(continueIntakeHref)}
              style={{
                background: "transparent",
                border: "1px solid rgba(240,182,94,0.4)",
                color: "#f0b65e",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
              data-testid="button-refine-intake"
            >
              Refine
            </button>
          </div>
        )}

        {/* Spec linter panel — adaptive-mode only. Surfaces unwaived blockers, warnings, info */}
        {tradeoffWeightsAssumed && (
          <div
            data-testid="weights-assumed-banner"
            style={{
              background: "#1a1714",
              borderRadius: 8,
              border: "1px solid rgba(240,182,94,0.22)",
              padding: "10px 14px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "#c8b4a0",
            }}
          >
            <Info style={{ width: 14, height: 14, color: "#f0b65e", flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              Tradeoff priorities were inferred (even split, security as the priority axis). Allocate them to refine architecture decisions.
            </span>
            <button
              onClick={() => setLocation(continueIntakeHref)}
              style={{
                background: "transparent",
                border: "1px solid rgba(240,182,94,0.4)",
                color: "#f0b65e",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
              data-testid="button-allocate-weights"
            >
              Allocate
            </button>
          </div>
        )}

        {lintEnabled && lintResult && hasAdvisories && (
          <div
            data-testid="lint-panel"
            style={{
              background: "#1a1714",
              borderRadius: 8,
              border: "1px solid rgba(240,182,94,0.22)",
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 500,
                color: "#f0b65e",
                marginBottom: 8,
              }}
            >
              <Info style={{ width: 14, height: 14 }} />
              <span>
                {visibleIssues.length === 1 ? "1 note" : `${visibleIssues.length} notes`} on this spec
              </span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleIssues.map((issue) => {
                const waived = isWaived(issue.id);
                const sevColor =
                  issue.severity === "block" ? "#dc5a50" :
                  issue.severity === "warn" ? "#f0b65e" : "#a89a8c";
                const Icon =
                  issue.severity === "block" ? ShieldAlert :
                  issue.severity === "warn" ? AlertTriangle : Info;
                return (
                  <li
                    key={issue.id}
                    data-testid={`lint-issue-${issue.rule}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: "#c8b4a0",
                      opacity: waived ? 0.5 : 1,
                    }}
                  >
                    <Icon style={{ width: 12, height: 12, color: sevColor, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <span>{issue.message}</span>
                      {waived && (
                        <span style={{ color: "#6b5d52", marginLeft: 6, fontStyle: "italic" }}>· waived</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
          <>
            {/* Defect #1 — Open Questions callout. Renders above the markdown body
                so the user can answer in place before re-reading the doc. */}
            {projectId && openQuestionsForStage.length > 0 && (
              <div
                data-testid="open-questions-panel"
                style={{
                  background: "#1a1714",
                  borderRadius: 8,
                  border: "1px solid rgba(240,182,94,0.22)",
                  padding: "14px 16px",
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: "#f0b65e", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {openQuestionsForStage.filter((q) => !q.answeredValue).length === 0
                    ? "All open questions answered"
                    : `${openQuestionsForStage.filter((q) => !q.answeredValue).length} open question${openQuestionsForStage.filter((q) => !q.answeredValue).length === 1 ? "" : "s"} for this section`}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {openQuestionsForStage.map((q) => (
                    <OpenQuestionRow key={q.topicId} projectId={projectId} question={q} />
                  ))}
                </ul>
              </div>
            )}
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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p>{highlightAssumed(children)}</p>,
                    li: ({ children }) => <li>{highlightAssumed(children)}</li>,
                  }}
                >
                  {documentContent}
                </ReactMarkdown>
              </div>
            </div>
          </>
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
              {adaptiveIntakeIncomplete && !messagesFetching
                ? "Finish the adaptive intake to generate this document."
                : "No content has been generated for this document yet."}
            </p>
            {adaptiveIntakeIncomplete && !messagesFetching ? (
              <button
                onClick={() => setLocation(continueIntakeHref)}
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
                data-testid="button-continue-intake-empty"
              >
                Continue intake
              </button>
            ) : (
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
            )}
          </div>
        )}
      </CrossFade>
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

      {/* Version history — restore is non-destructive: it copies an older
          version's content into a new current version, history is preserved. */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version history — {stage.title}</DialogTitle>
            <DialogDescription>
              Each regenerate saves a new version. Restoring an earlier version
              makes it the current document and keeps the full history.
            </DialogDescription>
          </DialogHeader>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {versionsLoading ? (
              <p style={{ fontSize: 13, color: "#a89a8c", padding: "12px 0" }}>
                Loading versions…
              </p>
            ) : !versions || versions.length === 0 ? (
              <p
                data-testid="version-history-empty"
                style={{ fontSize: 13, color: "#a89a8c", padding: "12px 0" }}
              >
                No earlier versions yet.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {[...versions]
                  .sort((a, b) => b.version - a.version)
                  .map((v, idx) => {
                    const isCurrent = idx === 0;
                    return (
                      <li
                        key={v.version}
                        data-testid={`version-row-${v.version}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: "1px solid rgba(200,180,160,0.08)",
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>
                            Version {v.version}
                          </span>
                          {isCurrent && (
                            <span style={{ color: "#f0b65e", marginLeft: 8 }}>
                              (current)
                            </span>
                          )}
                          <div style={{ fontSize: 11, color: "#a89a8c", marginTop: 2 }}>
                            {new Date(v.createdAt).toLocaleString()} · {v.charCount} chars
                          </div>
                        </div>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restoringVersion !== null}
                            onClick={() => handleRestoreVersion(v.version)}
                            data-testid={`button-restore-${v.version}`}
                          >
                            {restoringVersion === v.version ? "Restoring…" : "Restore"}
                          </Button>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline action button component — keeps header DRY.
//
// T2-3: three tiers establish visual hierarchy (Fitts × signal-to-noise).
//   primary   — filled accent. Used for the single most-important action
//               (handoff > regenerate) so the eye lands on it first.
//   secondary — outline (the previous default). Useful peer actions: Copy,
//               Download .md.
//   ghost     — borderless menu item. Used inside the overflow dropdown.
// Min-height: 36px desktop, 44px mobile (Fitts / WCAG touch-target).
function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  const baseBg = isPrimary ? "#f0b65e" : "transparent";
  const baseColor = isPrimary ? "#15110d" : disabled ? "#3d3228" : "#a89a8c";
  const baseBorder = isGhost
    ? "1px solid transparent"
    : isPrimary
      ? "1px solid #f0b65e"
      : "1px solid rgba(200,180,160,0.12)";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      className="action-button focus-ring transition-colors duration-150"
      data-variant={variant}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "0 12px",
        minHeight: 36,
        border: baseBorder,
        borderRadius: 6,
        background: baseBg,
        color: baseColor,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: isPrimary ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (isPrimary) {
          e.currentTarget.style.background = "#d4a04e";
        } else {
          e.currentTarget.style.color = "#f5f0eb";
          if (!isGhost) {
            e.currentTarget.style.borderColor = "rgba(200,180,160,0.25)";
          } else {
            e.currentTarget.style.background = "rgba(200,180,160,0.06)";
          }
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        if (isPrimary) {
          e.currentTarget.style.background = "#f0b65e";
        } else {
          e.currentTarget.style.color = "#a89a8c";
          if (!isGhost) {
            e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
          } else {
            e.currentTarget.style.background = "transparent";
          }
        }
      }}
    >
      {children}
    </button>
  );
}
