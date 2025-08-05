import type { Stage } from "@shared/schema";

interface ContextFlowProps {
  stages: Stage[];
}

export default function ContextFlow({ stages }: ContextFlowProps) {
  return (
    <section>
      <h2 className="text-body font-medium text-contrast-high mb-3">Development Flow</h2>
      <div className="bg-surface-primary rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between overflow-x-auto">
          <div className="flex items-center min-w-max">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center">
                <div className="flex flex-col items-center text-center">
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-medium mb-2 ${
                      stage.progress > 0 
                        ? 'bg-accent text-surface-primary' 
                        : 'bg-gray-300 text-contrast-medium'
                    }`}
                    data-testid={`flow-stage-${stage.stageNumber}`}
                  >
                    {stage.stageNumber}
                  </div>
                  <span 
                    className={`text-small font-medium ${
                      stage.progress > 0 ? 'text-contrast-high' : 'text-contrast-medium'
                    }`}
                  >
                    {stage.title.split(' ')[0]}
                  </span>
                </div>
                {index < stages.length - 1 && (
                  <div className="w-8 h-0.5 bg-gray-300 mx-4"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}