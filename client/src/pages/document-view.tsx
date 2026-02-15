import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, FileText, Code, Layout, ListTodo, Palette, ChevronDown, ChevronUp, Copy, Check, Settings, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Stage, Message } from "@shared/schema";

export default function DocumentViewPage() {
  const { projectId, stageId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"detailed" | "summary">("detailed");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const documentContent = messages.find((m) => m.role === "assistant")?.content || "";

  const getStageIcon = (stageNumber: number) => {
    const icons: Record<number, typeof FileText> = {
      1: FileText,
      2: ListTodo,
      3: Palette,
      4: Layout,
      5: Code,
      6: ListTodo,
      7: Settings,
    };
    return icons[stageNumber] || FileText;
  };

  // Stage 7: Parse multi-format sections for download
  const parseRulesFiles = (content: string) => {
    const files: { name: string; filename: string; content: string }[] = [];
    const sections = [
      { header: "## CLAUDE.md", filename: "CLAUDE.md", name: "Claude Code" },
      { header: "## CURSORRULES", filename: ".cursorrules", name: "Cursor" },
      { header: "## WINDSURFRULES", filename: ".windsurfrules", name: "Windsurf" },
      { header: "## AGENTS.md", filename: "AGENTS.md", name: "OpenAI Codex" },
      { header: "## PROJECT_RULES.md", filename: "PROJECT_RULES.md", name: "Generic" },
    ];

    for (let i = 0; i < sections.length; i++) {
      const start = content.indexOf(sections[i].header);
      if (start === -1) continue;
      const contentStart = start + sections[i].header.length;
      const nextSection = sections.slice(i + 1).find(s => content.indexOf(s.header, contentStart) !== -1);
      const end = nextSection ? content.indexOf(nextSection.header, contentStart) : content.length;
      const sectionContent = content.slice(contentStart, end).trim();
      if (sectionContent) {
        files.push({ name: sections[i].name, filename: sections[i].filename, content: sectionContent });
      }
    }
    return files;
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try selecting and copying manually.",
        variant: "destructive",
      });
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
    } catch (error) {
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
      <div className="min-h-screen bg-surface-secondary">
        <div className="border-b border-gray-200 bg-surface-primary px-4 sm:px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      </div>
    );
  }

  const Icon = getStageIcon(stage.stageNumber);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-gray-200 bg-surface-primary px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/documents/${projectId}`)}
              className="min-h-[44px] min-w-[44px]"
              data-testid="button-back-documents"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-accent">
                <Icon className="w-5 h-5 text-surface-primary" />
              </div>
              <div>
                <h1 className="text-title font-medium text-contrast-high">{stage.title}</h1>
                <p className="text-metadata text-contrast-medium">{project.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="min-h-[44px]"
              data-testid="button-copy-document"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(true)}
              disabled={isRegenerating}
              className="min-h-[44px]"
              data-testid="button-regenerate-document"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {isRegenerating ? (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-description text-contrast-medium">
              Regenerating document with {detailLevel} level...
            </p>
          </div>
        ) : documentContent ? (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-8">
            {stage.stageNumber === 7 && (() => {
              const rulesFiles = parseRulesFiles(documentContent);
              if (rulesFiles.length === 0) return null;
              return (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h2 className="text-title font-medium text-contrast-high mb-1">Download Individual Files</h2>
                  <p className="text-description text-contrast-medium mb-4">Each file is formatted for its target tool.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rulesFiles.map((file) => (
                      <button
                        key={file.filename}
                        onClick={() => downloadFile(file.filename, file.content)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-surface-secondary transition-colors text-left min-h-[44px]"
                      >
                        <Download className="w-4 h-4 text-accent shrink-0" />
                        <div className="min-w-0">
                          <span className="text-description font-medium text-contrast-high block truncate">{file.filename}</span>
                          <span className="text-metadata text-contrast-medium">{file.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="prose prose-lg max-w-none">
              <div className="whitespace-pre-wrap text-contrast-high leading-relaxed">
                {documentContent}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-description text-contrast-medium mb-4">
              No content has been generated for this document yet.
            </p>
            <Button
              onClick={() => setShowRegenerateDialog(true)}
              className="btn-primary min-h-[44px]"
              data-testid="button-generate-document"
            >
              Generate Document
            </Button>
          </div>
        )}
      </main>

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
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 mb-2 cursor-pointer hover:bg-surface-secondary"
                   onClick={() => setDetailLevel("summary")}>
                <RadioGroupItem value="summary" id="summary" className="mt-1" />
                <div>
                  <Label htmlFor="summary" className="text-title font-medium cursor-pointer">Summary</Label>
                  <p className="text-description text-contrast-medium">Concise overview with key points</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-surface-secondary"
                   onClick={() => setDetailLevel("detailed")}>
                <RadioGroupItem value="detailed" id="detailed" className="mt-1" />
                <div>
                  <Label htmlFor="detailed" className="text-title font-medium cursor-pointer">Detailed</Label>
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
