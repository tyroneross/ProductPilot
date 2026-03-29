import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, FileText, Code, Layout, ListTodo, Palette, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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

  const documentContent = [...messages].reverse().find((m) => m.role === "assistant")?.content || "";

  const getStageIcon = (stageNumber: number) => {
    const icons: Record<number, typeof FileText> = {
      1: FileText,
      2: ListTodo,
      3: Palette,
      4: Layout,
      5: Code,
      6: ListTodo,
    };
    return icons[stageNumber] || FileText;
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
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const Icon = getStageIcon(stage.stageNumber);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-[rgba(200,180,160,0.08)] bg-surface-primary px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
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
          <div className="bg-surface-primary rounded-lg border border-[rgba(200,180,160,0.08)] p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-description text-contrast-medium">
              Regenerating document with {detailLevel} level...
            </p>
          </div>
        ) : documentContent ? (
          <div className="bg-surface-primary rounded-lg border border-[rgba(200,180,160,0.08)] p-8">
            <div className="prose prose-sm max-w-none prose-invert prose-a:text-[#f0b65e] prose-headings:text-[#f5f0eb] prose-code:text-[#f0b65e]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentContent}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-surface-primary rounded-lg border border-[rgba(200,180,160,0.08)] p-12 text-center">
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
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-[rgba(200,180,160,0.08)] mb-2 cursor-pointer hover:bg-surface-secondary"
                   onClick={() => setDetailLevel("summary")}>
                <RadioGroupItem value="summary" id="summary" className="mt-1" />
                <div>
                  <Label htmlFor="summary" className="text-title font-medium cursor-pointer">Summary</Label>
                  <p className="text-description text-contrast-medium">Concise overview with key points</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-[rgba(200,180,160,0.08)] cursor-pointer hover:bg-surface-secondary"
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
