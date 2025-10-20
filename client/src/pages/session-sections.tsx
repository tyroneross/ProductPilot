import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import StageCard from "@/components/stage-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, Stage } from "@shared/schema";

export default function SessionSectionsPage() {
  const [, setLocation] = useLocation();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const draftRequested = useRef(false);

  const productIdea = sessionStorage.getItem("productIdea") || "";

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      // Create project or update existing
      if (projectId) {
        // Update existing project name
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
          name,
        });
        return res.json();
      } else {
        // Create new project
        const res = await apiRequest("POST", "/api/projects", {
          name: name || `Untitled Project ${new Date().toLocaleDateString()}`,
          description: productIdea.slice(0, 200),
          mode: "stage-based",
          aiModel: "claude-sonnet",
        });
        return res.json();
      }
    },
    onSuccess: (updatedProject: Project) => {
      setProjectId(updatedProject.id);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", updatedProject.id] });
      setShowSaveDialog(false);
      toast({
        title: projectId ? "Project updated!" : "Project saved!",
        description: `"${updatedProject.name}" has been saved successfully.`,
      });
      sessionStorage.setItem("sectionsProjectId", updatedProject.id);
    },
    onError: () => {
      toast({
        title: "Failed to save project",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-create temporary project on mount to get stages
  useEffect(() => {
    // Always create a new draft project for Section Mode (don't reuse saved projects)
    // Guard against duplicate creation on re-renders
    if (!projectId && productIdea && !draftRequested.current) {
      draftRequested.current = true;
      createProjectMutation.mutate(`Working Draft - ${new Date().toLocaleTimeString()}`);
    }
  }, []);

  const handleSave = () => {
    setShowSaveDialog(true);
    if (project) {
      setProjectName(project.name);
    }
  };

  const handleSaveWithName = () => {
    if (projectName.trim()) {
      createProjectMutation.mutate(projectName);
    }
  };

  const completedStages = stages.filter((s: Stage) => s.progress >= 90).length;
  const totalStages = stages.length;

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-gray-200 bg-surface-primary px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="min-h-[44px] min-w-[44px]"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-h3 font-medium text-contrast-high">Section-by-Section Mode</h1>
              <p className="text-description text-contrast-medium">
                Work through each section individually. Skip what you don't need.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            className="min-h-[44px]"
            data-testid="button-save-project"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Project
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-h4 font-medium text-contrast-high mb-2">Your Product Idea</h2>
              <p className="text-body text-contrast-medium">{productIdea}</p>
            </div>
            <div className="flex items-center space-x-2 text-accent">
              <Check className="w-5 h-5" />
              <span className="text-description font-medium">{completedStages}/{totalStages} Complete</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-title text-contrast-high mb-4">
            Choose sections to work on (or skip what you don't need)
          </h3>
          <p className="text-description text-contrast-medium mb-6">
            Each section defaults to a chat interface where you can discuss and refine your ideas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage: Stage) => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </div>
      </main>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Your Project</DialogTitle>
            <DialogDescription>
              Give your project a name so you can continue working on it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              data-testid="input-save-project-name"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveWithName} disabled={!projectName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
