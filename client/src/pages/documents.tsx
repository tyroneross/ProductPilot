import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, FileText, Code, Layout, ListTodo, Palette, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Stage } from "@shared/schema";

export default function DocumentsPage() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [detailLevel, setDetailLevel] = useState<"detailed" | "summary">("detailed");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [], refetch: refetchStages } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

  const handleGenerateClick = (stage: Stage, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStage(stage);
    setShowGenerateDialog(true);
  };

  const handleGenerate = async () => {
    if (!selectedStage) return;
    
    setIsGenerating(true);
    setShowGenerateDialog(false);
    
    try {
      await apiRequest("POST", `/api/projects/${projectId}/generate-docs-from-survey`, {
        documentPreferences: [{ stageId: selectedStage.id, detailLevel }],
      });
      
      await refetchStages();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      
      toast({
        title: "Document generated",
        description: `${selectedStage.title} has been generated.`,
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setSelectedStage(null);
    }
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const documents = [
    {
      id: "requirements",
      title: "Requirements Definition",
      icon: FileText,
      stage: stages.find((s) => s.stageNumber === 1),
      description: "User personas, use cases, and MVP scope",
    },
    {
      id: "prd",
      title: "Product Requirements Document",
      icon: ListTodo,
      stage: stages.find((s) => s.stageNumber === 2),
      description: "User stories, features, and success metrics",
    },
    {
      id: "ui-design",
      title: "UI Design & Wireframes",
      icon: Palette,
      stage: stages.find((s) => s.stageNumber === 3),
      description: "Simple wireframe mockups with orange theme",
    },
    {
      id: "architecture",
      title: "System Architecture",
      icon: Layout,
      stage: stages.find((s) => s.stageNumber === 4),
      description: "Technical design and architecture decisions",
    },
    {
      id: "prompts",
      title: "Coding Prompts",
      icon: Code,
      stage: stages.find((s) => s.stageNumber === 5),
      description: "AI-optimized implementation instructions",
    },
    {
      id: "guide",
      title: "Development Guide",
      icon: ListTodo,
      stage: stages.find((s) => s.stageNumber === 6),
      description: "Implementation roadmap and milestones",
    },
  ];

  const generatedDocs = documents.filter(doc => doc.stage && doc.stage.progress === 100);
  const pendingDocs = documents.filter(doc => doc.stage && doc.stage.progress < 100);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-gray-200 bg-surface-primary px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/projects")}
              className="min-h-[44px] min-w-[44px] shrink-0"
              data-testid="button-back-projects"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-h3 font-medium text-contrast-high truncate">{project.name}</h1>
              <p className="text-description text-contrast-medium hidden sm:block">Product documentation and iteration</p>
            </div>
          </div>
          <Button
            onClick={() => setLocation(`/session/survey?projectId=${project.id}`)}
            className="btn-primary min-h-[44px] shrink-0"
            data-testid="button-continue-building"
          >
            <span className="hidden sm:inline">Continue Building</span>
            <span className="sm:hidden">Continue</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Generated Documents Section */}
        {generatedDocs.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-title text-contrast-high mb-1">Your Documents</h2>
              <p className="text-description text-contrast-medium">
                Click any document to view or refine it.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedDocs.map((doc) => {
                const Icon = doc.icon;
                return (
                  <div
                    key={doc.id}
                    className="bg-surface-primary rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => doc.stage && setLocation(`/document/${projectId}/${doc.stage.id}`)}
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="flex flex-col space-y-3">
                      <div className="p-3 rounded-lg self-start bg-accent">
                        <Icon className="w-6 h-6 text-surface-primary" />
                      </div>
                      <div>
                        <h3 className="text-title text-contrast-high mb-1">{doc.title}</h3>
                        <p className="text-description text-contrast-medium mb-3">{doc.description}</p>
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 bg-surface-secondary rounded-full h-2">
                            <div
                              className="bg-accent h-2 rounded-full transition-all duration-300"
                              style={{ width: `100%` }}
                            />
                          </div>
                          <span className="text-metadata text-accent font-medium">
                            Complete
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Documents Section */}
        {pendingDocs.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-title text-contrast-high mb-1">Available to Generate</h2>
              <p className="text-description text-contrast-medium">
                These documents can be generated from your survey data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingDocs.map((doc) => {
                const Icon = doc.icon;
                const isCurrentlyGenerating = isGenerating && selectedStage?.id === doc.stage?.id;
                
                return (
                  <div
                    key={doc.id}
                    className="bg-surface-primary rounded-lg border border-gray-200 p-6 opacity-70"
                    data-testid={`document-pending-${doc.id}`}
                  >
                    <div className="flex flex-col space-y-3">
                      <div className="p-3 rounded-lg self-start bg-gray-300">
                        <Icon className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="text-title text-contrast-medium mb-1">{doc.title}</h3>
                        <p className="text-description text-contrast-low mb-3">{doc.description}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={isGenerating}
                          onClick={(e) => doc.stage && handleGenerateClick(doc.stage, e)}
                          data-testid={`button-generate-${doc.id}`}
                        >
                          {isCurrentlyGenerating ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {generatedDocs.length === 0 && pendingDocs.length === 0 && (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-description text-contrast-medium">
              No documents available. Click "Continue Building" to complete your survey first.
            </p>
          </div>
        )}
      </main>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate {selectedStage?.title}</DialogTitle>
            <DialogDescription>
              Choose the level of detail for this document.
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
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} className="btn-primary">
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
