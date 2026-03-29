import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, SkipForward } from "lucide-react";
import ChatInterface from "@/components/chat-interface";
import InsightsPanel from "@/components/insights-panel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Stage } from "@shared/schema";

export default function StagePage() {
  const { stageId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stage, isLoading } = useQuery<Stage>({
    queryKey: ["/api/stages", stageId],
    enabled: !!stageId,
  });

  const skipStageMutation = useMutation({
    mutationFn: async () => {
      if (!stageId) return null;
      const res = await apiRequest("PATCH", `/api/stages/${stageId}`, {
        progress: 100,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stageId] });
      if (stage) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", stage.projectId, "stages"] });
      }
      toast({
        title: "Stage skipped",
        description: "You can always come back to this stage later.",
      });
      setLocation("/projects");
    },
    onError: () => {
      toast({
        title: "Failed to skip stage",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!stage) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-h3 font-medium text-contrast-medium mb-2">Stage not found</h2>
          <Button onClick={() => setLocation("/")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      <header className="border-b border-[rgba(200,180,160,0.08)] bg-surface-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/projects")}
              className="min-h-[44px] min-w-[44px]"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-h3 font-medium text-contrast-high">{stage.title}</h1>
              <p className="text-description text-contrast-medium">{stage.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-metadata text-contrast-medium">Progress:</span>
              <span className="text-description font-medium text-accent">{stage.progress}%</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => skipStageMutation.mutate()}
              disabled={skipStageMutation.isPending}
              className="min-h-[44px]"
              data-testid="button-skip-stage"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip Stage
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="w-80 border-r border-[rgba(200,180,160,0.08)] bg-[#231f1b]">
          <InsightsPanel stage={stage} />
        </div>
        <div className="flex-1 flex flex-col">
          <ChatInterface stage={stage} />
        </div>
      </div>
    </div>
  );
}