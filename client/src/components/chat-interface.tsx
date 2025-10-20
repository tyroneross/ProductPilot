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

  const isUIDesignStage = stage.stageNumber === 3;

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
                Hello! I'm here to help you with {stage.title.toLowerCase()}. Let's work together to achieve the goals for this stage. Feel free to ask questions or share your thoughts to get started.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message: Message) => {
            const htmlContent = isUIDesignStage && message.role === "assistant" 
              ? extractHTMLFromMessage(message.content) 
              : null;

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
                      <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: "500px" }}>
                        <WireframePreview htmlContent={htmlContent} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-small whitespace-pre-wrap">{message.content}</p>
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
      
      <div className="border-t border-gray-200 p-4">
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
