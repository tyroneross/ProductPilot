import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Stage } from "@shared/schema";

interface InsightsPanelProps {
  stage: Stage;
}

export default function InsightsPanel({ stage }: InsightsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const keyInsights = Array.isArray(stage.keyInsights) ? stage.keyInsights : [];
  const completedInsights = Array.isArray(stage.completedInsights) ? stage.completedInsights : [];
  
  const updateInsightsMutation = useMutation({
    mutationFn: async (newCompletedInsights: string[]) => {
      return apiRequest("PATCH", `/api/stages/${stage.id}`, { 
        completedInsights: newCompletedInsights 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stage.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", stage.projectId, "stages"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update insights",
        variant: "destructive",
      });
    },
  });

  const toggleInsight = (insight: string) => {
    const isCompleted = completedInsights.includes(insight);
    const newCompletedInsights = isCompleted
      ? completedInsights.filter(i => i !== insight)
      : [...completedInsights, insight];
    
    updateInsightsMutation.mutate(newCompletedInsights);
  };

  const completionPercentage = keyInsights.length > 0 
    ? Math.round((completedInsights.length / keyInsights.length) * 100)
    : 0;

  return (
    <Card className="w-80 bg-surface-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-body font-medium text-contrast-high flex items-center justify-between">
          Key Insights
          <span className="text-small font-normal text-accent">
            {completionPercentage}%
          </span>
        </CardTitle>
        <div className="w-full bg-surface-secondary rounded-full h-2">
          <div 
            className="bg-accent h-2 rounded-full transition-all duration-300" 
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {keyInsights.length === 0 ? (
          <p className="text-small text-contrast-medium">
            No key insights defined for this stage.
          </p>
        ) : (
          keyInsights.map((insight, index) => {
            const isCompleted = completedInsights.includes(insight);
            return (
              <div
                key={index}
                className="flex items-start space-x-3 p-2 rounded hover:bg-surface-secondary transition-colors cursor-pointer"
                onClick={() => toggleInsight(insight)}
                data-testid={`insight-${index}`}
              >
                <button className="mt-0.5 min-w-[16px] text-accent hover:text-accent-dark">
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                <span
                  className={`text-small leading-relaxed ${
                    isCompleted 
                      ? "text-contrast-medium line-through" 
                      : "text-contrast-high"
                  }`}
                >
                  {insight}
                </span>
              </div>
            );
          })
        )}
        
        {keyInsights.length > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-contrast-medium">
              {completedInsights.length} of {keyInsights.length} insights completed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}