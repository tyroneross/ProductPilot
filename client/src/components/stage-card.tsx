import { useLocation } from "wouter";
import { Edit, Download, Lock, MessageSquare } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { Stage } from "@shared/schema";

interface StageCardProps {
  stage: Stage;
}

export default function StageCard({ stage }: StageCardProps) {
  const [, setLocation] = useLocation();

  const handleCardClick = () => {
    if (stage.isUnlocked) {
      setLocation(`/stage/${stage.id}`);
    }
  };

  const handleEditPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stage.isUnlocked) {
      setLocation(`/stage/${stage.id}`);
    }
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement export functionality
    console.log("Export stage:", stage.id);
  };

  const isActive = stage.progress > 0 && stage.progress < 100;
  const isCompleted = stage.progress >= 75;
  const isLocked = !stage.isUnlocked;

  return (
    <div 
      className={`bg-surface-primary rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isActive ? 'border-2 border-accent' : 'border border-gray-200'
      } ${isLocked ? 'opacity-60' : ''}`}
      onClick={handleCardClick}
      data-testid={`card-stage-${stage.stageNumber}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className={`text-body font-medium ${isLocked ? 'text-contrast-medium' : 'text-contrast-high'}`}>
            {stage.title}
          </h3>
          <p className={`text-small mt-1 ${isLocked ? 'text-contrast-low' : 'text-contrast-medium'}`}>
            {stage.description}
          </p>
        </div>
        <div className="flex items-center">
          <ProgressRing progress={stage.progress} />
          <span className={`text-small font-medium ml-2 ${
            isCompleted ? 'text-accent' : 
            stage.progress > 0 ? 'text-contrast-medium' : 'text-contrast-low'
          }`}>
            {stage.progress}%
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <span className={`text-small ${isLocked ? 'text-contrast-low' : 'text-contrast-medium'}`}>
          {isLocked ? (
            <>
              <Lock className="w-3 h-3 mr-1 inline" />
              Locked
            </>
          ) : (
            <>
              <MessageSquare className="w-3 h-3 mr-1 inline" />
              {Math.floor(stage.progress / 10)} interactions
            </>
          )}
        </span>
        <div className="flex space-x-2">
          <button 
            className={`text-small min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isLocked 
                ? 'text-contrast-low cursor-not-allowed' 
                : 'text-contrast-medium hover:text-accent'
            }`}
            onClick={handleEditPrompt}
            disabled={isLocked}
            data-testid={`button-edit-stage-${stage.stageNumber}`}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            className={`text-small min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isLocked 
                ? 'text-contrast-low cursor-not-allowed' 
                : 'text-contrast-medium hover:text-accent'
            }`}
            onClick={handleExport}
            disabled={isLocked}
            data-testid={`button-export-stage-${stage.stageNumber}`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}