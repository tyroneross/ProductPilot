import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Stage } from "@shared/schema";

interface PromptEditorProps {
  stage: Stage;
}

export default function PromptEditor({ stage }: PromptEditorProps) {
  const [systemPrompt, setSystemPrompt] = useState(stage.systemPrompt);
  const [aiModel, setAiModel] = useState(stage.aiModel || "claude-sonnet");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStageMutation = useMutation({
    mutationFn: async (data: { systemPrompt?: string; aiModel?: string }) => {
      const res = await apiRequest("PATCH", `/api/stages/${stage.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stage.id] });
      toast({
        title: "Settings saved",
        description: "Stage prompt and model settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateStageMutation.mutate({
      systemPrompt,
      aiModel,
    });
  };

  const handleReset = () => {
    setSystemPrompt(stage.systemPrompt);
    setAiModel(stage.aiModel || "claude-sonnet");
  };

  return (
    <div className="w-96 border-l border-gray-200 flex flex-col">
      <div className="border-b border-gray-200 p-4">
        <h4 className="text-body font-medium text-contrast-high">Custom Prompt</h4>
        <p className="text-small text-contrast-medium mt-1">Customize AI behavior for this stage</p>
      </div>
      
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="block text-small font-medium text-contrast-high mb-2">
            System Instructions
          </label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full h-32 text-small resize-none"
            data-testid="textarea-system-prompt"
          />
        </div>
        
        <div>
          <label className="block text-small font-medium text-contrast-high mb-2">
            Model Selection
          </label>
          <Select value={aiModel} onValueChange={setAiModel}>
            <SelectTrigger className="min-h-[44px]" data-testid="select-stage-ai-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet">Claude Sonnet (Default)</SelectItem>
              <SelectItem value="chatgpt-4">ChatGPT-4</SelectItem>
              <SelectItem value="groq-llama">Groq Llama 3.1</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            onClick={handleSave}
            className="btn-primary flex-1 min-h-[44px]"
            disabled={updateStageMutation.isPending}
            data-testid="button-save-prompt"
          >
            {updateStageMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button 
            onClick={handleReset}
            variant="outline"
            className="min-h-[44px]"
            data-testid="button-reset-prompt"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}