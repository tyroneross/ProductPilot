import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Plus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

type MinimumDetails = {
  problemStatement: string;
  userGoals: string[];
  mainObjects: string[];
  mainActions: string[];
  inspirationLink: string;
  v1Definition: string;
  mustUseTools: string;
  mustAvoidTools: string;
};

export default function DetailsPage() {
  const [, setLocation] = useLocation();
  const [details, setDetails] = useState<MinimumDetails>({
    problemStatement: "",
    userGoals: ["", "", ""],
    mainObjects: [""],
    mainActions: [""],
    inspirationLink: "",
    v1Definition: "",
    mustUseTools: "",
    mustAvoidTools: "",
  });

  const updateField = (field: keyof MinimumDetails, value: string | string[]) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const updateArrayItem = (field: "userGoals" | "mainObjects" | "mainActions", index: number, value: string) => {
    const newArray = [...details[field]];
    newArray[index] = value;
    updateField(field, newArray);
  };

  const addArrayItem = (field: "mainObjects" | "mainActions") => {
    updateField(field, [...details[field], ""]);
  };

  const removeArrayItem = (field: "mainObjects" | "mainActions", index: number) => {
    if (details[field].length > 1) {
      updateField(field, details[field].filter((_, i) => i !== index));
    }
  };

  const canContinue = details.problemStatement.trim() && 
    details.userGoals.some(g => g.trim()) && 
    details.v1Definition.trim();

  const handleContinue = () => {
    const cleanedDetails = {
      ...details,
      userGoals: details.userGoals.filter(g => g.trim()),
      mainObjects: details.mainObjects.filter(o => o.trim()),
      mainActions: details.mainActions.filter(a => a.trim()),
    };
    sessionStorage.setItem("minimumDetails", JSON.stringify(cleanedDetails));
    sessionStorage.setItem("productIdea", details.problemStatement);
    setLocation("/session/survey");
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="w-full max-w-2xl mx-auto px-6 pt-6">
        <Progress value={100} className="h-2" />
        <div className="flex justify-between mt-2 text-metadata text-contrast-medium">
          <span>Details</span>
          <span>Final step</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-accent rounded-full mb-4">
            <Sparkles className="w-6 h-6 text-surface-primary" />
          </div>
          <h1 className="text-h3 font-medium text-contrast-high mb-2">
            A few more details
          </h1>
          <p className="text-description text-contrast-medium">
            This helps generate better specs and documentation
          </p>
        </div>

        <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <Label className="text-title font-medium text-contrast-high mb-2 block">
              Problem statement <span className="text-red-500">*</span>
            </Label>
            <p className="text-metadata text-contrast-medium mb-2">
              "Users need to ___ because ___."
            </p>
            <Textarea
              value={details.problemStatement}
              onChange={(e) => updateField("problemStatement", e.target.value)}
              placeholder="e.g., Users need to track their daily habits because existing apps are too complex"
              className="min-h-[80px]"
              data-testid="input-problem-statement"
            />
          </div>

          <div>
            <Label className="text-title font-medium text-contrast-high mb-2 block">
              Top 3 user goals <span className="text-red-500">*</span>
            </Label>
            <p className="text-metadata text-contrast-medium mb-2">
              What should users accomplish?
            </p>
            <div className="space-y-2">
              {details.userGoals.map((goal, index) => (
                <Input
                  key={index}
                  value={goal}
                  onChange={(e) => updateArrayItem("userGoals", index, e.target.value)}
                  placeholder={`Goal ${index + 1}`}
                  data-testid={`input-goal-${index}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-title font-medium text-contrast-high mb-2 block">
                Main objects (nouns)
              </Label>
              <p className="text-metadata text-contrast-medium mb-2">
                What things exist in your app?
              </p>
              <div className="space-y-2">
                {details.mainObjects.map((obj, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={obj}
                      onChange={(e) => updateArrayItem("mainObjects", index, e.target.value)}
                      placeholder="e.g., Project, Task, User"
                      data-testid={`input-object-${index}`}
                    />
                    {details.mainObjects.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArrayItem("mainObjects", index)}
                        className="shrink-0 w-11 h-11"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addArrayItem("mainObjects")}
                  className="text-accent"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add object
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-title font-medium text-contrast-high mb-2 block">
                Main actions (verbs)
              </Label>
              <p className="text-metadata text-contrast-medium mb-2">
                What can users do?
              </p>
              <div className="space-y-2">
                {details.mainActions.map((action, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={action}
                      onChange={(e) => updateArrayItem("mainActions", index, e.target.value)}
                      placeholder="e.g., Create, Edit, Share"
                      data-testid={`input-action-${index}`}
                    />
                    {details.mainActions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArrayItem("mainActions", index)}
                        className="shrink-0 w-11 h-11"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addArrayItem("mainActions")}
                  className="text-accent"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add action
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-title font-medium text-contrast-high mb-2 block">
              V1 definition <span className="text-red-500">*</span>
            </Label>
            <p className="text-metadata text-contrast-medium mb-2">
              What makes v1 "done"? What can it do end-to-end?
            </p>
            <Textarea
              value={details.v1Definition}
              onChange={(e) => updateField("v1Definition", e.target.value)}
              placeholder="e.g., Users can create habits, check them off daily, and see a weekly streak chart"
              className="min-h-[80px]"
              data-testid="input-v1-definition"
            />
          </div>

          <div>
            <Label className="text-title font-medium text-contrast-high mb-2 block">
              Inspiration link <span className="text-contrast-low">(optional)</span>
            </Label>
            <Input
              value={details.inspirationLink}
              onChange={(e) => updateField("inspirationLink", e.target.value)}
              placeholder="https://example.com"
              data-testid="input-inspiration-link"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-description font-medium text-contrast-high mb-2 block">
                Must-use tools <span className="text-contrast-low">(optional)</span>
              </Label>
              <Input
                value={details.mustUseTools}
                onChange={(e) => updateField("mustUseTools", e.target.value)}
                placeholder="e.g., Supabase, Stripe"
                data-testid="input-must-use"
              />
            </div>
            <div>
              <Label className="text-description font-medium text-contrast-high mb-2 block">
                Must-avoid tools <span className="text-contrast-low">(optional)</span>
              </Label>
              <Input
                value={details.mustAvoidTools}
                onChange={(e) => updateField("mustAvoidTools", e.target.value)}
                placeholder="e.g., Firebase, MongoDB"
                data-testid="input-must-avoid"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/intake")}
            data-testid="button-back"
          >
            ← Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-primary min-h-[44px] px-8"
            data-testid="button-generate"
          >
            Generate Specs
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
