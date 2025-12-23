import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function StartPage() {
  const [description, setDescription] = useState("");
  const [, setLocation] = useLocation();

  const handleContinue = () => {
    if (description.trim()) {
      sessionStorage.setItem("productIdea", description);
      sessionStorage.setItem("workflowMode", "survey");
      setLocation("/session/survey");
    }
  };

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
            Describe your product idea in a few sentences. I'll ask you questions to help create comprehensive documentation.
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
