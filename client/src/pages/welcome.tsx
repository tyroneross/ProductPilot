import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowRight, FileText, Layout, Code, ListTodo, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@shared/schema";

export default function WelcomePage() {
  const [, setLocation] = useLocation();

  const { data: draft, isLoading } = useQuery<Project | null>({
    queryKey: ["/api/user/draft"],
    retry: false,
  });

  const handleContinue = () => {
    if (draft) {
      sessionStorage.setItem("surveyProjectId", draft.id);
      if (draft.intakeAnswers) {
        sessionStorage.setItem("intakeAnswers", JSON.stringify(draft.intakeAnswers));
      }
      if (draft.minimumDetails) {
        sessionStorage.setItem("minimumDetails", JSON.stringify(draft.minimumDetails));
        sessionStorage.setItem("productIdea", (draft.minimumDetails as any).problemStatement || "");
      }
      setLocation("/session/survey");
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <div className="inline-flex items-center justify-center p-4 bg-accent rounded-full mb-6">
            <Sparkles className="w-12 h-12 text-surface-primary" />
          </div>
          
          <h1 className="text-h1 font-medium text-contrast-high mb-4">
            Build better products, faster
          </h1>
          
          <p className="text-body text-contrast-medium mb-8 max-w-lg mx-auto">
            Answer a few quick questions about your idea and get comprehensive specs, 
            architecture docs, and development guides — all tailored to your needs.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => setLocation("/intake")}
              className="btn-primary min-h-[52px] px-10 text-body"
              data-testid="button-get-started"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            {!isLoading && draft && (
              <Button
                onClick={handleContinue}
                variant="outline"
                className="min-h-[52px] px-10 text-body border-accent text-accent hover:bg-accent/10"
                data-testid="button-continue-draft"
              >
                <Play className="w-5 h-5 mr-2" />
                Continue Draft
              </Button>
            )}
          </div>

          {!isLoading && draft && (
            <p className="text-description text-contrast-medium mt-4">
              You have an in-progress project: "{draft.name}"
            </p>
          )}

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-metadata text-contrast-medium mb-6 uppercase tracking-wide">
              What you'll get
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: FileText, label: "Requirements" },
                { icon: ListTodo, label: "Product Spec" },
                { icon: Layout, label: "Architecture" },
                { icon: Code, label: "Dev Guide" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-4 bg-surface-primary rounded-lg border border-gray-200 cursor-default select-none">
                  <Icon className="w-6 h-6 text-accent" />
                  <span className="text-description font-medium text-contrast-high">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => setLocation("/projects")}
              className="text-description text-accent hover:underline"
              data-testid="link-view-existing-projects"
            >
              View existing projects →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
