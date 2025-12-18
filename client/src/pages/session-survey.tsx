import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Save, ChevronRight, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, Stage, Message, SurveyDefinition, SurveyResponse } from "@shared/schema";

export default function SessionSurveyPage() {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftCreated = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const productIdea = sessionStorage.getItem("productIdea") || "";

  const { data: project, refetch: refetchProject } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

  const prdStage = stages.find((s) => s.stageNumber === 2);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/stages", prdStage?.id, "messages"],
    enabled: !!prdStage?.id,
  });

  const surveyDefinition = project?.surveyDefinition as SurveyDefinition | null;
  const surveyPhase = project?.surveyPhase || "discovery";

  useEffect(() => {
    if (!projectId && productIdea && !draftCreated.current) {
      draftCreated.current = true;
      createDraftProject();
    }
  }, []);

  const createDraftProject = async () => {
    try {
      const res = await apiRequest("POST", "/api/projects", {
        name: `Survey Draft - ${new Date().toLocaleTimeString()}`,
        description: productIdea.slice(0, 200),
        mode: "survey",
        aiModel: "claude-sonnet",
        surveyPhase: "discovery",
      });
      const newProject = await res.json();
      setProjectId(newProject.id);
      sessionStorage.setItem("surveyProjectId", newProject.id);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      toast({
        title: "Failed to create project",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!prdStage) return null;
      const res = await apiRequest("POST", `/api/stages/${prdStage.id}/messages`, {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (projectId && prdStage) {
        queryClient.invalidateQueries({ queryKey: ["/api/stages", prdStage.id, "messages"] });
      }
      
      if (data && data.userMessage && !data.aiMessage) {
        toast({
          title: "AI service error",
          description: data.error || "AI is temporarily unavailable. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      setInputValue("");
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateSurveyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/generate-survey`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchProject();
      toast({
        title: "Survey generated!",
        description: "Now complete the survey to generate your documentation.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate survey",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitSurveyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/submit-survey`, {
        responses: surveyResponses,
      });
      return apiRequest("POST", `/api/projects/${projectId}/generate-docs-from-survey`, {});
    },
    onSuccess: () => {
      refetchProject();
      toast({
        title: "Documentation generated!",
        description: "Your complete product documentation is ready.",
      });
      setLocation(`/documents/${projectId}`);
    },
    onError: () => {
      toast({
        title: "Failed to generate documentation",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      if (projectId) {
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { name });
        return res.json();
      }
      return null;
    },
    onSuccess: (updatedProject: Project | null) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowSaveDialog(false);
      toast({
        title: "Project saved!",
        description: `"${updatedProject?.name}" has been saved successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to save project",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(inputValue.trim());
    }
  };

  const handleGenerateSurvey = () => {
    generateSurveyMutation.mutate();
  };

  const handleSurveyResponseChange = (questionId: string, value: number | string | string[]) => {
    setSurveyResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitSurvey = async () => {
    setIsGeneratingDocs(true);
    await submitSurveyMutation.mutateAsync();
    setIsGeneratingDocs(false);
  };

  const handleSave = () => {
    setShowSaveDialog(true);
    if (project) {
      setProjectName(project.name);
    }
  };

  const handleSaveWithName = () => {
    if (projectName.trim()) {
      saveProjectMutation.mutate(projectName);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userMessages = messages.filter((m) => m.role === "user");
  const canGenerateSurvey = userMessages.length >= 3;

  const currentSection = surveyDefinition?.sections?.[currentSectionIndex];
  const isLastSection = surveyDefinition && currentSectionIndex === surveyDefinition.sections.length - 1;

  const renderDiscoveryPhase = () => (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
            AI
          </div>
          <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200">
            <p className="text-description text-contrast-high leading-relaxed">
              Welcome to Survey Mode! I'll ask you a few quick questions to understand your product idea, then generate a comprehensive survey.
            </p>
            <p className="text-description text-contrast-high leading-relaxed mt-3">
              You mentioned: <strong>"{productIdea}"</strong>
            </p>
            <p className="text-description text-contrast-high leading-relaxed mt-3">
              <strong>Let's start: Who will be the primary users of this product?</strong>
            </p>
          </div>
        </div>

        {messages.map((message: Message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
            }`}
            data-testid={`message-${message.role}-${message.id}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-description font-medium ${
                message.role === "user"
                  ? "bg-contrast-high text-surface-primary"
                  : "bg-accent text-surface-primary"
              }`}
            >
              {message.role === "user" ? "You" : "AI"}
            </div>
            <div
              className={`flex-1 rounded-lg p-4 ${
                message.role === "user"
                  ? "bg-accent text-surface-primary"
                  : "bg-surface-primary border border-gray-200 text-contrast-high"
              }`}
            >
              <p className="text-description whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>
            </div>
          </div>
        ))}

        {sendMessageMutation.isPending && (
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
              AI
            </div>
            <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                <span className="text-description text-contrast-medium">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-6 bg-surface-primary">
        {canGenerateSurvey && (
          <div className="mb-4 p-4 bg-surface-secondary rounded-lg border border-accent">
            <p className="text-description text-contrast-high mb-3">
              Great progress! You've answered enough questions. Ready to generate your personalized survey?
            </p>
            <Button
              onClick={handleGenerateSurvey}
              disabled={generateSurveyMutation.isPending}
              className="btn-primary"
              data-testid="button-generate-survey"
            >
              {generateSurveyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Survey...
                </>
              ) : (
                <>
                  Generate Survey
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex space-x-3">
          <Input
            type="text"
            placeholder="Type your answer..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 min-h-[44px]"
            disabled={sendMessageMutation.isPending || !prdStage}
            data-testid="input-discovery-message"
          />
          <Button
            type="submit"
            className="btn-primary min-h-[44px] min-w-[44px]"
            disabled={!inputValue.trim() || sendMessageMutation.isPending || !prdStage}
            data-testid="button-send-discovery-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );

  const renderSurveyPhase = () => {
    if (!surveyDefinition || !currentSection) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-description text-contrast-medium">Loading survey...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-metadata text-contrast-medium">
                Section {currentSectionIndex + 1} of {surveyDefinition.sections.length}
              </span>
              <div className="flex space-x-1">
                {surveyDefinition.sections.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-8 h-1 rounded ${
                      idx <= currentSectionIndex ? "bg-accent" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
            <h2 className="text-h3 font-medium text-contrast-high">{currentSection.title}</h2>
            <p className="text-description text-contrast-medium mt-1">{currentSection.description}</p>
          </div>

          <div className="space-y-8">
            {currentSection.questions.map((question) => (
              <div key={question.id} className="bg-surface-primary rounded-lg border border-gray-200 p-6">
                <Label className="text-description font-medium text-contrast-high mb-4 block">
                  {question.question}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </Label>

                {question.type === "slider" && (
                  <div className="space-y-4">
                    <Slider
                      value={[typeof surveyResponses[question.id] === "number" ? surveyResponses[question.id] as number : (question.min || 1)]}
                      onValueChange={([value]) => handleSurveyResponseChange(question.id, value)}
                      min={question.min || 1}
                      max={question.max || 5}
                      step={1}
                      className="w-full"
                      data-testid={`slider-${question.id}`}
                    />
                    <div className="flex justify-between text-metadata text-contrast-medium">
                      <span>{question.minLabel || question.min}</span>
                      <span className="text-accent font-medium">
                        {typeof surveyResponses[question.id] === "number" ? surveyResponses[question.id] : "-"}
                      </span>
                      <span>{question.maxLabel || question.max}</span>
                    </div>
                  </div>
                )}

                {question.type === "single-select" && question.options && (
                  <RadioGroup
                    value={surveyResponses[question.id] as string || ""}
                    onValueChange={(value) => handleSurveyResponseChange(question.id, value)}
                    className="space-y-2"
                    data-testid={`radio-${question.id}`}
                  >
                    {question.options.map((option) => (
                      <div key={option} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-surface-secondary">
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                        <Label htmlFor={`${question.id}-${option}`} className="text-description text-contrast-high cursor-pointer flex-1">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {question.type === "multi-select" && question.options && (
                  <div className="space-y-2" data-testid={`checkbox-${question.id}`}>
                    {question.options.map((option) => {
                      const currentValues = (surveyResponses[question.id] as string[]) || [];
                      return (
                        <div key={option} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-surface-secondary">
                          <Checkbox
                            id={`${question.id}-${option}`}
                            checked={currentValues.includes(option)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleSurveyResponseChange(question.id, [...currentValues, option]);
                              } else {
                                handleSurveyResponseChange(question.id, currentValues.filter((v) => v !== option));
                              }
                            }}
                          />
                          <Label htmlFor={`${question.id}-${option}`} className="text-description text-contrast-high cursor-pointer flex-1">
                            {option}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() => setCurrentSectionIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentSectionIndex === 0}
              data-testid="button-prev-section"
            >
              Previous
            </Button>
            
            {isLastSection ? (
              <Button
                onClick={handleSubmitSurvey}
                disabled={submitSurveyMutation.isPending || isGeneratingDocs}
                className="btn-primary"
                data-testid="button-submit-survey"
              >
                {isGeneratingDocs ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Docs...
                  </>
                ) : (
                  "Generate Documentation"
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentSectionIndex((prev) => prev + 1)}
                className="btn-primary"
                data-testid="button-next-section"
              >
                Next Section
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      <header className="border-b border-gray-200 bg-surface-primary px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="min-h-[44px] min-w-[44px]"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-h3 font-medium text-contrast-high">Survey Mode</h1>
              <p className="text-description text-contrast-medium">
                {surveyPhase === "discovery" 
                  ? "Quick discovery chat before your personalized survey"
                  : "Complete the survey to generate your documentation"
                }
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            className="min-h-[44px]"
            data-testid="button-save-project"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Project
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto">
        {surveyPhase === "discovery" ? renderDiscoveryPhase() : renderSurveyPhase()}
      </main>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Your Project</DialogTitle>
            <DialogDescription>
              Give your project a name so you can continue working on it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              data-testid="input-save-project-name"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveWithName} disabled={!projectName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
