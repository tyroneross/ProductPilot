import { useState } from "react";
import { useLocation } from "wouter";
import { 
  Sparkles, Smartphone, Monitor, Globe, Server, Check,
  FlaskConical, Wrench, Users, Rocket,
  Database, Eye, Search, Cog, Brain,
  Zap, Code, Palette, GitBranch,
  Clock, Calendar, Infinity
} from "lucide-react";
import { Button } from "@/components/ui/button";

type IntakeAnswers = {
  buildingType: string | null;
  targetAudience: string | null;
  platform: string | null;
  coreBehavior: string | null;
  aiUsage: string | null;
  productionReady: string | null;
  timeline: string | null;
  priority: string | null;
};

const GROUPS = [
  { id: 1, title: "Intent", subtitle: "What & Why" },
  { id: 2, title: "Shape", subtitle: "Where & What" },
  { id: 3, title: "Intelligence", subtitle: "AI Use" },
  { id: 4, title: "Quality", subtitle: "How Good" },
  { id: 5, title: "Priority", subtitle: "Trade-off" },
];

const Q1_OPTIONS = [
  { id: "prototype", label: "A quick prototype or demo", icon: FlaskConical, inference: "Fast iteration, minimal polish" },
  { id: "internal", label: "An internal tool", icon: Wrench, inference: "Functional focus, trusted users" },
  { id: "product", label: "A real product for users", icon: Users, inference: "Production quality, user-facing" },
  { id: "scale", label: "A polished product I want to scale", icon: Rocket, inference: "Enterprise-grade, extensible" },
];

const Q2_OPTIONS = [
  { id: "me", label: "Just me", icon: Users, inference: "Minimal onboarding, personal preferences" },
  { id: "team", label: "A small team", icon: Users, inference: "Basic permissions, collaboration" },
  { id: "consumers", label: "Everyday users (non-technical)", icon: Users, inference: "Simple UX, error tolerance" },
  { id: "developers", label: "Developers / technical users", icon: Code, inference: "Power features, documentation" },
];

const Q3_OPTIONS = [
  { id: "desktop", label: "Website (desktop-first)", icon: Monitor, inference: "Wide layouts, keyboard navigation" },
  { id: "mobile-web", label: "Website (mobile-first)", icon: Globe, inference: "Touch-first, responsive" },
  { id: "mobile-app", label: "Mobile app (iOS / Android)", icon: Smartphone, inference: "Native features, app store" },
  { id: "backend", label: "Backend / API only", icon: Server, inference: "No UI, API-first" },
];

const Q4_OPTIONS = [
  { id: "data", label: "Collect and manage data", icon: Database, inference: "Forms, CRUD, storage" },
  { id: "content", label: "Display content or information", icon: Eye, inference: "Read-focused, static or CMS" },
  { id: "search", label: "Help users search or discover things", icon: Search, inference: "Search, filters, recommendations" },
  { id: "automate", label: "Automate tasks or workflows", icon: Cog, inference: "Background jobs, integrations" },
  { id: "ai-assist", label: "Help users think, write, or decide (AI-assisted)", icon: Brain, inference: "AI-powered features" },
];

const Q5_OPTIONS = [
  { id: "none", label: "No AI", icon: Cog, inference: "Traditional logic only" },
  { id: "assist", label: "AI helps users (suggestions, summaries)", icon: Brain, inference: "Human in the loop" },
  { id: "generate", label: "AI generates results users rely on", icon: Sparkles, inference: "AI-primary outputs" },
  { id: "automate", label: "AI runs tasks automatically", icon: Zap, inference: "Autonomous AI agents" },
];

const Q6_OPTIONS = [
  { id: "rough", label: "Rough but fast", icon: Zap, inference: "Speed over polish" },
  { id: "clean", label: "Clean and understandable", icon: Code, inference: "Balanced quality" },
  { id: "extensible", label: "Very clean and extensible", icon: GitBranch, inference: "Architecture first" },
];

const Q7_OPTIONS = [
  { id: "days", label: "Days", icon: Clock, inference: "Maximum speed" },
  { id: "weeks", label: "Weeks", icon: Calendar, inference: "Reasonable scope" },
  { id: "no-rush", label: "No rush — get it right", icon: Infinity, inference: "Quality focus" },
];

const Q8_OPTIONS = [
  { id: "speed", label: "Speed", icon: Zap, inference: "Ship fast" },
  { id: "clean-code", label: "Clean code", icon: Code, inference: "Maintainable" },
  { id: "polish", label: "Visual polish", icon: Palette, inference: "Pixel perfect" },
  { id: "flexibility", label: "Flexibility later", icon: GitBranch, inference: "Extensible" },
];

export default function StartPage() {
  const [currentGroup, setCurrentGroup] = useState(1);
  const [answers, setAnswers] = useState<IntakeAnswers>({
    buildingType: null,
    targetAudience: null,
    platform: null,
    coreBehavior: null,
    aiUsage: null,
    productionReady: null,
    timeline: null,
    priority: null,
  });
  const [, setLocation] = useLocation();

  const updateAnswer = (key: keyof IntakeAnswers, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const canContinue = () => {
    switch (currentGroup) {
      case 1: return answers.buildingType && answers.targetAudience;
      case 2: return answers.platform && answers.coreBehavior;
      case 3: return answers.aiUsage;
      case 4: return answers.productionReady && answers.timeline;
      case 5: return answers.priority;
      default: return false;
    }
  };

  const handleContinue = () => {
    if (currentGroup < 5) {
      setCurrentGroup(currentGroup + 1);
    } else {
      sessionStorage.setItem("intakeAnswers", JSON.stringify(answers));
      sessionStorage.setItem("projectType", answers.platform || "web-app");
      sessionStorage.setItem("projectPurpose", answers.coreBehavior || "");
      sessionStorage.setItem("productIdea", "");
      sessionStorage.setItem("workflowMode", "survey");
      setLocation("/session/survey");
    }
  };

  const handleBack = () => {
    if (currentGroup > 1) {
      setCurrentGroup(currentGroup - 1);
    }
  };

  const renderOption = (
    option: { id: string; label: string; icon: React.ElementType; inference: string },
    selectedValue: string | null,
    onSelect: (id: string) => void
  ) => {
    const Icon = option.icon;
    const isSelected = selectedValue === option.id;
    return (
      <button
        key={option.id}
        onClick={() => onSelect(option.id)}
        className={`bg-surface-primary rounded-lg border-2 p-4 hover:border-accent hover:shadow-md transition-all text-left group ${
          isSelected ? "border-accent ring-2 ring-accent/20" : "border-gray-200"
        }`}
        data-testid={`option-${option.id}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${
            isSelected ? "bg-accent text-surface-primary" : "bg-surface-secondary group-hover:bg-accent/10"
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-title font-medium text-contrast-high">{option.label}</span>
              {isSelected && <Check className="w-4 h-4 text-accent" />}
            </div>
            <span className="text-metadata text-contrast-low">{option.inference}</span>
          </div>
        </div>
      </button>
    );
  };

  const renderGroup1 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-h4 font-medium text-contrast-high mb-2">What are you building?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Q1_OPTIONS.map(opt => renderOption(opt, answers.buildingType, (id) => updateAnswer("buildingType", id)))}
        </div>
      </div>
      <div>
        <h2 className="text-h4 font-medium text-contrast-high mb-2">Who is it for?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Q2_OPTIONS.map(opt => renderOption(opt, answers.targetAudience, (id) => updateAnswer("targetAudience", id)))}
        </div>
      </div>
    </div>
  );

  const renderGroup2 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-h4 font-medium text-contrast-high mb-2">Where will it be used?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Q3_OPTIONS.map(opt => renderOption(opt, answers.platform, (id) => updateAnswer("platform", id)))}
        </div>
      </div>
      <div>
        <h2 className="text-h4 font-medium text-contrast-high mb-2">What does it mostly do?</h2>
        <div className="grid grid-cols-1 gap-3">
          {Q4_OPTIONS.map(opt => renderOption(opt, answers.coreBehavior, (id) => updateAnswer("coreBehavior", id)))}
        </div>
      </div>
    </div>
  );

  const renderGroup3 = () => (
    <div>
      <h2 className="text-h4 font-medium text-contrast-high mb-2">How will AI be used?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Q5_OPTIONS.map(opt => renderOption(opt, answers.aiUsage, (id) => updateAnswer("aiUsage", id)))}
      </div>
    </div>
  );

  const renderGroup4 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-h4 font-medium text-contrast-high mb-2">How production-ready should this be?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Q6_OPTIONS.map(opt => renderOption(opt, answers.productionReady, (id) => updateAnswer("productionReady", id)))}
        </div>
      </div>
      <div>
        <h2 className="text-h4 font-medium text-contrast-high mb-2">How fast do you want the first version?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Q7_OPTIONS.map(opt => renderOption(opt, answers.timeline, (id) => updateAnswer("timeline", id)))}
        </div>
      </div>
    </div>
  );

  const renderGroup5 = () => (
    <div>
      <h2 className="text-h4 font-medium text-contrast-high mb-2">What matters most right now?</h2>
      <p className="text-description text-contrast-medium mb-4">Choose one. This helps resolve trade-offs.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Q8_OPTIONS.map(opt => renderOption(opt, answers.priority, (id) => updateAnswer("priority", id)))}
      </div>
    </div>
  );

  const renderCurrentGroup = () => {
    switch (currentGroup) {
      case 1: return renderGroup1();
      case 2: return renderGroup2();
      case 3: return renderGroup3();
      case 4: return renderGroup4();
      case 5: return renderGroup5();
      default: return null;
    }
  };

  const currentGroupInfo = GROUPS.find(g => g.id === currentGroup);

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-accent rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-surface-primary" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            {GROUPS.map((group, index) => (
              <div key={group.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    group.id < currentGroup
                      ? "bg-green-500 text-white"
                      : group.id === currentGroup
                      ? "bg-accent text-white"
                      : "bg-gray-200 text-contrast-medium"
                  }`}
                >
                  {group.id < currentGroup ? <Check className="w-4 h-4" /> : group.id}
                </div>
                {index < GROUPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${group.id < currentGroup ? "bg-green-500" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
          <h1 className="text-h2 font-medium text-contrast-high">
            {currentGroupInfo?.title}
          </h1>
          <p className="text-body text-contrast-medium">
            {currentGroupInfo?.subtitle}
          </p>
        </div>

        <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 shadow-lg mb-6">
          {renderCurrentGroup()}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {currentGroup > 1 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                data-testid="button-back"
              >
                ← Back
              </Button>
            )}
            <button
              onClick={() => setLocation("/projects")}
              className="text-description text-accent hover:underline"
              data-testid="link-view-existing-projects"
            >
              View existing projects
            </button>
          </div>
          <Button
            onClick={handleContinue}
            disabled={!canContinue()}
            className="btn-primary min-h-[44px] px-8"
            data-testid="button-continue"
          >
            {currentGroup === 5 ? "Generate Spec" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
