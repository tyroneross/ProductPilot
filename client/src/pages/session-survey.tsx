import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, ChevronRight, Check, Palette, Users, Zap, Shield, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** Extract the human-readable error message from an API error */
function getErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonMatch = raw.match(/\d+:\s*(\{.*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.message) return parsed.message;
    } catch { /* fall through */ }
  }
  return raw;
}

// CAT question types from the backend
interface CATOption {
  value: string;
  label: string;
  description?: string;
}

interface CATQuestion {
  id: string;
  dimension: string;
  type: "slider" | "single-select" | "multi-select" | "free-text" | "visual-select";
  label: string;
  description?: string;
  options?: CATOption[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

interface CATSurvey {
  dimensionScores: Record<string, number>;
  questions: CATQuestion[];
  reasoning: string;
}

interface ConfirmationQuestion {
  question: string;
  dimension: string;
  reason: string;
  options?: string[];
}

// Visual style families with icons
const STYLE_ICONS: Record<string, React.ReactNode> = {
  clean: <Shield className="w-6 h-6" />,
  warm: <Sun className="w-6 h-6" />,
  bold: <Zap className="w-6 h-6" />,
  dark: <Palette className="w-6 h-6" />,
  bright: <Users className="w-6 h-6" />,
};

type Phase = "loading" | "survey" | "confirming" | "confirmation" | "generating";

export default function SessionSurveyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Core state
  const [phase, setPhase] = useState<Phase>("loading");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [catSurvey, setCatSurvey] = useState<CATSurvey | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [confirmation, setConfirmation] = useState<ConfirmationQuestion | null>(null);
  const [confirmationAnswer, setConfirmationAnswer] = useState("");

  // Generation progress
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 7, stageName: "Starting..." });

  // Prevent double-initialization
  const initialized = useRef(false);

  // Parse projectId from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlProjectId = params.get("projectId");
    if (urlProjectId) {
      setProjectId(urlProjectId);
    }
  }, []);

  // Generate CAT survey once projectId is ready
  useEffect(() => {
    if (!projectId || initialized.current) return;
    initialized.current = true;

    const seedRaw = sessionStorage.getItem("seedAnswers");
    if (!seedRaw) {
      toast({ title: "Missing seed answers", description: "Please start from the details page.", variant: "destructive" });
      setLocation("/details");
      return;
    }

    const seed = JSON.parse(seedRaw);
    generateCATSurvey(seed.pitch, seed.v1Scope, seed.platform);
  }, [projectId]);

  const generateCATSurvey = useCallback(async (pitch: string, v1Scope: string, platform: string) => {
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/generate-cat-survey`, {
        pitch, v1Scope, platform,
      });
      const survey: CATSurvey = await res.json();
      setCatSurvey(survey);
      setPhase("survey");
    } catch (error) {
      toast({ title: "Failed to generate survey", description: getErrorMessage(error), variant: "destructive" });
    }
  }, [projectId, toast]);

  // Update a response value
  const handleResponseChange = useCallback((questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  }, []);

  // Mark a question as N/A
  const handleMarkNA = useCallback((questionId: string) => {
    setResponses(prev => ({ ...prev, [questionId]: "__NA__" }));
  }, []);

  // Undo N/A
  const handleUndoNA = useCallback((questionId: string) => {
    setResponses(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  // Submit CAT survey → get confirmation question
  const handleSubmitSurvey = useCallback(async () => {
    setPhase("confirming");
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/cat-confirm`, {
        catResponses: responses,
      });
      const confirmQ: ConfirmationQuestion = await res.json();
      setConfirmation(confirmQ);
      setPhase("confirmation");
    } catch (error) {
      toast({ title: "Failed to generate confirmation", description: getErrorMessage(error), variant: "destructive" });
      // Skip confirmation and go straight to generation
      handleGenerate("");
    }
  }, [projectId, responses, toast]);

  // Generate all documents
  const handleGenerate = useCallback(async (answer: string) => {
    setPhase("generating");
    setGenerationProgress({ current: 0, total: 7, stageName: "Starting..." });

    // Poll for stage progress
    let complete = false;
    const pollInterval = setInterval(async () => {
      if (complete) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/stages`);
        if (res.ok) {
          const stages = await res.json();
          const completedCount = stages.filter((s: any) => s.progress === 100).length;
          const inProgress = stages.find((s: any) => s.progress > 0 && s.progress < 100);
          const next = stages.find((s: any) => s.progress === 0);
          setGenerationProgress({
            current: completedCount,
            total: stages.length,
            stageName: inProgress?.title || next?.title || "Finishing up...",
          });

          if (completedCount === stages.length && stages.length > 0) {
            complete = true;
            clearInterval(pollInterval);
            toast({ title: "Documentation generated!", description: "Your complete product documentation is ready." });
            setLocation(`/documents/${projectId}`);
          }
        }
      } catch { /* ignore polling errors */ }
    }, 2000);

    try {
      await apiRequest("POST", `/api/projects/${projectId}/generate-docs-from-cat`, {
        catResponses: responses,
        confirmationAnswer: answer,
      });

      // API returned — check one more time
      if (!complete) {
        complete = true;
        clearInterval(pollInterval);
        toast({ title: "Documentation generated!", description: "Your complete product documentation is ready." });
        setLocation(`/documents/${projectId}`);
      }
    } catch (error) {
      clearInterval(pollInterval);
      if (!complete) {
        setPhase("survey");
        toast({ title: "Generation failed", description: getErrorMessage(error), variant: "destructive" });
      }
    }
  }, [projectId, responses, toast, setLocation]);

  // Count how many questions have been answered
  const answeredCount = catSurvey
    ? catSurvey.questions.filter(q => responses[q.id] !== undefined).length
    : 0;
  const totalQuestions = catSurvey?.questions.length || 0;

  const progressPercent = generationProgress.total > 0
    ? Math.round((generationProgress.current / generationProgress.total) * 100)
    : 0;

  // Render a single question based on its type
  const renderQuestion = (question: CATQuestion) => {
    const value = responses[question.id];
    const isNA = value === "__NA__";

    return (
      <div key={question.id} className="bg-surface-primary rounded-lg border border-gray-200 p-6">
        <div className="mb-1">
          <span className="text-xs uppercase tracking-wide text-accent font-medium">
            {question.dimension.replace(/_/g, " ")}
          </span>
        </div>
        <Label className="text-description font-medium text-contrast-high mb-1 block">
          {question.label}
        </Label>
        {question.description && (
          <p className="text-metadata text-contrast-medium mb-4">{question.description}</p>
        )}

        {isNA ? (
          <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
            <span className="text-contrast-medium text-sm">Marked as N/A</span>
            <Button variant="ghost" size="sm" onClick={() => handleUndoNA(question.id)}>
              Undo
            </Button>
          </div>
        ) : (
          <>
            {question.type === "visual-select" && question.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {question.options.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleResponseChange(question.id, opt.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      value === opt.value
                        ? "border-accent bg-accent/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        value === opt.value ? "bg-accent text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {STYLE_ICONS[opt.value] || <Palette className="w-5 h-5" />}
                      </div>
                      {value === opt.value && <Check className="w-4 h-4 text-accent ml-auto" />}
                    </div>
                    <p className="text-sm font-medium text-contrast-high">{opt.label}</p>
                    {opt.description && (
                      <p className="text-xs text-contrast-medium mt-1">{opt.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {question.type === "single-select" && question.options && (
              <RadioGroup
                value={typeof value === "string" ? value : ""}
                onValueChange={v => handleResponseChange(question.id, v)}
                className="space-y-2"
              >
                {question.options.map(opt => (
                  <div key={opt.value} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-surface-secondary">
                    <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={`${question.id}-${opt.value}`} className="text-description text-contrast-high cursor-pointer block">
                        {opt.label}
                      </Label>
                      {opt.description && (
                        <p className="text-metadata text-contrast-medium mt-0.5">{opt.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.type === "multi-select" && question.options && (
              <div className="space-y-2">
                {question.options.map(opt => {
                  const currentValues: string[] = Array.isArray(value) ? value : [];
                  const isChecked = currentValues.includes(opt.value);
                  return (
                    <div key={opt.value} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-surface-secondary">
                      <Checkbox
                        id={`${question.id}-${opt.value}`}
                        checked={isChecked}
                        onCheckedChange={checked => {
                          if (checked) {
                            handleResponseChange(question.id, [...currentValues, opt.value]);
                          } else {
                            handleResponseChange(question.id, currentValues.filter(v => v !== opt.value));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor={`${question.id}-${opt.value}`} className="text-description text-contrast-high cursor-pointer block">
                          {opt.label}
                        </Label>
                        {opt.description && (
                          <p className="text-metadata text-contrast-medium mt-0.5">{opt.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {question.type === "slider" && (
              <div className="space-y-4 pt-2">
                <Slider
                  value={[typeof value === "number" ? value : (question.min || 1)]}
                  onValueChange={([v]) => handleResponseChange(question.id, v)}
                  min={question.min || 1}
                  max={question.max || 5}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-metadata text-contrast-medium">
                  <span>{question.minLabel || question.min}</span>
                  <span className="text-accent font-medium">
                    {typeof value === "number" ? value : "-"}
                  </span>
                  <span>{question.maxLabel || question.max}</span>
                </div>
              </div>
            )}

            {question.type === "free-text" && (
              <Textarea
                value={typeof value === "string" ? value : ""}
                onChange={e => handleResponseChange(question.id, e.target.value)}
                placeholder="Type your answer..."
                className="min-h-[80px] resize-none"
              />
            )}

            <div className="mt-3 pt-3 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkNA(question.id)}
                className="text-contrast-medium hover:text-contrast-high text-xs"
              >
                Not applicable
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-surface-primary px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/details")}
              className="min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base font-medium text-contrast-high">Personalized Questions</h1>
              <p className="text-sm text-contrast-medium">
                {phase === "loading" && "Analyzing your answers..."}
                {phase === "survey" && `${answeredCount} of ${totalQuestions} answered`}
                {phase === "confirming" && "Generating final question..."}
                {phase === "confirmation" && "One last thing before we generate"}
                {phase === "generating" && "Generating your documentation..."}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      {phase === "survey" && totalQuestions > 0 && (
        <div className="bg-surface-primary border-b border-gray-100 px-6 py-2">
          <div className="max-w-3xl mx-auto">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((answeredCount / totalQuestions) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Loading phase */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
              <p className="text-description text-contrast-medium">
                Analyzing your product to create targeted questions...
              </p>
              <p className="text-metadata text-contrast-medium mt-2">
                This takes a few seconds
              </p>
            </div>
          )}

          {/* Survey phase — all questions on one screen */}
          {phase === "survey" && catSurvey && (
            <>
              <div className="mb-8">
                <h2 className="text-lg font-medium text-contrast-high mb-2">
                  A few targeted questions
                </h2>
                <p className="text-sm text-contrast-medium">
                  Based on your pitch, we identified {catSurvey.questions.length} areas that need more detail.
                  Answer what you can — skip anything that doesn't apply.
                </p>
              </div>

              <div className="space-y-6">
                {catSurvey.questions.map(renderQuestion)}
              </div>

              {/* Submit CTA */}
              <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-end gap-3">
                <Button
                  onClick={handleSubmitSurvey}
                  className="btn-primary min-h-[44px] w-full sm:w-auto px-8"
                  disabled={answeredCount === 0}
                >
                  Next: Final Check
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {/* Confirming phase — loading state */}
          {phase === "confirming" && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
              <p className="text-description text-contrast-medium">
                Identifying remaining gaps...
              </p>
            </div>
          )}

          {/* Confirmation phase — single targeted question */}
          {phase === "confirmation" && confirmation && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-8">
                <h2 className="text-lg font-medium text-contrast-high mb-2">
                  One last question
                </h2>
                <p className="text-sm text-contrast-medium">
                  {confirmation.reason}
                </p>
              </div>

              <div className="bg-surface-primary rounded-lg border border-gray-200 p-6">
                <Label className="text-description font-medium text-contrast-high mb-4 block">
                  {confirmation.question}
                </Label>

                {confirmation.options && confirmation.options.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    <RadioGroup
                      value={confirmationAnswer}
                      onValueChange={setConfirmationAnswer}
                      className="space-y-2"
                    >
                      {confirmation.options.map(opt => (
                        <div key={opt} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-surface-secondary">
                          <RadioGroupItem value={opt} id={`confirm-${opt}`} />
                          <Label htmlFor={`confirm-${opt}`} className="text-description text-contrast-high cursor-pointer flex-1">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    <Textarea
                      value={confirmationAnswer}
                      onChange={e => setConfirmationAnswer(e.target.value)}
                      placeholder="Or type your own answer..."
                      className="min-h-[60px] resize-none mt-3"
                    />
                  </div>
                ) : (
                  <Textarea
                    value={confirmationAnswer}
                    onChange={e => setConfirmationAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="min-h-[80px] resize-none"
                  />
                )}
              </div>

              <div className="mt-8 flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={() => handleGenerate("")}
                  className="text-contrast-medium"
                >
                  Skip & Generate
                </Button>
                <Button
                  onClick={() => handleGenerate(confirmationAnswer)}
                  className="btn-primary px-8"
                  disabled={!confirmationAnswer.trim()}
                >
                  Generate All Documents
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Generation progress overlay */}
      {phase === "generating" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-primary rounded-xl p-4 sm:p-8 max-w-sm sm:max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-accent" />
              <h3 className="text-base font-medium text-contrast-high mb-2">
                Generating Documentation
              </h3>
              <p className="text-sm text-contrast-medium">{generationProgress.stageName}</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-contrast-medium">
                <span>Progress</span>
                <span>{generationProgress.current} of {generationProgress.total} documents</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-contrast-medium text-center mt-4">
                This may take a minute...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
