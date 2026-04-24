import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import WireframePreview from "@/components/wireframe-preview";
import type { Stage, Message } from "@shared/schema";

interface ChatInterfaceProps {
  stage: Stage;
}

export default function ChatInterface({ stage }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/stages", stage.id, "messages"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/stages/${stage.id}/messages`, {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stage.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stage.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", stage.projectId, "stages"] });
      setInputValue("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(inputValue.trim());
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const extractHTMLFromMessage = (content: string): string | null => {
    const htmlMatch = content.match(/```html\n([\s\S]*?)\n```/);
    if (htmlMatch) return htmlMatch[1];

    if (content.includes("<!DOCTYPE html") || content.includes("<html")) {
      return content;
    }

    return null;
  };

  // Parse trailing "Quick answers: A | B | C" line so we can render chips and
  // strip the directive from the visible message text. Mirrors the same helper
  // in session-survey.tsx — duplicated by design to keep this component standalone.
  const parseQuickAnswers = (content: string): { clean: string; chips: string[] } => {
    if (!content) return { clean: content, chips: [] };
    const match = content.match(/(^|\n)\s*Quick answers?:\s*([^\n]+)\s*$/i);
    if (!match) return { clean: content, chips: [] };
    const chips = match[2]
      .split(/\s*\|\s*|\s*•\s*|\s*;\s*/)
      .map((s) => s.trim().replace(/^["'`]|["'`]$/g, "").replace(/[.]+$/, ""))
      .filter((s) => s.length > 0 && s.length <= 40);
    const clean = content.slice(0, match.index ?? content.length).trim();
    const seen = new Set<string>();
    const uniqueChips: string[] = [];
    for (const c of chips) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniqueChips.push(c);
      if (uniqueChips.length >= 5) break;
    }
    return { clean, chips: uniqueChips };
  };

  const isUIDesignStage = stage.stageNumber === 3;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantChips = lastAssistant && !isUIDesignStage
    ? parseQuickAnswers(lastAssistant.content).chips
    : [];

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(90vh - 200px)" }}>
        {messages.length === 0 ? (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-surface-primary text-small font-medium">
              AI
            </div>
            <div className="flex-1 bg-surface-secondary rounded-lg p-3">
              <p className="text-small text-contrast-high">
                Ready to work on <strong>{stage.title.toLowerCase()}</strong>. Share the most recent decision or open question for this stage and I'll ask one focused question back.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message: Message) => {
            const htmlContent = isUIDesignStage && message.role === "assistant"
              ? extractHTMLFromMessage(message.content)
              : null;
            // Strip the "Quick answers:" directive before rendering the bubble text
            const displayContent = message.role === "assistant" && !htmlContent
              ? parseQuickAnswers(message.content).clean
              : message.content;

            return (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                data-testid={`message-${message.role}-${message.id}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-small font-medium ${
                    message.role === "user"
                      ? "bg-contrast-high text-surface-primary"
                      : "bg-accent text-surface-primary"
                  }`}
                >
                  {message.role === "user" ? "U" : "AI"}
                </div>
                <div
                  className={`flex-1 rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-accent text-surface-primary"
                      : "bg-surface-secondary text-contrast-high"
                  } ${htmlContent ? "max-w-none" : ""}`}
                >
                  {htmlContent ? (
                    <div className="space-y-3">
                      <p className="text-small whitespace-pre-wrap">{message.content.replace(/```html\n[\s\S]*?\n```/, "[See wireframe preview below]")}</p>
                      <div className="border border-[rgba(200,180,160,0.08)] rounded-lg overflow-hidden" style={{ height: "500px" }}>
                        <WireframePreview htmlContent={htmlContent} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-small whitespace-pre-wrap">{displayContent}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {sendMessageMutation.isPending && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-surface-primary text-small font-medium">
              AI
            </div>
            <div className="flex-1 bg-surface-secondary rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                <span className="text-small text-contrast-medium">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="border-t border-[rgba(200,180,160,0.08)] p-4">
        {lastAssistantChips.length > 0 && (
          <div
            role="list"
            aria-label="Suggested answers"
            className="flex flex-wrap gap-2 mb-3"
            data-testid="suggested-reply-chips"
          >
            {lastAssistantChips.map((chip) => (
              <button
                key={chip}
                type="button"
                role="listitem"
                disabled={sendMessageMutation.isPending}
                onClick={() => {
                  if (!sendMessageMutation.isPending) sendMessageMutation.mutate(chip);
                }}
                data-testid={`chip-reply-${chip.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-small transition-colors disabled:opacity-50"
                style={{
                  minHeight: 32,
                  color: "#f5f0eb",
                  borderColor: "rgba(240,182,94,0.35)",
                  background: "rgba(240,182,94,0.06)",
                  cursor: sendMessageMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <Input
            type="text"
            placeholder="Type your response..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 min-h-[44px]"
            disabled={sendMessageMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button 
            type="submit" 
            className="btn-primary min-h-[44px] min-w-[44px]"
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
