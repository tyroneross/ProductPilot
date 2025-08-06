import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Settings } from "lucide-react";
import ChatInterface from "@/components/chat-interface";

import InsightsPanel from "@/components/insights-panel";
import { Button } from "@/components/ui/button";
import type { Stage } from "@shared/schema";

export default function StagePage() {
  const { stageId } = useParams();
  const [, setLocation] = useLocation();

  const { data: stage, isLoading } = useQuery<Stage>({
    queryKey: ["/api/stages", stageId],
    enabled: !!stageId,
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
      <header className="border-b border-gray-200 bg-surface-primary px-6 py-4">
        <div className="flex items-center justify-between">
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
              <h1 className="text-h3 font-medium text-contrast-high">{stage.title}</h1>
              <p className="text-small text-contrast-medium">{stage.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-small text-contrast-medium">Progress:</span>
            <span className="text-small font-medium text-accent">{stage.progress}%</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="min-h-[44px] min-w-[44px]"
              onClick={() => alert('Settings panel coming soon!')}
              data-testid="button-stage-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="w-80 border-r border-gray-200">
          <InsightsPanel stage={stage} />
        </div>
        <div className="flex-1 flex flex-col">
          <ChatInterface stage={stage} />
        </div>
      </div>
    </div>
  );
}