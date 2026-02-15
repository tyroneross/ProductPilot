import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Sparkles, ArrowRight, Loader2, Upload, Lightbulb, Rocket, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** Extract the human-readable error message from an API error */
function getErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // apiRequest throws "500: {\"message\":\"...\"}" — parse the JSON part
  const jsonMatch = raw.match(/\d+:\s*(\{.*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.message) return parsed.message;
    } catch { /* fall through */ }
  }
  return raw;
}

const PLATFORMS = [
  { value: "web", label: "Web App", description: "Browser-based application" },
  { value: "mobile", label: "Mobile App", description: "iOS and/or Android" },
  { value: "both", label: "Both", description: "Responsive web + mobile" },
  { value: "desktop", label: "Desktop / Local", description: "Local-first native app" },
  { value: "api", label: "API / Backend", description: "Service or API only" },
] as const;

type SolutionApproach = {
  id: string;
  title: string;
  summary: string;
  keyFeatures: string[];
  techDirection?: string;
};

export default function DetailsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Entry mode
  const [activeTab, setActiveTab] = useState<"problem" | "idea" | "upload">("idea");

  // Seed questions (shared pipeline)
  const [pitch, setPitch] = useState("");
  const [v1Scope, setV1Scope] = useState("");
  const [platform, setPlatform] = useState("");

  // Entry B: Problem mode
  const [problemDescription, setProblemDescription] = useState("");
  const [approaches, setApproaches] = useState<SolutionApproach[]>([]);
  const [selectedApproach, setSelectedApproach] = useState<string | null>(null);
  const [isProposing, setIsProposing] = useState(false);

  // Entry C: Upload mode
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedConfidence, setExtractedConfidence] = useState<Record<string, number>>({});

  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canProceed = pitch.trim().length >= 20 && v1Scope.trim().length >= 15 && platform;

  // Entry B: Ask AI to propose solutions
  const handleProposeSolutions = useCallback(async () => {
    if (!problemDescription.trim()) return;
    setIsProposing(true);
    try {
      // Create a draft project first
      const projectRes = await apiRequest("POST", "/api/projects", {
        name: problemDescription.substring(0, 50) + "...",
        description: problemDescription,
        mode: "survey",
        entryMode: "problem",
      });
      const project = await projectRes.json();
      sessionStorage.setItem("surveyProjectId", project.id);

      const res = await apiRequest("POST", `/api/projects/${project.id}/propose-solutions`, {
        problemDescription,
      });
      const proposal = await res.json();
      setApproaches(proposal.approaches || []);
    } catch (error) {
      toast({ title: "Failed to analyze problem", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsProposing(false);
    }
  }, [problemDescription, toast]);

  // Entry B: Select an approach
  const handleSelectApproach = (approach: SolutionApproach) => {
    setSelectedApproach(approach.id);
    setPitch(`${approach.title}: ${approach.summary}`);
    setV1Scope(approach.keyFeatures.join(". ") + ".");
    setActiveTab("idea"); // Switch to idea tab with pre-filled data
  };

  // Entry C: Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (file.size > 50000) {
      toast({ title: "File too large", description: "Max 50KB", variant: "destructive" });
      return;
    }
    setIsExtracting(true);
    setUploadedFileName(file.name);
    try {
      const content = await file.text();

      // Create project and extract
      const projectRes = await apiRequest("POST", "/api/projects", {
        name: file.name.replace(/\.\w+$/, ""),
        description: "Uploaded document",
        mode: "survey",
        entryMode: "upload",
      });
      const project = await projectRes.json();
      sessionStorage.setItem("surveyProjectId", project.id);

      const res = await apiRequest("POST", `/api/projects/${project.id}/extract-from-doc`, {
        documentContent: content,
        fileName: file.name,
      });
      const extracted = await res.json();

      setPitch(extracted.pitch || "");
      setV1Scope(extracted.v1Scope || "");
      setPlatform(extracted.platform || "");
      setExtractedConfidence(extracted.confidence || {});

      toast({ title: "Document analyzed", description: "Review the extracted details below." });
      setActiveTab("idea");
    } catch (error) {
      toast({ title: "Failed to process file", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }, [toast]);

  // Submit seed answers and go to CAT survey
  const handleNext = useCallback(async () => {
    setIsSubmitting(true);
    try {
      let projectId = sessionStorage.getItem("surveyProjectId");

      // Create project if not yet created (Entry A direct path)
      if (!projectId) {
        const projectRes = await apiRequest("POST", "/api/projects", {
          name: pitch.substring(0, 50) + (pitch.length > 50 ? "..." : ""),
          description: v1Scope,
          mode: "survey",
          entryMode: activeTab,
          minimumDetails: { pitch, v1Scope, platform },
        });
        const project = await projectRes.json();
        projectId = project.id;
        sessionStorage.setItem("surveyProjectId", projectId!);
      } else {
        // Update existing project with seed answers
        await apiRequest("PATCH", `/api/projects/${projectId}`, {
          minimumDetails: { pitch, v1Scope, platform },
        });
      }

      // Store in session for the CAT survey page
      sessionStorage.setItem("seedAnswers", JSON.stringify({ pitch, v1Scope, platform }));

      setLocation(`/session/survey?projectId=${projectId}`);
    } catch (error) {
      toast({ title: "Something went wrong", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [pitch, v1Scope, platform, activeTab, setLocation, toast]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-accent rounded-full mb-4">
            <Sparkles className="w-6 h-6 text-surface-primary" />
          </div>
          <h1 className="text-h3 font-medium text-contrast-high mb-2">
            What are we building?
          </h1>
          <p className="text-description text-contrast-medium">
            Start from a problem, an idea, or an existing spec
          </p>
        </div>

        {/* Three-tab entry point */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="problem" className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Problem
            </TabsTrigger>
            <TabsTrigger value="idea" className="flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Idea
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Spec
            </TabsTrigger>
          </TabsList>

          {/* ENTRY B: Problem tab */}
          <TabsContent value="problem">
            <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 space-y-4">
              <div>
                <Label className="text-title font-medium text-contrast-high mb-2 block">
                  Describe your problem
                </Label>
                <p className="text-metadata text-contrast-medium mb-2">
                  Who has this problem, and what happens when it's not solved?
                </p>
                <Textarea
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="e.g., Small business owners waste hours every week manually tracking inventory across spreadsheets. They lose money from stockouts and overorders because they can't see real-time levels."
                  className="min-h-[120px]"
                />
              </div>

              <Button
                onClick={handleProposeSolutions}
                disabled={problemDescription.trim().length < 20 || isProposing}
                className="btn-primary w-full min-h-[44px]"
              >
                {isProposing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing your problem...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Suggest approaches
                  </>
                )}
              </Button>

              {/* Solution approach cards */}
              {approaches.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-title font-medium text-contrast-high">
                    Pick an approach or write your own
                  </p>
                  {approaches.map((approach) => (
                    <button
                      key={approach.id}
                      onClick={() => handleSelectApproach(approach)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        selectedApproach === approach.id
                          ? "border-accent bg-accent/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-title font-medium text-contrast-high">{approach.title}</p>
                          <p className="text-description text-contrast-medium mt-1">{approach.summary}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {approach.keyFeatures.map((f, i) => (
                              <span key={i} className="text-metadata text-contrast-medium bg-gray-100 px-2 py-0.5 rounded">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                        {selectedApproach === approach.id && (
                          <Check className="w-5 h-5 text-accent shrink-0 mt-1" />
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedApproach(null);
                      setActiveTab("idea");
                    }}
                    className="w-full text-left p-4 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                  >
                    <p className="text-description text-contrast-medium text-center">
                      Write your own approach instead
                    </p>
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ENTRY A: Idea tab (also receives pre-fills from Problem and Upload) */}
          <TabsContent value="idea">
            <div className="bg-surface-primary rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Confidence indicators for extracted content */}
              {Object.keys(extractedConfidence).length > 0 && (
                <div className="flex items-center gap-2 text-metadata text-contrast-medium bg-blue-50 p-3 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Pre-filled from <strong>{uploadedFileName}</strong>. Review and edit as needed.</span>
                </div>
              )}

              {/* Q1: The Pitch */}
              <div>
                <Label className="text-title font-medium text-contrast-high mb-2 block">
                  Describe what you're building
                </Label>
                <p className="text-metadata text-contrast-medium mb-2">
                  Who is it for, what problem does it solve, and how? (2-3 sentences)
                </p>
                <Textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="e.g., I'm building a habit tracker for people who want to build daily routines. They struggle with existing apps that are too complex. My app makes it simple to track 3-5 habits per day."
                  className={`min-h-[100px] ${pitch.trim().length > 0 && pitch.trim().length < 20 ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                />
                <div className="flex justify-between mt-1">
                  {pitch.trim().length > 0 && pitch.trim().length < 20 ? (
                    <p className="text-metadata text-amber-600">A bit more detail will help generate better docs</p>
                  ) : <span />}
                  <span className={`text-metadata ${pitch.trim().length >= 20 ? "text-contrast-low" : "text-contrast-medium"}`}>
                    {pitch.trim().length}/20 min
                  </span>
                </div>
              </div>

              {/* Q2: V1 Scope */}
              <div>
                <Label className="text-title font-medium text-contrast-high mb-2 block">
                  What can a user do end-to-end in v1?
                </Label>
                <p className="text-metadata text-contrast-medium mb-2">
                  Walk through the main flow from start to finish
                </p>
                <Textarea
                  value={v1Scope}
                  onChange={(e) => setV1Scope(e.target.value)}
                  placeholder="e.g., A user creates a few habits, checks them off each day, and sees a streak chart showing their consistency over the past week. They can edit or delete habits. There's a simple daily reminder."
                  className={`min-h-[100px] ${v1Scope.trim().length > 0 && v1Scope.trim().length < 15 ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                />
                <div className="flex justify-between mt-1">
                  {v1Scope.trim().length > 0 && v1Scope.trim().length < 15 ? (
                    <p className="text-metadata text-amber-600">Describe at least the main user flow</p>
                  ) : <span />}
                  <span className={`text-metadata ${v1Scope.trim().length >= 15 ? "text-contrast-low" : "text-contrast-medium"}`}>
                    {v1Scope.trim().length}/15 min
                  </span>
                </div>
              </div>

              {/* Q3: Platform */}
              <div>
                <Label className="text-title font-medium text-contrast-high mb-2 block">
                  Where will people use this?
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={`p-3 rounded-lg border text-left transition-colors min-h-[44px] ${
                        platform === p.value
                          ? "border-accent bg-accent/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-description font-medium text-contrast-high">{p.label}</p>
                      <p className="text-metadata text-contrast-medium">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ENTRY C: Upload tab */}
          <TabsContent value="upload">
            <div className="bg-surface-primary rounded-lg border border-gray-200 p-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-upload")?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept=".txt,.md,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                {isExtracting ? (
                  <>
                    <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-description text-contrast-high font-medium">Analyzing {uploadedFileName}...</p>
                    <p className="text-metadata text-contrast-medium mt-1">Extracting product details from your document</p>
                  </>
                ) : uploadedFileName ? (
                  <>
                    <FileText className="w-8 h-8 text-accent mx-auto mb-3" />
                    <p className="text-description text-contrast-high font-medium">{uploadedFileName} uploaded</p>
                    <p className="text-metadata text-contrast-medium mt-1">Details extracted. Switch to Idea tab to review.</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-description text-contrast-high font-medium">Drop a file here or click to upload</p>
                    <p className="text-metadata text-contrast-medium mt-1">.txt, .md, or .pdf (max 50KB)</p>
                    <p className="text-metadata text-contrast-medium mt-3">
                      Upload a spec, notes, or prior research. We'll extract the key details.
                    </p>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* CTA: Proceed to personalized questions */}
        <div className="mt-8">
          <Button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="btn-primary min-h-[52px] w-full text-body"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Next: Personalized Questions
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          {!canProceed && (pitch || v1Scope || platform) && (
            <p className="text-metadata text-contrast-medium text-center mt-2">
              {activeTab !== "idea" ? "Switch to the Idea tab to complete required fields" :
                [
                  pitch.trim().length < 20 && "pitch (20+ chars)",
                  v1Scope.trim().length < 15 && "v1 scope (15+ chars)",
                  !platform && "platform selection",
                ].filter(Boolean).join(", ").replace(/^/, "Still needed: ")}
            </p>
          )}
        </div>

        <div className="mt-4" />
      </div>
    </div>
  );
}
