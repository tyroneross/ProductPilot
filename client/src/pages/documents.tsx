import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, FileText, Code, Layout, ListTodo, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project, Stage } from "@shared/schema";

export default function DocumentsPage() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

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

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="border-b border-gray-200 bg-surface-primary px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="min-h-[44px] min-w-[44px]"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-h3 font-medium text-contrast-high">{project.name}</h1>
              <p className="text-description text-contrast-medium">Product documentation and iteration</p>
            </div>
          </div>
          <Button
            onClick={() => setLocation(`/interview/${project.id}`)}
            className="btn-primary min-h-[44px]"
            data-testid="button-continue-interview"
          >
            Continue Building
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-title text-contrast-high mb-2">Your Documents</h2>
          <p className="text-description text-contrast-medium">
            View and iterate on your product documentation. Click any document to refine it.
          </p>
        </div>

        {/* Only show documents that have been built (progress > 0) */}
        {documents.filter(doc => doc.stage && doc.stage.progress > 0).length === 0 ? (
          <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-description text-contrast-medium">
              No documents have been generated yet. Click "Continue Building" to start creating your product documentation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.filter(doc => doc.stage && doc.stage.progress > 0).map((doc) => {
              const Icon = doc.icon;

              return (
                <div
                  key={doc.id}
                  className="bg-surface-primary rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => doc.stage && setLocation(`/stage/${doc.stage.id}`)}
                  data-testid={`document-${doc.id}`}
                >
                  <div className="flex flex-col space-y-3">
                    <div className="p-3 rounded-lg self-start bg-accent">
                      <Icon className="w-6 h-6 text-surface-primary" />
                    </div>
                    <div>
                      <h3 className="text-title text-contrast-high mb-1">{doc.title}</h3>
                      <p className="text-description text-contrast-medium mb-3">{doc.description}</p>
                      {doc.stage && (
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 bg-surface-secondary rounded-full h-2">
                            <div
                              className="bg-accent h-2 rounded-full transition-all duration-300"
                              style={{ width: `${doc.stage.progress}%` }}
                            />
                          </div>
                          <span className="text-metadata text-contrast-medium">
                            {doc.stage.progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 bg-surface-primary rounded-lg border border-gray-200 p-6">
          <h3 className="text-title text-contrast-high mb-2">Want a different approach?</h3>
          <p className="text-description text-contrast-medium mb-4">
            You can also work through each stage step-by-step for a more structured workflow.
          </p>
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            className="min-h-[44px]"
            data-testid="button-view-stages"
          >
            View All Stages
          </Button>
        </div>
      </main>
    </div>
  );
}
