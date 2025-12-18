import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, MessageCircle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function StartPage() {
  const [description, setDescription] = useState("");
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [, setLocation] = useLocation();

  const handleContinue = () => {
    if (description.trim()) {
      setShowModeSelection(true);
    }
  };

  const handleModeSelection = async (mode: "interview" | "survey") => {
    // Create a session in local storage to hold the idea temporarily
    sessionStorage.setItem("productIdea", description);
    sessionStorage.setItem("workflowMode", mode);
    
    if (mode === "interview") {
      setLocation("/session/interview");
    } else {
      setLocation("/session/survey");
    }
  };

  if (showModeSelection) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-h2 font-medium text-contrast-high mb-2">Choose Your Workflow</h1>
            <p className="text-description text-contrast-medium">
              How would you like to build your product documentation?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => handleModeSelection("interview")}
              className="bg-surface-primary rounded-lg border-2 border-gray-200 p-8 hover:border-accent hover:shadow-lg transition-all text-left group"
              data-testid="button-select-interview-mode"
            >
              <div className="p-3 bg-accent rounded-lg w-fit mb-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-8 h-8 text-surface-primary" />
              </div>
              <h3 className="text-h4 font-medium text-contrast-high mb-2">Interview Mode</h3>
              <p className="text-description text-contrast-medium mb-4">
                Have a conversational Q&A session. I'll ask you questions to understand your product deeply before generating complete documentation.
              </p>
              <div className="flex items-center text-accent">
                <span className="text-description font-medium">Start Interview</span>
                <span className="ml-2">→</span>
              </div>
            </button>

            <button
              onClick={() => handleModeSelection("survey")}
              className="bg-surface-primary rounded-lg border-2 border-gray-200 p-8 hover:border-accent hover:shadow-lg transition-all text-left group"
              data-testid="button-select-survey-mode"
            >
              <div className="p-3 bg-surface-secondary rounded-lg w-fit mb-4 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-8 h-8 text-contrast-high" />
              </div>
              <h3 className="text-h4 font-medium text-contrast-high mb-2">Survey Mode</h3>
              <p className="text-description text-contrast-medium mb-4">
                Quick discovery chat then a dynamic survey with sliders and selects. Efficient way to capture detailed requirements.
              </p>
              <div className="flex items-center text-accent">
                <span className="text-description font-medium">Start Survey</span>
                <span className="ml-2">→</span>
              </div>
            </button>
          </div>

          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={() => setShowModeSelection(false)}
              data-testid="button-back-to-description"
            >
              ← Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-accent rounded-full mb-4">
            <Sparkles className="w-10 h-10 text-surface-primary" />
          </div>
          <h1 className="text-h1 font-medium text-contrast-high mb-3">
            What do you want to build?
          </h1>
          <p className="text-body text-contrast-medium">
            Describe your product idea in a few sentences. I'll help you create comprehensive documentation.
          </p>
        </div>

        <div className="bg-surface-primary rounded-lg border border-gray-200 p-8 shadow-lg">
          <Textarea
            placeholder="Example: I want to build a mobile app that helps people track their daily water intake and sends reminders throughout the day..."
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
