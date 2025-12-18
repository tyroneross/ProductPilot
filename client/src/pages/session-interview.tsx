import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Save } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, Stage, Message } from "@shared/schema";

export default function SessionInterviewPage() {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const productIdea = sessionStorage.getItem("productIdea") || "";

  // Get or create project
  const { data: project } = useQuery<Project>({
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

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // If no project exists yet, create one first
      if (!projectId) {
        const res = await apiRequest("POST", "/api/projects", {
          name: `Untitled - ${new Date().toLocaleTimeString()}`,
          description: productIdea.slice(0, 200),
          mode: "interview",
          aiModel: "claude-sonnet",
        });
        const newProject = await res.json();
        setProjectId(newProject.id);
        sessionStorage.setItem("interviewProjectId", newProject.id);
        
        // Wait for stages to be created
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the PRD stage
        const stagesRes = await apiRequest("GET", `/api/projects/${newProject.id}/stages`, {});
        const stages = await stagesRes.json();
        const prd = stages.find((s: Stage) => s.stageNumber === 2);
        
        if (!prd) throw new Error("PRD stage not found");
        
        // Send the message to the PRD stage
        const msgRes = await apiRequest("POST", `/api/stages/${prd.id}/messages`, {
          role: "user",
          content,
        });
        return msgRes.json();
      }
      
      if (!prdStage) return null;
      const res = await apiRequest("POST", `/api/stages/${prdStage.id}/messages`, {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      // Always invalidate queries to show the user message, even if AI failed
      if (projectId && prdStage) {
        queryClient.invalidateQueries({ queryKey: ["/api/stages", prdStage.id, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stages", prdStage.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      // Check if AI response failed (backend returns userMessage but aiMessage is null)
      if (data && data.userMessage && !data.aiMessage) {
        toast({
          title: "AI service error",
          description: data.error || "AI is temporarily unavailable. Please try again.",
          variant: "destructive",
        });
        // Don't clear input on AI failure so user can retry
        return;
      }
      
      // Only clear input if AI responded successfully
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

  const saveProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      // If project exists, update it; otherwise create new
      if (projectId) {
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
          name: name || project?.name || `Untitled Project`,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/projects", {
          name: name || `Untitled Project ${new Date().toLocaleDateString()}`,
          description: productIdea.slice(0, 200),
          mode: "interview",
          aiModel: "claude-sonnet",
        });
        const newProject = await res.json();
        setProjectId(newProject.id);
        sessionStorage.setItem("interviewProjectId", newProject.id);
        return newProject;
      }
    },
    onSuccess: (updatedProject: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setShowSaveDialog(false);
      toast({
        title: "Project saved!",
        description: `"${updatedProject.name}" has been saved successfully.`,
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

  const handleSave = () => {
    setShowSaveDialog(true);
  };

  const handleSaveWithName = () => {
    if (projectName.trim()) {
      saveProjectMutation.mutate(projectName);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canChat = projectId && prdStage;

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
              <h1 className="text-h3 font-medium text-contrast-high">Interview Mode</h1>
              <p className="text-description text-contrast-medium">
                Answer questions to build your Product Requirements Document
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!canChat ? (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
                AI
              </div>
              <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200">
                <p className="text-description text-contrast-high leading-relaxed">
                  Hi! I'll help you build comprehensive product documentation. You mentioned: <strong>"{productIdea}"</strong>
                </p>
                <p className="text-description text-contrast-high leading-relaxed mt-3">
                  Send your first message to get started, and I'll ask questions to understand your product better.
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
                AI
              </div>
              <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200">
                <p className="text-description text-contrast-high leading-relaxed">
                  Hi! I'll help you build comprehensive product documentation through conversation.
                  I see you want to build: <strong>"{productIdea}"</strong>
                </p>
                <p className="text-description text-contrast-high leading-relaxed mt-3">
                  Let's start: <strong>Who are the primary users and what problem are they facing?</strong>
                </p>
              </div>
            </div>
          ) : (
            messages.map((message: Message) => (
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
            ))
          )}

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

        <div className="border-t border-gray-200 p-4 md:p-6 bg-surface-primary sticky bottom-0 z-10">
          <form onSubmit={handleSubmit} className="flex space-x-2 md:space-x-3">
            <Input
              type="text"
              placeholder="Type your answer..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 min-h-[44px] text-base"
              disabled={sendMessageMutation.isPending}
              data-testid="input-interview-message"
              autoComplete="off"
            />
            <Button
              type="submit"
              className="btn-primary min-h-[44px] min-w-[44px] shrink-0"
              disabled={!inputValue.trim() || sendMessageMutation.isPending}
              data-testid="button-send-interview-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
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
