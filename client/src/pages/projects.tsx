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

        {/* Existing Projects */}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="bg-surface-primary rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/documents/${currentProject.id}`)}
                data-testid="card-view-documents"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-accent rounded-lg">
                    <MessageCircle className="w-6 h-6 text-surface-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-title text-contrast-high mb-1">View Documents</h3>
                    <p className="text-description text-contrast-medium mb-3">
                      See PRD, architecture, and all generated documentation
                    </p>
                    <div className="flex items-center space-x-2 text-accent">
                      <span className="text-description font-medium">View & Iterate</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="bg-surface-primary rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/interview/${currentProject.id}`)}
                data-testid="card-continue-building"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <MessageCircle className="w-6 h-6 text-contrast-high" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-title text-contrast-high mb-1">Continue Building</h3>
                    <p className="text-description text-contrast-medium mb-3">
                      Add more details or refine your product through conversation
                    </p>
                    <div className="flex items-center space-x-2 text-accent">
                      <span className="text-description font-medium">Start Chat</span>
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
          <div className="text-center py-12">
            <h3 className="text-h4 font-medium text-contrast-medium mb-2">Welcome to Product Development Assistant</h3>
            <p className="text-body text-contrast-low mb-6">Create your first project to get started with the guided 5-stage development workflow.</p>
          </div>
        )}
      </main>
    </div>
  );
}