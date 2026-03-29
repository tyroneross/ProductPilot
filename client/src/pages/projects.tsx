import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Plus, FileText, Sparkles } from "lucide-react";
import ContextFlow from "@/components/context-flow";
import StageCard from "@/components/stage-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project, Stage } from "@shared/schema";

export default function Dashboard() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<Stage[]>({
    queryKey: ["/api/projects", currentProjectId, "stages"],
    enabled: !!currentProjectId,
  });

  const currentProject = currentProjectId ? 
    projects.find((p) => p.id === currentProjectId) : 
    projects[0];

  useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setCurrentProjectId(projects[0].id);
    }
  }, [currentProjectId, projects]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-[rgba(200,180,160,0.08)] bg-surface-primary">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-h2 font-medium text-contrast-high line-clamp-1">Product Development Assistant</h1>
              <p className="text-description text-contrast-medium mt-1 hidden sm:block">
                Guided workflow for systematic product development
              </p>
            </div>
            <Button
              onClick={() => setLocation("/")}
              className="btn-primary min-h-[44px] shrink-0"
              data-testid="button-new-project"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Product</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {projectsLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        )}

        {currentProject && (
          <div className="mb-6">
            <ContextFlow stages={stages} />
          </div>
        )}

        {currentProject && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h3 font-medium text-contrast-high">Your Products</h2>
              
              {projects.length > 1 && (
                <div className="flex items-center space-x-2">
                  <span className="text-description text-contrast-medium">Viewing:</span>
                  <select
                    value={currentProjectId || ""}
                    onChange={(e) => setCurrentProjectId(e.target.value)}
                    className="text-description font-medium text-contrast-high bg-transparent border-none max-w-[200px] truncate"
                    data-testid="select-current-project"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="bg-surface-primary rounded-lg border border-[rgba(200,180,160,0.08)] p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/documents/${currentProject.id}`)}
                data-testid="card-view-documents"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-accent rounded-lg">
                    <FileText className="w-6 h-6 text-surface-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-metadata text-contrast-medium mb-1 line-clamp-1">{currentProject.name}</p>
                    <h3 className="text-title text-contrast-high mb-1 line-clamp-1">View Generated Documents</h3>
                    <p className="text-description text-contrast-medium mb-3 line-clamp-2">
                      See PRD, architecture, and all specs created for this project
                    </p>
                    <div className="flex items-center space-x-2 text-accent">
                      <span className="text-description font-medium">Open Documents</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="bg-surface-primary rounded-lg border border-[rgba(200,180,160,0.08)] p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/session/survey?projectId=${currentProject.id}`)}
                data-testid="card-continue-building"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <MessageCircle className="w-6 h-6 text-contrast-high" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-metadata text-contrast-medium mb-1 line-clamp-1">{currentProject.name}</p>
                    <h3 className="text-title text-contrast-high mb-1 line-clamp-1">Continue Survey Mode</h3>
                    <p className="text-description text-contrast-medium mb-3 line-clamp-2">
                      Answer AI questions to refine and generate your product specs
                    </p>
                    <div className="flex items-center space-x-2 text-accent">
                      <span className="text-description font-medium">Resume Q&A</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!stagesLoading && stages.length > 0 && (
              <div className="mt-8">
                <h3 className="text-title text-contrast-high mb-4">Or work stage-by-stage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stages.map((stage) => (
                    <StageCard key={stage.id} stage={stage} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {!currentProject && !projectsLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(240,182,94,0.1)] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#f0b65e]" />
            </div>
            <h3 className="text-h4 font-medium text-contrast-high">No projects yet</h3>
            <p className="text-description text-contrast-medium text-center max-w-sm">
              Describe what you want to build and get a complete PRD, wireframes, architecture docs, and coding prompts.
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="btn-primary min-h-[44px] px-8"
              data-testid="button-start-first-project"
            >
              Start building
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
