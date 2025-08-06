import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Settings, User } from "lucide-react";
import NewProjectForm from "@/components/new-project-form";
import ContextFlow from "@/components/context-flow";
import StageCard from "@/components/stage-card";
import type { Project, Stage } from "@shared/schema";

export default function Dashboard() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

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
              <p className="text-small text-contrast-medium mt-1">
                Guided 5-stage workflow for systematic product development
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => alert('Settings panel coming soon!')}
                className="text-contrast-medium hover:text-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={() => alert('User profile coming soon!')}
                className="text-contrast-medium hover:text-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                data-testid="button-user"
              >
                <User className="w-5 h-5" />
              </button>
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

        {/* Project Stages Dashboard */}
        {currentProject && (
          <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-h3 font-medium text-contrast-high">Project Stages</h2>
                
                {projects.length > 1 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-small text-contrast-medium">Current Project:</span>
                    <select
                      value={currentProjectId || ""}
                      onChange={(e) => setCurrentProjectId(e.target.value)}
                      className="text-small font-medium text-contrast-high bg-transparent border-none"
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

                  {/* Quick Actions Card */}
                  <div className="bg-surface-primary rounded-lg shadow-sm p-6 border border-gray-200 border-dashed">
                    <h3 className="text-body font-medium text-contrast-medium text-center mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button className="w-full text-left text-small text-contrast-medium hover:text-accent p-2 rounded hover:bg-surface-secondary transition-colors">
                        Export All Outputs
                      </button>
                      <button className="w-full text-left text-small text-contrast-medium hover:text-accent p-2 rounded hover:bg-surface-secondary transition-colors">
                        Generate Summary
                      </button>
                      <button className="w-full text-left text-small text-contrast-medium hover:text-accent p-2 rounded hover:bg-surface-secondary transition-colors">
                        Reset Progress
                      </button>
                    </div>
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