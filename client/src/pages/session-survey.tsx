import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Save, ChevronRight, Loader2, Plus, Trash2, Sparkles, Pencil, Menu, X, Check } from "lucide-react";
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
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, stageName: "" });
  const [showDocumentSelection, setShowDocumentSelection] = useState(false);
  const [documentSelections, setDocumentSelections] = useState<Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }>>({});
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
  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftCreated = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const productIdea = sessionStorage.getItem("productIdea") || "";
  const projectType = sessionStorage.getItem("projectType") || "not-sure";
  const projectPurpose = sessionStorage.getItem("projectPurpose") || "";

  const intakeAnswersRaw = sessionStorage.getItem("intakeAnswers");
  const intakeAnswers = intakeAnswersRaw ? JSON.parse(intakeAnswersRaw) : null;

  const minimumDetailsRaw = sessionStorage.getItem("minimumDetails");
  const minimumDetails = minimumDetailsRaw ? JSON.parse(minimumDetailsRaw) : null;

  // Parse projectId from URL query params if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlProjectId = params.get("projectId");
    if (urlProjectId && !projectId) {
      setProjectId(urlProjectId);
    }
  }, []);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const { data: project, refetch: refetchProject } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: stages = [], isLoading: stagesLoading, refetch: refetchStages } = useQuery<Stage[]>({
    queryKey: ["/api/projects", projectId, "stages"],
    enabled: !!projectId,
  });

  // Ensure stages exist for legacy projects that don't have them
  const stagesEnsured = useRef(false);
  useEffect(() => {
    if (projectId && !stagesLoading && stages.length === 0 && !stagesEnsured.current) {
      stagesEnsured.current = true;
      apiRequest("POST", `/api/projects/${projectId}/ensure-stages`, {})
        .then(() => {
          refetchStages();
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
        })
        .catch(console.error);
    }
  }, [projectId, stagesLoading, stages.length, refetchStages, queryClient]);

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

  // Restore saved survey responses and calculate current section when project loads
  const surveyRestored = useRef(false);
  useEffect(() => {
    const sections = surveyDefinition?.sections;
    if (!project || !sections || sections.length === 0 || surveyRestored.current) {
      return;
    }

    const savedResponses = project.surveyResponses as SurveyResponse | null;
    if (savedResponses && Object.keys(savedResponses).length > 0) {
      setSurveyResponses(savedResponses);

      let lastCompletedSection = -1;
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const allQuestionsAnswered = section.questions.every(
          (q: { id: string }) => savedResponses[q.id] !== undefined && savedResponses[q.id] !== ""
        );
        if (allQuestionsAnswered) {
          lastCompletedSection = i;
        } else {
          break;
        }
      }

      const targetSection = Math.min(lastCompletedSection + 1, sections.length - 1);
      setCurrentSectionIndex(targetSection);
      surveyRestored.current = true;
    }
  }, [project, surveyDefinition]);

  // Initialize document selections when stages load
  useEffect(() => {
    if (stages.length > 0 && Object.keys(documentSelections).length === 0) {
      const initialSelections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }> = {};
      stages.forEach(stage => {
        initialSelections[stage.id] = { selected: true, detailLevel: "detailed" };
      });
      setDocumentSelections(initialSelections);
    }
  }, [stages]);

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

  const saveProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      if (projectId) {
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { name });
        const savedProject = await res.json();
        try {
          await apiRequest("POST", `/api/projects/${projectId}/claim`, {});
        } catch (e) {}
        return savedProject;
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

  const handleFreeformNoteChange = (questionId: string, note: string) => {
    setSurveyResponses((prev) => ({
      ...prev,
      [`${questionId}_note`]: note,
    }));
  };

  const handleMarkNA = (questionId: string) => {
    setSurveyResponses((prev) => ({
      ...prev,
      [questionId]: "N/A",
    }));
  };

  const autoSaveSurveyMutation = useMutation({
    mutationFn: async (responsesToSave: SurveyResponse) => {
      if (!projectId) return null;
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
        surveyResponses: responsesToSave,
      });
      return res.json();
    },
    onError: () => {
      toast({
        title: "Failed to save progress",
        description: "Your responses may not be saved.",
        variant: "destructive",
      });
    },
  });

  const handleNextSection = () => {
    autoSaveSurveyMutation.mutate(surveyResponses);
    setCurrentSectionIndex((prev) => prev + 1);
  };

  const handleSkipSection = () => {
    let updatedResponses = { ...surveyResponses };
    if (currentSection) {
      currentSection.questions.forEach((q) => {
        if (!updatedResponses[q.id]) {
          updatedResponses[q.id] = "N/A";
        }
      });
    }
    setSurveyResponses(updatedResponses);
    autoSaveSurveyMutation.mutate(updatedResponses);
    setCurrentSectionIndex((prev) => prev + 1);
  };

  const handleReadyToGenerate = async () => {
    autoSaveSurveyMutation.mutate(surveyResponses);
    setShowDocumentSelection(true);
  };

  const handleConfirmGenerate = async () => {
    setShowDocumentSelection(false);
    setIsGeneratingDocs(true);

    const selectedStageIds = new Set(
      stages.filter(s => documentSelections[s.id]?.selected).map(s => s.id)
    );
    const totalSelected = selectedStageIds.size;
    setGenerationProgress({ current: 0, total: totalSelected, stageName: "Starting..." });

    let generationComplete = false;

    const checkAndNavigate = async () => {
      if (generationComplete) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/stages`);
        if (res.ok) {
          const updatedStages: Stage[] = await res.json();
          const completedCount = updatedStages.filter(s =>
            selectedStageIds.has(s.id) && s.progress === 100
          ).length;
          const inProgressStage = updatedStages.find(s =>
            selectedStageIds.has(s.id) && s.progress > 0 && s.progress < 100
          );
          const nextStage = updatedStages.find(s =>
            selectedStageIds.has(s.id) && s.progress === 0
          );

          setGenerationProgress({
            current: completedCount,
            total: totalSelected,
            stageName: inProgressStage?.title || nextStage?.title || "Finishing up...",
          });

          if (completedCount === totalSelected && totalSelected > 0) {
            generationComplete = true;
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
            setIsGeneratingDocs(false);
            setGenerationProgress({ current: 0, total: 0, stageName: "" });
            refetchProject();
            toast({
              title: "Documentation generated!",
              description: "Your complete product documentation is ready.",
            });
            setLocation(`/documents/${projectId}`);
          }
        }
      } catch (e) {
        // Ignore polling errors
      }
    };

    pollIntervalRef.current = setInterval(checkAndNavigate, 2000);

    try {
      await apiRequest("POST", `/api/projects/${projectId}/submit-survey`, {
        responses: surveyResponses,
      });

      const preferences = Object.entries(documentSelections)
        .filter(([_, pref]) => pref.selected)
        .map(([stageId, pref]) => ({
          stageId,
          detailLevel: pref.detailLevel,
        }));

      await apiRequest("POST", `/api/projects/${projectId}/generate-docs-from-survey`, {});

      // Polling will handle navigation when generation completes
      await checkAndNavigate();
    } catch (error) {
      if (!generationComplete) {
        toast({
          title: "Failed to generate documentation",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (!generationComplete) {
        setIsGeneratingDocs(false);
        setGenerationProgress({ current: 0, total: 0, stageName: "" });
      }
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

  // ── Helper: determine step state ──────────────────────────────────────
  const getStepState = (idx: number): "completed" | "active" | "locked" => {
    if (!surveyDefinition) return idx === currentSectionIndex ? "active" : "locked";
    if (idx < currentSectionIndex) return "completed";
    if (idx === currentSectionIndex) return "active";
    return "locked";
  };

  const sections = surveyDefinition?.sections ?? [];
  const totalSections = sections.length;
  const progressPercent = totalSections > 0
    ? Math.round(((currentSectionIndex) / totalSections) * 100)
    : 0;
  const genProgressPercent = generationProgress.total > 0
    ? Math.round((generationProgress.current / generationProgress.total) * 100)
    : 0;
  const selectedCount = Object.values(documentSelections).filter(s => s.selected).length;

  // ── Discovery phase (unchanged visual) ────────────────────────────────
  const renderDiscoveryPhase = () => (
    <div className="flex-1 flex flex-col">
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

  // ── Survey Phase — Step Wizard ─────────────────────────────────────────
  const renderSurveyPhase = () => {
    if (!surveyDefinition || !currentSection) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#110f0d",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Loader2
              style={{ width: 32, height: 32, color: "#f0b65e", margin: "0 auto 16px", animation: "spin 1s linear infinite" }}
            />
            <p style={{ color: "#a89a8c", fontSize: 14 }}>Loading survey...</p>
          </div>
        </div>
      );
    }

    const nextSectionTitle = !isLastSection && sections[currentSectionIndex + 1]?.title;

    return (
      <div
        style={{
          display: "flex",
          height: "100%",
          overflow: "hidden",
          background: "#110f0d",
          flex: 1,
        }}
      >
        {/* ── Mobile overlay ── */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(17,15,13,0.8)",
              zIndex: 100,
              backdropFilter: "blur(2px)",
            }}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          style={{
            width: 256,
            minWidth: 256,
            height: "100%",
            background: "#231f1b",
            borderRight: "1px solid rgba(200,180,160,0.08)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
            transition: "transform 0.25s ease",
            // Mobile: fixed drawer
            ...(typeof window !== "undefined" && window.innerWidth <= 768
              ? {
                  position: "fixed" as const,
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 101,
                  transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                }
              : {}),
          }}
          className="survey-sidebar"
        >
          {/* Top */}
          <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setLocation("/")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "none", border: "none", color: "#a89a8c",
                  fontSize: 13, fontFamily: "inherit", cursor: "pointer", padding: 0,
                }}
                data-testid="button-back-home"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f0eb", letterSpacing: "-0.01em" }}>
                Product<span style={{ color: "#f0b65e" }}>Pilot</span>
              </span>
            </div>
            {project?.name && (
              <div
                style={{
                  fontSize: 13, fontWeight: 500, color: "#f5f0eb",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  padding: "0 2px",
                }}
                data-testid="text-project-name"
              >
                {project.name}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "rgba(200,180,160,0.08)", flexShrink: 0 }} />

          {/* Steps list */}
          <nav
            style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
          >
            {sections.map((section, idx) => {
              const state = getStepState(idx);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (state === "completed") {
                      setCurrentSectionIndex(idx);
                      setSidebarOpen(false);
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", fontSize: 13, width: "100%",
                    background: state === "active" ? "rgba(240,182,94,0.06)" : "none",
                    border: "none",
                    borderLeft: state === "active" ? "2px solid #f0b65e" : "2px solid transparent",
                    color: state === "completed" ? "#a89a8c" : state === "active" ? "#f5f0eb" : "#6b5d52",
                    fontWeight: state === "active" ? 500 : 400,
                    fontFamily: "inherit",
                    cursor: state === "completed" ? "pointer" : "default",
                    textAlign: "left",
                    position: "relative",
                  }}
                >
                  {/* Icon */}
                  <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {state === "completed" && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="#f0b65e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {state === "active" && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f0b65e" }} />
                    )}
                    {state === "locked" && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid rgba(200,180,160,0.16)" }} />
                    )}
                  </div>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {section.title}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Footer progress */}
          <div style={{ padding: 16, flexShrink: 0, borderTop: "1px solid rgba(200,180,160,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b5d52", marginBottom: 8 }}>
              <span>Progress</span>
              <span>{currentSectionIndex + 1} of {totalSections}</span>
            </div>
            <div style={{ height: 3, background: "rgba(200,180,160,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: "#f0b65e",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Mobile top bar */}
          <div
            className="survey-mobile-topbar"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "#231f1b",
              borderBottom: "1px solid rgba(200,180,160,0.08)",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f0eb" }}>
              Product<span style={{ color: "#f0b65e" }}>Pilot</span>
            </span>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", color: "#a89a8c", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Mobile step dots */}
          <div
            className="survey-step-dots"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 16px",
              background: "#231f1b",
              borderBottom: "1px solid rgba(200,180,160,0.08)",
            }}
          >
            {sections.map((_, idx) => {
              const state = getStepState(idx);
              return (
                <div
                  key={idx}
                  style={{
                    width: state === "active" ? 18 : 6,
                    height: 6,
                    borderRadius: state === "active" ? 3 : "50%",
                    background: state === "completed" ? "rgba(240,182,94,0.4)" : state === "active" ? "#f0b65e" : "rgba(200,180,160,0.16)",
                    transition: "width 0.2s, background 0.2s",
                  }}
                />
              );
            })}
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "48px 32px 120px",
            }}
            className="survey-content-scroll"
          >
            <div style={{ maxWidth: 640, margin: "0 auto" }}>

              {/* Generating overlay (inline) */}
              {isGeneratingDocs && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "64px 24px",
                  }}
                  data-testid="generation-overlay"
                >
                  <Loader2
                    style={{
                      width: 40, height: 40, color: "#f0b65e",
                      margin: "0 auto 20px",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#f5f0eb", marginBottom: 8 }}>
                    Generating Documentation
                  </h3>
                  <p style={{ color: "#a89a8c", marginBottom: 24 }}>{generationProgress.stageName}</p>
                  <div style={{ maxWidth: 320, margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b5d52", marginBottom: 8 }}>
                      <span>Progress</span>
                      <span>{generationProgress.current} of {generationProgress.total} documents</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(200,180,160,0.08)", borderRadius: 99, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${genProgressPercent}%`,
                          background: "#f0b65e",
                          borderRadius: 99,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 12, color: "#6b5d52", marginTop: 12 }}>This may take a minute...</p>
                  </div>
                </div>
              )}

              {!isGeneratingDocs && (
                <>
                  {/* Step header */}
                  <div
                    style={{
                      fontSize: 11, fontWeight: 500, color: "#6b5d52",
                      textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
                    }}
                  >
                    Step {currentSectionIndex + 1}
                  </div>
                  <h2
                    style={{
                      fontSize: 24, fontWeight: 700, color: "#f5f0eb",
                      letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 10,
                    }}
                  >
                    {currentSection.title}
                  </h2>
                  {currentSection.description && (
                    <p style={{ fontSize: 15, color: "#a89a8c", lineHeight: 1.6, marginBottom: 36 }}>
                      {currentSection.description}
                    </p>
                  )}

                  {/* Questions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    {currentSection.questions.map((question, qIdx) => (
                      <div key={question.id} style={{ paddingTop: qIdx === 0 ? 0 : 0 }}>
                        <div
                          style={{ fontSize: 13, fontWeight: 500, color: "#f5f0eb", marginBottom: 12 }}
                        >
                          {question.question}
                          {question.required && <span style={{ color: "#f0b65e", marginLeft: 4 }}>*</span>}
                        </div>

                        {surveyResponses[question.id] === "N/A" ? (
                          <div
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "12px 16px",
                              background: "rgba(200,180,160,0.04)",
                              border: "1px solid rgba(200,180,160,0.08)",
                              borderRadius: 8,
                            }}
                          >
                            <span style={{ fontSize: 13, color: "#6b5d52" }}>Marked as N/A</span>
                            <button
                              onClick={() => handleSurveyResponseChange(question.id, "")}
                              style={{
                                background: "none", border: "none",
                                color: "#a89a8c", fontSize: 12, cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                              data-testid={`button-undo-na-${question.id}`}
                            >
                              Undo
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Slider */}
                            {question.type === "slider" && (
                              <div>
                                <Slider
                                  value={[typeof surveyResponses[question.id] === "number" ? surveyResponses[question.id] as number : (question.min || 1)]}
                                  onValueChange={([value]) => handleSurveyResponseChange(question.id, value)}
                                  min={question.min || 1}
                                  max={question.max || 5}
                                  step={1}
                                  className="w-full"
                                  data-testid={`slider-${question.id}`}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b5d52", marginTop: 8 }}>
                                  <span>{question.minLabel || question.min}</span>
                                  <span style={{ color: "#f0b65e", fontWeight: 500 }}>
                                    {typeof surveyResponses[question.id] === "number" ? surveyResponses[question.id] : "-"}
                                  </span>
                                  <span>{question.maxLabel || question.max}</span>
                                </div>
                              </div>
                            )}

                            {/* Single-select — radio cards */}
                            {question.type === "single-select" && question.options && (
                              <div
                                style={{ display: "flex", flexDirection: "column", gap: 8 }}
                                data-testid={`radio-${question.id}`}
                              >
                                {question.options.map((option) => {
                                  const selected = surveyResponses[question.id] === option;
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => handleSurveyResponseChange(question.id, option)}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 12,
                                        padding: "12px 16px",
                                        borderRadius: 8,
                                        border: selected ? "1px solid rgba(240,182,94,0.30)" : "1px solid rgba(200,180,160,0.08)",
                                        borderLeft: selected ? "2px solid #f0b65e" : undefined,
                                        background: selected ? "rgba(240,182,94,0.05)" : "#1a1714",
                                        color: selected ? "#f5f0eb" : "#a89a8c",
                                        fontSize: 13,
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        width: "100%",
                                        position: "relative",
                                      }}
                                    >
                                      {/* Radio dot */}
                                      <div
                                        style={{
                                          width: 16, height: 16, borderRadius: "50%",
                                          border: selected ? "1.5px solid #f0b65e" : "1.5px solid rgba(200,180,160,0.16)",
                                          flexShrink: 0,
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                      >
                                        {selected && (
                                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f0b65e" }} />
                                        )}
                                      </div>
                                      <span>{option}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Multi-select — chips */}
                            {question.type === "multi-select" && question.options && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(3, 1fr)",
                                  gap: 10,
                                }}
                                className="survey-chip-grid"
                                data-testid={`checkbox-${question.id}`}
                              >
                                {question.options.map((option) => {
                                  const currentValues = (surveyResponses[question.id] as string[]) || [];
                                  const selected = currentValues.includes(option);
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => {
                                        if (selected) {
                                          handleSurveyResponseChange(question.id, currentValues.filter(v => v !== option));
                                        } else {
                                          handleSurveyResponseChange(question.id, [...currentValues, option]);
                                        }
                                      }}
                                      style={{
                                        minHeight: 44,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        borderRadius: 10,
                                        border: selected ? "1px solid #f0b65e" : "1px solid rgba(200,180,160,0.08)",
                                        background: selected ? "#f0b65e" : "#1a1714",
                                        color: selected ? "#110f0d" : "#a89a8c",
                                        fontSize: 13,
                                        fontWeight: selected ? 500 : 400,
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                        padding: "8px 16px",
                                        textAlign: "center",
                                        userSelect: "none",
                                        wordBreak: "break-word",
                                        overflow: "hidden",
                                      }}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Text input */}
                            {question.type === "text" && (
                              <div>
                                {question.helperText && (
                                  <p style={{ fontSize: 11, color: "#6b5d52", marginBottom: 8 }}>
                                    {question.helperText}
                                  </p>
                                )}
                                <input
                                  type="text"
                                  value={(surveyResponses[question.id] as string) || ""}
                                  onChange={(e) => handleSurveyResponseChange(question.id, e.target.value)}
                                  placeholder="Type your answer..."
                                  style={{
                                    width: "100%", height: 44,
                                    background: "#1a1714",
                                    border: "1px solid rgba(200,180,160,0.08)",
                                    borderRadius: 8,
                                    color: "#f5f0eb",
                                    fontFamily: "inherit",
                                    fontSize: 13,
                                    padding: "0 14px",
                                    outline: "none",
                                  }}
                                  data-testid={`input-${question.id}`}
                                />
                              </div>
                            )}

                            {/* Fallback: textarea for any other type */}
                            {question.type !== "slider" && question.type !== "single-select" && question.type !== "multi-select" && question.type !== "text" && (
                              <textarea
                                value={(surveyResponses[question.id] as string) || ""}
                                onChange={(e) => handleSurveyResponseChange(question.id, e.target.value)}
                                placeholder="Type your answer..."
                                rows={3}
                                style={{
                                  width: "100%",
                                  background: "#1a1714",
                                  border: "1px solid rgba(200,180,160,0.08)",
                                  borderRadius: 8,
                                  color: "#f5f0eb",
                                  fontFamily: "inherit",
                                  fontSize: 13,
                                  padding: "12px 14px",
                                  outline: "none",
                                  resize: "vertical",
                                }}
                                data-testid={`textarea-${question.id}`}
                              />
                            )}

                            {/* N/A + notes row */}
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(200,180,160,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <button
                                  onClick={() => handleMarkNA(question.id)}
                                  style={{
                                    background: "none", border: "none",
                                    color: "#6b5d52", fontSize: 11, cursor: "pointer",
                                    fontFamily: "inherit", padding: 0,
                                  }}
                                  data-testid={`button-na-${question.id}`}
                                >
                                  Mark N/A
                                </button>
                              </div>
                              <textarea
                                value={(surveyResponses[`${question.id}_note`] as string) || ""}
                                onChange={(e) => handleFreeformNoteChange(question.id, e.target.value)}
                                placeholder="Additional notes (optional)..."
                                rows={2}
                                style={{
                                  width: "100%",
                                  background: "#1a1714",
                                  border: "1px solid rgba(200,180,160,0.06)",
                                  borderRadius: 6,
                                  color: "#a89a8c",
                                  fontFamily: "inherit",
                                  fontSize: 12,
                                  padding: "8px 10px",
                                  outline: "none",
                                  resize: "none",
                                }}
                                data-testid={`input-note-${question.id}`}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Bottom bar ── */}
          {!isGeneratingDocs && (
            <div
              style={{
                position: "sticky",
                bottom: 0,
                borderTop: "1px solid rgba(200,180,160,0.08)",
                background: "#231f1b",
                padding: "14px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                zIndex: 10,
              }}
              className="survey-bottom-bar"
            >
              <button
                onClick={() => setCurrentSectionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentSectionIndex === 0}
                style={{
                  background: "none", border: "none",
                  color: currentSectionIndex === 0 ? "#3d3530" : "#a89a8c",
                  fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                  cursor: currentSectionIndex === 0 ? "default" : "pointer",
                  padding: "6px 0",
                }}
                data-testid="button-prev-section"
              >
                Back
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {!isLastSection && (
                  <button
                    onClick={handleSkipSection}
                    style={{
                      background: "none", border: "none",
                      color: "#6b5d52", fontSize: 12, fontFamily: "inherit",
                      cursor: "pointer", padding: "6px 0",
                    }}
                    data-testid="button-skip-section"
                  >
                    Skip
                  </button>
                )}

                {isLastSection ? (
                  <button
                    onClick={handleReadyToGenerate}
                    disabled={autoSaveSurveyMutation.isPending}
                    style={{
                      height: 40, padding: "0 24px",
                      borderRadius: 10, border: "none",
                      background: "#f0b65e", color: "#1a1208",
                      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      opacity: autoSaveSurveyMutation.isPending ? 0.6 : 1,
                    }}
                    data-testid="button-submit-survey"
                  >
                    Generate Documents
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleNextSection}
                    disabled={autoSaveSurveyMutation.isPending}
                    style={{
                      height: 40, padding: "0 24px",
                      borderRadius: 10, border: "none",
                      background: "#f0b65e", color: "#1a1208",
                      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                      cursor: autoSaveSurveyMutation.isPending ? "default" : "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      opacity: autoSaveSurveyMutation.isPending ? 0.6 : 1,
                    }}
                    data-testid="button-next-section"
                  >
                    {autoSaveSurveyMutation.isPending ? (
                      <>
                        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        Saving...
                      </>
                    ) : (
                      <>
                        {nextSectionTitle ? `Next: ${nextSectionTitle}` : "Next"}
                        <ChevronRight size={14} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Root render ────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: surveyPhase === "survey" ? "#110f0d" : undefined,
      }}
      className={surveyPhase !== "survey" ? "min-h-screen bg-surface-secondary flex flex-col" : ""}
    >
      {/* Discovery phase uses original header; survey phase sidebar has back button */}
      {surveyPhase === "discovery" && (
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
                  Quick discovery chat before your personalized survey
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowPromptsSection(true)}
                className="min-h-[44px] shrink-0"
                data-testid="button-manage-prompts"
              >
                <Sparkles className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Prompts</span>
                {customPrompts.length > 0 && (
                  <span className="ml-1 sm:ml-2 bg-accent text-surface-primary text-xs px-2 py-0.5 rounded-full">
                    {customPrompts.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                className="min-h-[44px] shrink-0"
                data-testid="button-save-project"
              >
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Save Project</span>
              </Button>
            </div>
          </div>
        </header>
      )}

      {surveyPhase === "discovery" && project && (
        <div className="bg-surface-tertiary border-b border-gray-100 px-6 py-2">
          <div className="max-w-4xl mx-auto">
            <p className="text-metadata text-contrast-medium" data-testid="text-project-name">
              Working on: <span className="font-medium text-contrast-high">{project.name || "Untitled Project"}</span>
            </p>
          </div>
        </div>
      )}

      <main
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
        className={surveyPhase !== "survey" ? "flex-1 flex flex-col max-w-4xl w-full mx-auto" : ""}
      >
        {surveyPhase === "discovery" ? renderDiscoveryPhase() : renderSurveyPhase()}
      </main>

      {/* Responsive CSS for survey wizard */}
      <style>{`
        @media (max-width: 768px) {
          .survey-sidebar {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            bottom: 0 !important;
            z-index: 101 !important;
          }
          .survey-mobile-topbar {
            display: flex !important;
          }
          .survey-step-dots {
            display: flex !important;
          }
          .survey-content-scroll {
            padding: 28px 20px 110px !important;
          }
          .survey-chip-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .survey-bottom-bar {
            padding: 12px 20px !important;
          }
        }
      `}</style>

      {/* ── Dialogs (all preserved) ── */}

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

      {/* Document Selection Dialog */}
      <Dialog open={showDocumentSelection} onOpenChange={setShowDocumentSelection}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ready to Generate Documentation</DialogTitle>
            <DialogDescription>
              Select which documents you want to generate and choose the detail level for each.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-description text-contrast-medium">
                {selectedCount} of {stages.length} documents selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newSelections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }> = {};
                    stages.forEach(stage => {
                      newSelections[stage.id] = {
                        selected: true,
                        detailLevel: documentSelections[stage.id]?.detailLevel || "detailed"
                      };
                    });
                    setDocumentSelections(newSelections);
                  }}
                  data-testid="button-select-all"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newSelections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }> = {};
                    stages.forEach(stage => {
                      newSelections[stage.id] = {
                        selected: false,
                        detailLevel: documentSelections[stage.id]?.detailLevel || "detailed"
                      };
                    });
                    setDocumentSelections(newSelections);
                  }}
                  data-testid="button-deselect-all"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {stages
                .sort((a, b) => a.stageNumber - b.stageNumber)
                .map((stage) => (
                  <div
                    key={stage.id}
                    className={`bg-surface-secondary rounded-lg p-4 border transition-colors ${
                      documentSelections[stage.id]?.selected
                        ? "border-accent bg-accent/5"
                        : "border-gray-200"
                    }`}
                    data-testid={`doc-selection-${stage.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id={`doc-${stage.id}`}
                        checked={documentSelections[stage.id]?.selected || false}
                        onCheckedChange={(checked) => {
                          setDocumentSelections(prev => ({
                            ...prev,
                            [stage.id]: {
                              selected: !!checked,
                              detailLevel: prev[stage.id]?.detailLevel || "detailed"
                            }
                          }));
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`doc-${stage.id}`}
                          className="text-description font-medium text-contrast-high cursor-pointer"
                        >
                          {stage.title}
                        </Label>
                        <p className="text-metadata text-contrast-medium mt-1">
                          {stage.description}
                        </p>

                        {documentSelections[stage.id]?.selected && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-metadata text-contrast-medium">Detail level:</span>
                            <div className="flex rounded-lg overflow-hidden border border-gray-200">
                              <button
                                type="button"
                                onClick={() => setDocumentSelections(prev => ({
                                  ...prev,
                                  [stage.id]: {
                                    selected: prev[stage.id]?.selected ?? true,
                                    detailLevel: "summary"
                                  }
                                }))}
                                className={`px-3 py-1.5 text-sm transition-colors ${
                                  documentSelections[stage.id]?.detailLevel === "summary"
                                    ? "bg-accent text-white"
                                    : "bg-surface-primary text-contrast-medium hover:bg-surface-secondary"
                                }`}
                                data-testid={`button-summary-${stage.id}`}
                              >
                                Summary
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocumentSelections(prev => ({
                                  ...prev,
                                  [stage.id]: {
                                    selected: prev[stage.id]?.selected ?? true,
                                    detailLevel: "detailed"
                                  }
                                }))}
                                className={`px-3 py-1.5 text-sm transition-colors ${
                                  documentSelections[stage.id]?.detailLevel === "detailed"
                                    ? "bg-accent text-white"
                                    : "bg-surface-primary text-contrast-medium hover:bg-surface-secondary"
                                }`}
                                data-testid={`button-detailed-${stage.id}`}
                              >
                                Detailed
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="ghost" onClick={() => setShowDocumentSelection(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmGenerate}
                disabled={selectedCount === 0}
                className="btn-primary"
                data-testid="button-confirm-generate"
              >
                Generate {selectedCount} Document{selectedCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
