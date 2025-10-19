import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Stage, Message } from "@shared/schema";

export default function InterviewPage() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
      if (!prdStage) return null;
      const res = await apiRequest("POST", `/api/stages/${prdStage.id}/messages`, {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      if (!prdStage) return;
      queryClient.invalidateQueries({ queryKey: ["/api/stages", prdStage.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stages", prdStage.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      setInputValue("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !sendMessageMutation.isPending && prdStage) {
      sendMessageMutation.mutate(inputValue.trim());
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!project || !prdStage) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

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
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-h3 font-medium text-contrast-high">PRD Interview</h1>
              <p className="text-description text-contrast-medium">
                Answer questions to build your Product Requirements Document
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-surface-primary text-description font-medium">
                AI
              </div>
              <div className="flex-1 bg-surface-primary rounded-lg p-4 border border-gray-200">
                <p className="text-description text-contrast-high leading-relaxed">
                  Hi! I'll help you build comprehensive product documentation through conversation.
                  By the end, you'll have a complete PRD, architecture design, coding prompts, 
                  and development guide.
                </p>
                <p className="text-description text-contrast-high leading-relaxed mt-3">
                  Let's start: <strong>What product are you building, and what problem does it solve?</strong>
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

        <div className="border-t border-gray-200 p-6 bg-surface-primary">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <Input
              type="text"
              placeholder="Type your answer..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 min-h-[44px]"
              disabled={sendMessageMutation.isPending}
              data-testid="input-interview-message"
            />
            <Button
              type="submit"
              className="btn-primary min-h-[44px] min-w-[44px]"
              disabled={!inputValue.trim() || sendMessageMutation.isPending}
              data-testid="button-send-interview-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
