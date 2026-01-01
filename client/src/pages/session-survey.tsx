import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Save, ChevronRight, Loader2, Plus, Trash2, Sparkles, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, Stage, Message, SurveyDefinition, SurveyResponse, CustomPrompt } from "@shared/schema";

export default function SessionSurveyPage() {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [showPromptsSection, setShowPromptsSection] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [showAddPromptDialog, setShowAddPromptDialog] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState<Partial<CustomPrompt>>({
    name: "",
    description: "",
    prompt: "",
    category: "general",
    isActive: true,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftCreated = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const productIdea = sessionStorage.getItem("productIdea") || "";
  const projectType = sessionStorage.getItem("projectType") || "not-sure";
  const projectPurpose = sessionStorage.getItem("projectPurpose") || "";
  
  const intakeAnswersRaw = sessionStorage.getItem("intakeAnswers");
  const intakeAnswers = intakeAnswersRaw ? JSON.parse(intakeAnswersRaw) : null;
  
  const minimumDetailsRaw = sessionStorage.getItem("minimumDetails");
  const minimumDetails = minimumDetailsRaw ? JSON.parse(minimumDetailsRaw) : null;

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

  useEffect(() => {
    if (project?.customPrompts) {
      setCustomPrompts(project.customPrompts as CustomPrompt[]);
    }
  }, [project?.customPrompts]);

  const getPlatformLabel = (platform: string) => {
    const labels: Record<string, string> = {
      "desktop": "Desktop Website",
      "mobile-web": "Mobile Website",
      "mobile-app": "Mobile App",
      "backend": "Backend/API",
    };
    return labels[platform] || platform;
  };

  const getBuildingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      "prototype": "Prototype/Demo",
      "internal": "Internal Tool",
      "product": "User Product",
      "scale": "Scalable Product",
    };
    return labels[type] || type;
  };

  const getCoreBehaviorLabel = (behavior: string) => {
    const labels: Record<string, string> = {
      "data": "Data Management",
      "content": "Content Display",
      "search": "Search/Discovery",
      "automate": "Automation",
      "ai-assist": "AI-Assisted",
    };
    return labels[behavior] || behavior;
  };

  const getIntakeContext = () => {
    if (!intakeAnswers) return "";
    const parts = [];
    if (intakeAnswers.buildingType) parts.push(getBuildingTypeLabel(intakeAnswers.buildingType));
    if (intakeAnswers.platform) parts.push(getPlatformLabel(intakeAnswers.platform));
    if (intakeAnswers.coreBehavior) parts.push(getCoreBehaviorLabel(intakeAnswers.coreBehavior));
    return parts.join(" • ");
  };

  const createDraftProject = async () => {
    try {
      const contextLabel = getIntakeContext() || getPlatformLabel(projectType);
      const problemStatement = minimumDetails?.problemStatement || productIdea;
      const res = await apiRequest("POST", "/api/projects", {
        name: `Survey Draft - ${new Date().toLocaleTimeString()}`,
        description: `[${contextLabel}] ${problemStatement.slice(0, 200)}`,
        mode: "survey",
        aiModel: "claude-sonnet",
        surveyPhase: "discovery",
        intakeAnswers: intakeAnswers,
        minimumDetails: minimumDetails,
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
        const project = await res.json();
        
        try {
          await apiRequest("POST", `/api/projects/${projectId}/claim`, {});
        } catch (e) {
        }
        
        return project;
      }
      return null;
    },
    onSuccess: (updatedProject: Project | null) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/draft"] });
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
    try {
      await submitSurveyMutation.mutateAsync();
    } catch (error) {
      // Error is already handled by mutation's onError
    } finally {
      setIsGeneratingDocs(false);
    }
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

  const savePromptsMutation = useMutation({
    mutationFn: async (prompts: CustomPrompt[]) => {
      if (projectId) {
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { customPrompts: prompts });
        return res.json();
      }
      return null;
    },
    onSuccess: () => {
      refetchProject();
      toast({
        title: "Prompts saved!",
        description: "Your custom prompts have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save prompts",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddPrompt = () => {
    if (newPrompt.name && newPrompt.prompt) {
      let updatedPrompts: CustomPrompt[];
      
      if (editingPromptId) {
        updatedPrompts = customPrompts.map((p) =>
          p.id === editingPromptId
            ? {
                ...p,
                name: newPrompt.name!,
                description: newPrompt.description || "",
                prompt: newPrompt.prompt!,
                category: newPrompt.category as CustomPrompt["category"] || "general",
                isActive: p.isActive,
              }
            : p
        );
      } else {
        const prompt: CustomPrompt = {
          id: `prompt_${Date.now()}`,
          name: newPrompt.name,
          description: newPrompt.description || "",
          prompt: newPrompt.prompt,
          category: newPrompt.category as CustomPrompt["category"] || "general",
          isActive: true,
        };
        updatedPrompts = [...customPrompts, prompt];
      }
      
      setCustomPrompts(updatedPrompts);
      savePromptsMutation.mutate(updatedPrompts);
      setNewPrompt({ name: "", description: "", prompt: "", category: "general", isActive: true });
      setEditingPromptId(null);
      setShowAddPromptDialog(false);
    }
  };

  const handleEditPrompt = (prompt: CustomPrompt) => {
    setNewPrompt({
      name: prompt.name,
      description: prompt.description,
      prompt: prompt.prompt,
      category: prompt.category,
      isActive: prompt.isActive,
    });
    setEditingPromptId(prompt.id);
    setShowAddPromptDialog(true);
  };

  const handleOpenAddDialog = () => {
    setNewPrompt({ name: "", description: "", prompt: "", category: "general", isActive: true });
    setEditingPromptId(null);
    setShowAddPromptDialog(true);
  };

  const handleDeletePrompt = (id: string) => {
    const updatedPrompts = customPrompts.filter((p) => p.id !== id);
    setCustomPrompts(updatedPrompts);
    savePromptsMutation.mutate(updatedPrompts);
  };

  const handleTogglePrompt = (id: string) => {
    const updatedPrompts = customPrompts.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    setCustomPrompts(updatedPrompts);
    savePromptsMutation.mutate(updatedPrompts);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userMessages = messages.filter((m) => m.role === "user");
  const canGenerateSurvey = userMessages.length >= 3;
  
  // Progress tracking for discovery phase
  const TOTAL_DISCOVERY_QUESTIONS = 6;
  const discoveryProgress = Math.min(userMessages.length, TOTAL_DISCOVERY_QUESTIONS);
  const discoveryProgressPercent = Math.round((discoveryProgress / TOTAL_DISCOVERY_QUESTIONS) * 100);

  const currentSection = surveyDefinition?.sections?.[currentSectionIndex];
  const isLastSection = surveyDefinition && currentSectionIndex === surveyDefinition.sections.length - 1;

  const getFirstQuestion = () => {
    if (minimumDetails) {
      const goals = minimumDetails.userGoals?.filter((g: string) => g.trim()).join(", ");
      if (goals) {
        return `I see your top goals are: ${goals}. Let's dive deeper — which of these is the absolute must-have for v1?`;
      }
      if (minimumDetails.v1Definition) {
        return `Your v1 definition is clear. What's the biggest risk or unknown that could prevent you from shipping this?`;
      }
    }
    if (intakeAnswers) {
      const { buildingType, coreBehavior, aiUsage } = intakeAnswers;
      
      if (coreBehavior === "ai-assist" || aiUsage === "generate" || aiUsage === "automate") {
        return "Tell me about the AI features you envision. What will the AI help users do, and what inputs will it need?";
      }
      if (coreBehavior === "data") {
        return "What data will users be managing? Walk me through the main actions they'll take.";
      }
      if (coreBehavior === "automate") {
        return "What tasks or workflows will this automate? What triggers them and what's the output?";
      }
      if (coreBehavior === "search") {
        return "What will users be searching for or discovering? How should results be organized?";
      }
      if (buildingType === "prototype") {
        return "What's the core concept you want to validate? What's the minimum to prove the idea works?";
      }
      if (buildingType === "internal") {
        return "What internal problem does this solve? Who on your team will use it and how often?";
      }
    }
    return "Tell me more about your idea. What problem does it solve, and who are the main users?";
  };

  const renderDiscoveryPhase = () => (
    <div className="flex-1 flex flex-col">
      {/* Progress indicator for discovery phase */}
      <div className="px-6 pt-4 pb-2 bg-surface-secondary border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-metadata text-contrast-medium" data-testid="discovery-progress-text">
            Question {discoveryProgress} of ~{TOTAL_DISCOVERY_QUESTIONS}
          </span>
          <span className="text-metadata text-contrast-medium">
            {canGenerateSurvey ? "Ready to generate specs" : `${TOTAL_DISCOVERY_QUESTIONS - discoveryProgress} more to go`}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden" data-testid="discovery-progress-bar">
          <div 
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${discoveryProgressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
            AI
          </div>
          <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200">
            <p className="text-description text-contrast-high leading-relaxed">
              I've got your project details. Let me ask a few follow-up questions to generate comprehensive specs.
            </p>
            {(getIntakeContext() || minimumDetails?.problemStatement) && (
              <div className="mt-3 p-3 bg-surface-secondary rounded-lg">
                {minimumDetails?.problemStatement && (
                  <p className="text-description text-contrast-high mb-2">
                    <strong>Problem:</strong> {minimumDetails.problemStatement}
                  </p>
                )}
                {getIntakeContext() && (
                  <p className="text-metadata text-contrast-medium">
                    {getIntakeContext()}
                  </p>
                )}
              </div>
            )}
            <p className="text-description text-contrast-high leading-relaxed mt-3">
              <strong>{getFirstQuestion()}</strong>
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
          <div className="flex items-start space-x-3" data-testid="ai-loading-skeleton">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
              AI
            </div>
            <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200 space-y-3">
              <div className="h-4 bg-surface-secondary rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-surface-secondary rounded animate-pulse w-full"></div>
              <div className="h-4 bg-surface-secondary rounded animate-pulse w-5/6"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 md:p-6 bg-surface-primary sticky bottom-0 z-10">
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

        <form onSubmit={handleSubmit} className="flex space-x-2 md:space-x-3">
          <Input
            type="text"
            placeholder="Type your answer..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 min-h-[44px] text-base"
            disabled={sendMessageMutation.isPending || !prdStage}
            data-testid="input-discovery-message"
            autoComplete="off"
          />
          <Button
            type="submit"
            className="btn-primary min-h-[44px] min-w-[44px] shrink-0"
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
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowPromptsSection(true)}
              className="min-h-[44px]"
              data-testid="button-manage-prompts"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Prompts
              {customPrompts.length > 0 && (
                <span className="ml-2 bg-accent text-surface-primary text-xs px-2 py-0.5 rounded-full">
                  {customPrompts.length}
                </span>
              )}
            </Button>
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

      <Dialog open={showPromptsSection} onOpenChange={setShowPromptsSection}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom LLM Prompts</DialogTitle>
            <DialogDescription>
              Define custom prompts to use throughout your app. These prompts can be used for requirements, features, architecture, coding, or testing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <span className="text-description text-contrast-medium">
                {customPrompts.length} prompt{customPrompts.length !== 1 ? "s" : ""} defined
              </span>
              <Button
                onClick={handleOpenAddDialog}
                className="btn-primary"
                data-testid="button-add-prompt"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Prompt
              </Button>
            </div>

            {customPrompts.length === 0 ? (
              <div className="text-center py-8 text-contrast-medium">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-description">No custom prompts yet.</p>
                <p className="text-metadata">Add prompts to customize AI behavior in your app.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`bg-surface-secondary rounded-lg p-4 border ${
                      prompt.isActive ? "border-accent" : "border-gray-200 opacity-60"
                    }`}
                    data-testid={`prompt-card-${prompt.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-title font-medium text-contrast-high">{prompt.name}</h4>
                          <span className="text-xs bg-surface-primary px-2 py-0.5 rounded text-contrast-medium">
                            {prompt.category}
                          </span>
                        </div>
                        {prompt.description && (
                          <p className="text-metadata text-contrast-medium mb-2">{prompt.description}</p>
                        )}
                        <p className="text-description text-contrast-high line-clamp-2">{prompt.prompt}</p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPrompt(prompt)}
                          className="text-contrast-medium hover:text-contrast-high"
                          data-testid={`button-edit-prompt-${prompt.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePrompt(prompt.id)}
                          className={prompt.isActive ? "text-accent" : "text-contrast-medium"}
                          data-testid={`button-toggle-prompt-${prompt.id}`}
                        >
                          {prompt.isActive ? "Active" : "Inactive"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="text-red-500 hover:text-red-700"
                          data-testid={`button-delete-prompt-${prompt.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddPromptDialog} onOpenChange={(open) => {
        if (!open) {
          setEditingPromptId(null);
          setNewPrompt({ name: "", description: "", prompt: "", category: "general", isActive: true });
        }
        setShowAddPromptDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPromptId ? "Edit Custom Prompt" : "Add Custom Prompt"}</DialogTitle>
            <DialogDescription>
              {editingPromptId ? "Update your LLM prompt." : "Create a new LLM prompt for use in your application."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-description mb-2 block">Name</Label>
              <Input
                placeholder="e.g., Code Review Prompt"
                value={newPrompt.name}
                onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                data-testid="input-prompt-name"
              />
            </div>
            <div>
              <Label className="text-description mb-2 block">Category</Label>
              <Select
                value={newPrompt.category}
                onValueChange={(value) => setNewPrompt({ ...newPrompt, category: value as CustomPrompt["category"] })}
              >
                <SelectTrigger data-testid="select-prompt-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requirements">Requirements</SelectItem>
                  <SelectItem value="features">Features</SelectItem>
                  <SelectItem value="architecture">Architecture</SelectItem>
                  <SelectItem value="coding">Coding</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-description mb-2 block">Description (optional)</Label>
              <Input
                placeholder="Brief description of what this prompt does"
                value={newPrompt.description}
                onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                data-testid="input-prompt-description"
              />
            </div>
            <div>
              <Label className="text-description mb-2 block">Prompt</Label>
              <Textarea
                placeholder="Enter your LLM prompt here..."
                value={newPrompt.prompt}
                onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                className="min-h-[150px]"
                data-testid="textarea-prompt-content"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setShowAddPromptDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddPrompt} 
                disabled={!newPrompt.name?.trim() || !newPrompt.prompt?.trim()}
                data-testid="button-save-prompt"
              >
                {editingPromptId ? "Save Changes" : "Add Prompt"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
