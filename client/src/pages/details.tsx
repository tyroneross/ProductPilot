import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Plus, X, ArrowRight, ChevronDown, ChevronUp, Loader2, FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [showOptional, setShowOptional] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const savedStyle = (() => {
    try {
      const raw = sessionStorage.getItem("appStyle");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const savedDesignProfile = (() => {
    try {
      const raw = sessionStorage.getItem("designProfile");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const savedPromptPack = sessionStorage.getItem("promptPack") || null;

  const appStyleWithPrefs = (() => {
    if (!savedStyle && !savedDesignProfile) return null;
    return {
      ...(savedStyle ?? {}),
      ...(savedDesignProfile ? { designProfile: savedDesignProfile } : {}),
      ...(savedPromptPack ? { promptPack: savedPromptPack } : {}),
    };
  })();

  const hasFocusedPreferences = savedDesignProfile?.source === "focused";

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

  const getCleanedDetails = () => ({
    ...details,
    userGoals: details.userGoals.filter(g => g.trim()),
    mainObjects: details.mainObjects.filter(o => o.trim()),
    mainActions: details.mainActions.filter(a => a.trim()),
  });

  const handleAddMoreDetails = () => {
    const cleanedDetails = getCleanedDetails();
    sessionStorage.setItem("minimumDetails", JSON.stringify(cleanedDetails));
    sessionStorage.setItem("productIdea", details.problemStatement);
    // The session-survey flow will POST to /api/projects itself and pull
    // appStyle from sessionStorage; ensure the merged blob is there.
    if (appStyleWithPrefs) {
      sessionStorage.setItem("appStyle", JSON.stringify(appStyleWithPrefs));
    }
    setLocation("/session/survey");
  };

  const handleBuildDocsNow = async () => {
    setIsGenerating(true);
    const cleanedDetails = getCleanedDetails();
    
    try {
      const projectPayload: Record<string, unknown> = {
        name: cleanedDetails.problemStatement.substring(0, 50) + (cleanedDetails.problemStatement.length > 50 ? "..." : ""),
        description: cleanedDetails.v1Definition,
        mode: "survey",
        minimumDetails: cleanedDetails,
      };
      if (appStyleWithPrefs) {
        projectPayload.appStyle = appStyleWithPrefs;
      }
      const response = await apiRequest("POST", "/api/projects", projectPayload);
      
      const project = await response.json();
      
      // Generate docs directly from minimum details
      await apiRequest("POST", `/api/projects/${project.id}/generate-docs-from-minimum`, {
        minimumDetails: cleanedDetails,
      });
      
      toast({
        title: "Documents generated!",
        description: "Your product docs are ready to view.",
      });
      
      setLocation(`/documents/${project.id}`);
    } catch (error) {
      console.error("Failed to generate docs:", error);
      toast({
        title: "Generation failed",
        description: "Please try again or add more details.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-accent rounded-full mb-4">
            <Sparkles className="w-6 h-6 text-surface-primary" />
          </div>
          <h1 className="text-h3 font-medium text-contrast-high mb-2">
            Tell us about your idea
          </h1>
          <p className="text-description text-contrast-medium">
            Just 3 things needed to generate your product docs
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

          <Collapsible open={showOptional} onOpenChange={setShowOptional}>
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-2 text-description text-accent hover:underline w-full justify-center py-2"
                data-testid="button-show-optional"
              >
                {showOptional ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide optional fields
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Add more details (optional)
                  </>
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
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
                  Inspiration link
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
                    Must-use tools
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
                    Must-avoid tools
                  </Label>
                  <Input
                    value={details.mustAvoidTools}
                    onChange={(e) => updateField("mustAvoidTools", e.target.value)}
                    placeholder="e.g., Firebase, MongoDB"
                    data-testid="input-must-avoid"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex flex-col gap-4 mt-8">
          <Button
            onClick={handleBuildDocsNow}
            disabled={!canContinue || isGenerating}
            className="btn-primary min-h-[52px] w-full text-body"
            data-testid="button-build-docs-now"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating docs...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Build Docs Now
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-metadata text-contrast-medium">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          
          <Button
            variant="outline"
            onClick={handleAddMoreDetails}
            disabled={!canContinue || isGenerating}
            className="min-h-[44px] w-full"
            data-testid="button-add-more-details"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Add More Details First
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
          <p className="text-metadata text-contrast-medium text-center">
            Adding more details helps generate more accurate documentation
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="text-description text-contrast-medium hover:text-accent"
            data-testid="button-back-home"
          >
            ← Back to home
          </button>
          <div className="flex items-center gap-3">
            {hasFocusedPreferences && (
              <span
                className="text-metadata bg-accent/10 text-accent px-2 py-1 rounded-full font-medium"
                data-testid="chip-preferences-applied"
              >
                Preferences applied
              </span>
            )}
            <button
              onClick={() => setLocation("/style")}
              className="text-description text-contrast-medium hover:text-accent"
              data-testid="button-change-style"
            >
              {savedStyle ? `Style: ${savedStyle.name}` : "Pick a style"} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
