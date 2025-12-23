import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Smartphone, Monitor, FileText, HelpCircle, Check, Users, Building2, ShoppingCart, Wrench, Gamepad2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ProjectType = "mobile-app" | "web-app" | "web-page" | "not-sure";
type ProjectPurpose = "consumer" | "business" | "ecommerce" | "internal" | "creative" | "educational" | null;

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

const PROJECT_PURPOSES = [
  {
    id: "consumer" as const,
    title: "Consumer / Social",
    description: "For everyday people. Social features, entertainment, lifestyle, or personal productivity.",
    icon: Users,
  },
  {
    id: "business" as const,
    title: "Business / Professional",
    description: "For companies or professionals. B2B tools, SaaS platforms, or professional services.",
    icon: Building2,
  },
  {
    id: "ecommerce" as const,
    title: "E-commerce / Marketplace",
    description: "Selling products or services. Online stores, booking systems, or multi-vendor platforms.",
    icon: ShoppingCart,
  },
  {
    id: "internal" as const,
    title: "Internal / Operations",
    description: "For internal use. Employee tools, admin dashboards, or workflow automation.",
    icon: Wrench,
  },
  {
    id: "creative" as const,
    title: "Creative / Entertainment",
    description: "Games, media, art, or interactive experiences. Focus on engagement and creativity.",
    icon: Gamepad2,
  },
  {
    id: "educational" as const,
    title: "Educational / Informational",
    description: "Learning platforms, courses, documentation, or knowledge bases.",
    icon: BookOpen,
  },
];

export default function StartPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<ProjectPurpose>(null);
  const [description, setDescription] = useState("");
  const [, setLocation] = useLocation();

  const handleConfirmType = () => {
    if (selectedType) {
      setStep(2);
    }
  };

  const handleConfirmPurpose = () => {
    if (selectedPurpose) {
      setStep(3);
    }
  };

  const handleContinue = () => {
    if (description.trim() && selectedType) {
      sessionStorage.setItem("productIdea", description);
      sessionStorage.setItem("projectType", selectedType);
      sessionStorage.setItem("projectPurpose", selectedPurpose || "");
      sessionStorage.setItem("workflowMode", "survey");
      setLocation("/session/survey");
    }
  };

  if (step === 1) {
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
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`bg-surface-primary rounded-lg border-2 p-6 hover:border-accent hover:shadow-lg transition-all text-left group ${
                    isSelected ? "border-accent ring-2 ring-accent/20" : "border-gray-200"
                  }`}
                  data-testid={`button-select-${type.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg transition-colors ${
                      isSelected ? "bg-accent text-surface-primary" : "bg-surface-secondary group-hover:bg-accent group-hover:text-surface-primary"
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-title font-medium text-contrast-high">
                          {type.title}
                        </h3>
                        {isSelected && <Check className="w-5 h-5 text-accent" />}
                      </div>
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

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setLocation("/projects")}
              className="text-description text-accent hover:underline"
              data-testid="link-view-existing-projects"
            >
              View existing projects →
            </button>
            <Button
              onClick={handleConfirmType}
              disabled={!selectedType}
              className="btn-primary min-h-[44px] px-8"
              data-testid="button-confirm-type"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const selectedTypeInfo = PROJECT_TYPES.find(t => t.id === selectedType);
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-accent/10 rounded-lg">
                {selectedTypeInfo && <selectedTypeInfo.icon className="w-5 h-5 text-accent" />}
              </div>
              <span className="text-description font-medium text-contrast-high">
                {selectedTypeInfo?.title}
              </span>
              <Check className="w-4 h-4 text-green-500" />
            </div>
            <h1 className="text-h2 font-medium text-contrast-high mb-3">
              What's the purpose?
            </h1>
            <p className="text-body text-contrast-medium">
              This helps me ask the right questions and suggest relevant features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROJECT_PURPOSES.map((purpose) => {
              const Icon = purpose.icon;
              const isSelected = selectedPurpose === purpose.id;
              return (
                <button
                  key={purpose.id}
                  onClick={() => setSelectedPurpose(purpose.id)}
                  className={`bg-surface-primary rounded-lg border-2 p-5 hover:border-accent hover:shadow-lg transition-all text-left group ${
                    isSelected ? "border-accent ring-2 ring-accent/20" : "border-gray-200"
                  }`}
                  data-testid={`button-select-purpose-${purpose.id}`}
                >
                  <div className={`p-2 rounded-lg w-fit mb-3 transition-colors ${
                    isSelected ? "bg-accent text-surface-primary" : "bg-surface-secondary group-hover:bg-accent group-hover:text-surface-primary"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-title font-medium text-contrast-high">
                      {purpose.title}
                    </h3>
                    {isSelected && <Check className="w-4 h-4 text-accent" />}
                  </div>
                  <p className="text-description text-contrast-medium">
                    {purpose.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-8">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              data-testid="button-back-to-type"
            >
              ← Back
            </Button>
            <Button
              onClick={handleConfirmPurpose}
              disabled={!selectedPurpose}
              className="btn-primary min-h-[44px] px-8"
              data-testid="button-confirm-purpose"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const selectedTypeInfo = PROJECT_TYPES.find(t => t.id === selectedType);
  const selectedPurposeInfo = PROJECT_PURPOSES.find(p => p.id === selectedPurpose);

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-accent rounded-full mb-4">
            <Sparkles className="w-10 h-10 text-surface-primary" />
          </div>
          <h1 className="text-h1 font-medium text-contrast-high mb-3">
            Describe your idea
          </h1>
          <p className="text-body text-contrast-medium">
            Tell me about what you want to build. I'll ask follow-up questions to create comprehensive documentation.
          </p>
        </div>

        <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-surface-secondary rounded-full px-3 py-1.5">
              {selectedTypeInfo && <selectedTypeInfo.icon className="w-4 h-4 text-accent" />}
              <span className="text-metadata font-medium text-contrast-high">
                {selectedTypeInfo?.title}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-surface-secondary rounded-full px-3 py-1.5">
              {selectedPurposeInfo && <selectedPurposeInfo.icon className="w-4 h-4 text-accent" />}
              <span className="text-metadata font-medium text-contrast-high">
                {selectedPurposeInfo?.title}
              </span>
            </div>
            <button
              onClick={() => setStep(1)}
              className="ml-auto text-metadata text-accent hover:underline"
              data-testid="button-change-selections"
            >
              Change
            </button>
          </div>

          <Textarea
            placeholder={
              selectedType === "mobile-app"
                ? "Example: I want to build a fitness app that tracks workouts, shows progress charts, and sends daily reminders..."
                : selectedType === "web-app"
                ? "Example: I want to build a project management tool where teams can create tasks, set deadlines, and collaborate..."
                : selectedType === "web-page"
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
