import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import NewProjectForm from "@/components/new-project-form";
import ContextFlow from "@/components/context-flow";
import StageCard from "@/components/stage-card";
import { Button } from "@/components/ui/button";
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

  // Auto-select first project if none selected
  const currentProject = currentProjectId ? 
    projects.find((p) => p.id === currentProjectId) : 
    projects[0];

  if (!currentProjectId && projects.length > 0) {
    setCurrentProjectId(projects[0].id);
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-gray-200 bg-surface-primary">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h2 font-medium text-contrast-high">Product Development Assistant</h1>
              <p className="text-description text-contrast-medium mt-1">
                Guided 5-stage workflow for systematic product development
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Top Priority: New Project and Context Flow */}
        <div className="mb-6">
          <NewProjectForm onProjectCreated={(project) => setCurrentProjectId(project.id)} />
        </div>
        
        {currentProject && (
          <div className="mb-6">
            <ContextFlow stages={stages} />
          </div>
        )}

        {/* Project Content */}
        {currentProject && (
          <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-h3 font-medium text-contrast-high">
                  {currentProject.mode === "interview" ? "Interview Mode" : "Project Stages"}
                </h2>
                
                {projects.length > 1 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-description text-contrast-medium">Current Project:</span>
                    <select
                      value={currentProjectId || ""}
                      onChange={(e) => setCurrentProjectId(e.target.value)}
                      className="text-description font-medium text-contrast-high bg-transparent border-none"
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
              
              {currentProject.mode === "interview" ? (
                <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 text-center">
                  <div className="max-w-2xl mx-auto">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="w-8 h-8 text-surface-primary" />
                    </div>
                    <h3 className="text-title text-contrast-high mb-2">
                      PRD Interview Mode
                    </h3>
                    <p className="text-description text-contrast-medium mb-6 leading-relaxed">
                      Answer structured questions to build a comprehensive Product Requirements Document. 
                      The AI will guide you through gathering all necessary information for your PRD.
                    </p>
                    <Button
                      onClick={() => setLocation(`/interview/${currentProject.id}`)}
                      className="btn-primary min-h-[44px] px-8"
                      data-testid="button-start-interview"
                    >
                      Start Interview
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {stagesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-surface-primary rounded-lg p-6 animate-pulse">
                          <div className="h-4 bg-gray-300 rounded mb-3"></div>
                          <div className="h-3 bg-gray-200 rounded mb-4"></div>
                          <div className="flex justify-between items-center">
                            <div className="h-3 bg-gray-200 rounded w-16"></div>
                            <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {stages.map((stage) => (
                        <StageCard key={stage.id} stage={stage} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
        )}

        {!currentProject && !projectsLoading && projects.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-h4 font-medium text-contrast-medium mb-2">Welcome to Product Development Assistant</h3>
            <p className="text-body text-contrast-low mb-6">Create your first project to get started with the guided 5-stage development workflow.</p>
          </div>
        )}
      </main>
    </div>
  );
}