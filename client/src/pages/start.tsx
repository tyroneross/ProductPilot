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
import { Progress } from "@/components/ui/progress";

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

const QUESTIONS = [
  {
    id: "buildingType",
    group: "Intent",
    question: "What are you building?",
    options: [
      { id: "prototype", label: "Quick prototype or demo", icon: FlaskConical },
      { id: "internal", label: "Internal tool", icon: Wrench },
      { id: "product", label: "Real product for users", icon: Users },
      { id: "scale", label: "Polished product to scale", icon: Rocket },
    ],
  },
  {
    id: "targetAudience",
    group: "Intent",
    question: "Who is it for?",
    options: [
      { id: "me", label: "Just me", icon: Users },
      { id: "team", label: "A small team", icon: Users },
      { id: "consumers", label: "Everyday users", icon: Users },
      { id: "developers", label: "Developers", icon: Code },
    ],
  },
  {
    id: "platform",
    group: "Shape",
    question: "Where will it be used?",
    options: [
      { id: "desktop", label: "Website (desktop-first)", icon: Monitor },
      { id: "mobile-web", label: "Website (mobile-first)", icon: Globe },
      { id: "mobile-app", label: "Mobile app", icon: Smartphone },
      { id: "backend", label: "Backend / API only", icon: Server },
    ],
  },
  {
    id: "coreBehavior",
    group: "Shape",
    question: "What does it mostly do?",
    options: [
      { id: "data", label: "Collect and manage data", icon: Database },
      { id: "content", label: "Display content", icon: Eye },
      { id: "search", label: "Search or discover", icon: Search },
      { id: "automate", label: "Automate tasks", icon: Cog },
      { id: "ai-assist", label: "AI-assisted work", icon: Brain },
    ],
  },
  {
    id: "aiUsage",
    group: "Intelligence",
    question: "How will AI be used?",
    options: [
      { id: "none", label: "No AI", icon: Cog },
      { id: "assist", label: "AI helps users", icon: Brain },
      { id: "generate", label: "AI generates results", icon: Sparkles },
      { id: "automate", label: "AI runs automatically", icon: Zap },
    ],
  },
  {
    id: "productionReady",
    group: "Quality",
    question: "How production-ready?",
    options: [
      { id: "rough", label: "Rough but fast", icon: Zap },
      { id: "clean", label: "Clean and understandable", icon: Code },
      { id: "extensible", label: "Very clean and extensible", icon: GitBranch },
    ],
  },
  {
    id: "timeline",
    group: "Quality",
    question: "How fast for v1?",
    options: [
      { id: "days", label: "Days", icon: Clock },
      { id: "weeks", label: "Weeks", icon: Calendar },
      { id: "no-rush", label: "No rush", icon: Infinity },
    ],
  },
  {
    id: "priority",
    group: "Priority",
    question: "What matters most?",
    options: [
      { id: "speed", label: "Speed", icon: Zap },
      { id: "clean-code", label: "Clean code", icon: Code },
      { id: "polish", label: "Visual polish", icon: Palette },
      { id: "flexibility", label: "Flexibility", icon: GitBranch },
    ],
  },
];

export default function IntakePage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
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

  const question = QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;
  const currentAnswer = answers[question.id as keyof IntakeAnswers];

  const handleSelect = (optionId: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: optionId }));
  };

  const handleContinue = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      sessionStorage.setItem("intakeAnswers", JSON.stringify(answers));
      sessionStorage.setItem("projectType", answers.platform || "web-app");
      sessionStorage.setItem("projectPurpose", answers.coreBehavior || "");
      sessionStorage.setItem("workflowMode", "survey");
      setLocation("/details");
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    } else {
      setLocation("/");
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      <div className="w-full max-w-2xl mx-auto px-6 pt-6">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-2 text-metadata text-contrast-medium">
          <span>{question.group}</span>
          <span>{currentQuestion + 1} of {QUESTIONS.length}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <h1 className="text-h2 font-medium text-contrast-high text-center mb-8">
            {question.question}
          </h1>

          <div className="space-y-3">
            {question.options.map((option) => {
              const Icon = option.icon;
              const isSelected = currentAnswer === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected 
                      ? "border-accent bg-accent/5" 
                      : "border-gray-200 bg-surface-primary hover:border-accent/50"
                  }`}
                  data-testid={`option-${option.id}`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? "bg-accent text-white" : "bg-surface-secondary"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-body font-medium text-contrast-high flex-1">
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-5 h-5 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-6 pb-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            data-testid="button-back"
          >
            ← Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!currentAnswer}
            className="btn-primary min-h-[44px] px-8"
            data-testid="button-continue"
          >
            {currentQuestion === QUESTIONS.length - 1 ? "Continue" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
