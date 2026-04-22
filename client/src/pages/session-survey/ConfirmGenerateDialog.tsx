import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Stage } from "@shared/schema";

interface ConfirmGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
  documentSelections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }>;
  setDocumentSelections: (selections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }>) => void;
  selectedCount: number;
  handleConfirmGenerate: () => void;
}

export function ConfirmGenerateDialog({
  open,
  onOpenChange,
  stages,
  documentSelections,
  setDocumentSelections,
  selectedCount,
  handleConfirmGenerate,
}: ConfirmGenerateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ready to Generate Documentation</DialogTitle>
          <DialogDescription>
            Select which documents you want to generate and choose the detail level for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-description text-contrast-medium">
              {selectedCount} of {stages.length} documents selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newSelections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }> = {};
                  stages.forEach(stage => {
                    newSelections[stage.id] = {
                      selected: true,
                      detailLevel: documentSelections[stage.id]?.detailLevel || "detailed"
                    };
                  });
                  setDocumentSelections(newSelections);
                }}
                data-testid="button-select-all"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newSelections: Record<string, { selected: boolean; detailLevel: "detailed" | "summary" }> = {};
                  stages.forEach(stage => {
                    newSelections[stage.id] = {
                      selected: false,
                      detailLevel: documentSelections[stage.id]?.detailLevel || "detailed"
                    };
                  });
                  setDocumentSelections(newSelections);
                }}
                data-testid="button-deselect-all"
              >
                Deselect All
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {stages
              .sort((a, b) => a.stageNumber - b.stageNumber)
              .map((stage) => (
                <div
                  key={stage.id}
                  className={`bg-surface-secondary rounded-lg p-4 border transition-colors ${
                    documentSelections[stage.id]?.selected
                      ? "border-accent bg-accent/5"
                      : "border-gray-200"
                  }`}
                  data-testid={`doc-selection-${stage.id}`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id={`doc-${stage.id}`}
                      checked={documentSelections[stage.id]?.selected || false}
                      onCheckedChange={(checked) => {
                        setDocumentSelections({
                          ...documentSelections,
                          [stage.id]: {
                            selected: !!checked,
                            detailLevel: documentSelections[stage.id]?.detailLevel || "detailed"
                          }
                        });
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`doc-${stage.id}`}
                        className="text-description font-medium text-contrast-high cursor-pointer"
                      >
                        {stage.title}
                      </Label>
                      <p className="text-metadata text-contrast-medium mt-1">
                        {stage.description}
                      </p>

                      {documentSelections[stage.id]?.selected && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-metadata text-contrast-medium">Detail level:</span>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            <button
                              type="button"
                              onClick={() => setDocumentSelections({
                                ...documentSelections,
                                [stage.id]: {
                                  selected: documentSelections[stage.id]?.selected ?? true,
                                  detailLevel: "summary"
                                }
                              })}
                              className={`px-3 py-1.5 text-sm transition-colors ${
                                documentSelections[stage.id]?.detailLevel === "summary"
                                  ? "bg-accent text-white"
                                  : "bg-surface-primary text-contrast-medium hover:bg-surface-secondary"
                              }`}
                              data-testid={`button-summary-${stage.id}`}
                            >
                              Summary
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocumentSelections({
                                ...documentSelections,
                                [stage.id]: {
                                  selected: documentSelections[stage.id]?.selected ?? true,
                                  detailLevel: "detailed"
                                }
                              })}
                              className={`px-3 py-1.5 text-sm transition-colors ${
                                documentSelections[stage.id]?.detailLevel === "detailed"
                                  ? "bg-accent text-white"
                                  : "bg-surface-primary text-contrast-medium hover:bg-surface-secondary"
                              }`}
                              data-testid={`button-detailed-${stage.id}`}
                            >
                              Detailed
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmGenerate}
              disabled={selectedCount === 0}
              className="btn-primary"
              data-testid="button-confirm-generate"
            >
              Generate {selectedCount} Document{selectedCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
