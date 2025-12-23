import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Smartphone, Monitor, FileText, HelpCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ProjectType = "mobile-app" | "web-app" | "web-page" | "not-sure" | null;

const PROJECT_TYPES = [
  {
    id: "mobile-app" as const,
    title: "Mobile App",
    description: "Native or cross-platform app for iOS and Android. Includes app store distribution, push notifications, and device features.",
    icon: Smartphone,
    examples: "Fitness tracker, food delivery, social network",
  },
  {
    id: "web-app" as const,
    title: "Web Application",
    description: "Interactive software that runs in a browser. Features user accounts, data storage, and complex functionality.",
    icon: Monitor,
    examples: "Project management tool, e-commerce platform, dashboard",
  },
  {
    id: "web-page" as const,
    title: "Website / Landing Page",
    description: "Informational or marketing pages. Focuses on content, SEO, and converting visitors.",
    icon: FileText,
    examples: "Company website, portfolio, product landing page",
  },
  {
    id: "not-sure" as const,
    title: "I'm Not Sure",
    description: "Not certain which type fits best? I'll help you figure out the right approach based on your goals.",
    icon: HelpCircle,
    examples: "Let's explore options together",
  },
];

export default function StartPage() {
  const [projectType, setProjectType] = useState<ProjectType>(null);
  const [description, setDescription] = useState("");
  const [, setLocation] = useLocation();

  const handleContinue = () => {
    if (description.trim() && projectType) {
      sessionStorage.setItem("productIdea", description);
      sessionStorage.setItem("projectType", projectType);
      sessionStorage.setItem("workflowMode", "survey");
      setLocation("/session/survey");
    }
  };

  if (!projectType) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-accent rounded-full mb-4">
              <Sparkles className="w-10 h-10 text-surface-primary" />
            </div>
            <h1 className="text-h1 font-medium text-contrast-high mb-3">
              What are you building?
            </h1>
            <p className="text-body text-contrast-medium">
              Select the type of project to get tailored guidance and requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROJECT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setProjectType(type.id)}
                  className="bg-surface-primary rounded-lg border-2 border-gray-200 p-6 hover:border-accent hover:shadow-lg transition-all text-left group"
                  data-testid={`button-select-${type.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-surface-secondary rounded-lg group-hover:bg-accent group-hover:text-surface-primary transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-title font-medium text-contrast-high mb-1">
                        {type.title}
                      </h3>
                      <p className="text-description text-contrast-medium mb-2">
                        {type.description}
                      </p>
                      <p className="text-metadata text-contrast-low">
                        {type.examples}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-center mt-6">
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
    );
  }

  const selectedType = PROJECT_TYPES.find(t => t.id === projectType);

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-accent rounded-full mb-4">
            <Sparkles className="w-10 h-10 text-surface-primary" />
          </div>
          <h1 className="text-h1 font-medium text-contrast-high mb-3">
            Describe your {selectedType?.title.toLowerCase()}
          </h1>
          <p className="text-body text-contrast-medium">
            Tell me about your idea. I'll ask follow-up questions to help create comprehensive documentation.
          </p>
        </div>

        <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 shadow-lg">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
            <div className="p-2 bg-accent/10 rounded-lg">
              {selectedType && <selectedType.icon className="w-5 h-5 text-accent" />}
            </div>
            <span className="text-description font-medium text-contrast-high">
              {selectedType?.title}
            </span>
            <Check className="w-4 h-4 text-green-500" />
            <button
              onClick={() => setProjectType(null)}
              className="ml-auto text-metadata text-accent hover:underline"
              data-testid="button-change-project-type"
            >
              Change
            </button>
          </div>

          <Textarea
            placeholder={
              projectType === "mobile-app"
                ? "Example: I want to build a fitness app that tracks workouts, shows progress charts, and sends daily reminders..."
                : projectType === "web-app"
                ? "Example: I want to build a project management tool where teams can create tasks, set deadlines, and collaborate..."
                : projectType === "web-page"
                ? "Example: I need a landing page for my SaaS product that explains features, shows pricing, and captures leads..."
                : "Example: I have an idea for helping people track their habits, but I'm not sure if it should be an app or website..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[200px] text-body resize-none mb-4"
            data-testid="textarea-product-description"
          />
          
          <div className="flex items-center justify-between">
            <p className="text-small text-contrast-medium">
              {description.length > 0 ? `${description.length} characters` : "Start typing your idea..."}
            </p>
            <Button
              onClick={handleContinue}
              disabled={!description.trim()}
              className="btn-primary min-h-[44px] px-8"
              data-testid="button-continue-to-workflow"
            >
              Continue
            </Button>
          </div>
        </div>

        <div className="text-center mt-6">
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
  );
}
