import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="h-full bg-surface-primary p-4">
      <div className="pb-4">
        <h3 className="text-title text-contrast-high flex items-center justify-between">
          Discussion Goals
          <span className="text-metadata text-accent">
            {completionPercentage}%
          </span>
        </h3>
        <div className="w-full bg-surface-secondary rounded-full h-2 mt-2">
          <div 
            className="bg-accent h-2 rounded-full transition-all duration-300" 
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
      
      {keyInsights.length === 0 ? (
        <p className="text-description text-contrast-medium">
          No discussion goals defined for this stage.
        </p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {keyInsights.map((insight, index) => {
            const isCompleted = completedInsights.includes(insight);
            return (
              <div key={index}>
                <div
                  className="flex items-start space-x-3 p-3 hover:bg-surface-secondary transition-colors cursor-pointer"
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
                  <div className="flex-1">
                    <span
                      className={`text-description leading-relaxed block ${
                        isCompleted 
                          ? "text-contrast-medium line-through" 
                          : "text-contrast-high"
                      }`}
                    >
                      {insight}
                    </span>
                    {!isCompleted && (
                      <p className="text-metadata text-contrast-medium mt-1">
                        Click to mark as discussed
                      </p>
                    )}
                  </div>
                </div>
                {index < keyInsights.length - 1 && (
                  <div className="border-t border-gray-200" />
                )}
              </div>
            );
          })}
          
          <div className="border-t border-gray-200 p-3 bg-surface-secondary">
            <p className="text-metadata text-contrast-medium text-center">
              {completedInsights.length} of {keyInsights.length} goals discussed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}