import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Sparkles, Pencil, Trash2 } from "lucide-react";
import type { CustomPrompt } from "@shared/schema";

interface PromptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customPrompts: CustomPrompt[];
  handleOpenAddDialog: () => void;
  handleEditPrompt: (prompt: CustomPrompt) => void;
  handleTogglePrompt: (id: string) => void;
  handleDeletePrompt: (id: string) => void;
}

export function PromptsDialog({
  open,
  onOpenChange,
  customPrompts,
  handleOpenAddDialog,
  handleEditPrompt,
  handleTogglePrompt,
  handleDeletePrompt,
}: PromptsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom LLM Prompts</DialogTitle>
          <DialogDescription>
            Define custom prompts to use throughout your app. These prompts can be used for requirements, features, architecture, coding, or testing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <span className="text-description text-contrast-medium">
              {customPrompts.length} prompt{customPrompts.length !== 1 ? "s" : ""} defined
            </span>
            <Button
              onClick={handleOpenAddDialog}
              className="btn-primary"
              data-testid="button-add-prompt"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Prompt
            </Button>
          </div>

          {customPrompts.length === 0 ? (
            <div className="text-center py-8 text-contrast-medium">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-description">No custom prompts yet.</p>
              <p className="text-metadata">Add prompts to customize AI behavior in your app.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className={`bg-surface-secondary rounded-lg p-4 border ${
                    prompt.isActive ? "border-accent" : "border-gray-200 opacity-60"
                  }`}
                  data-testid={`prompt-card-${prompt.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-title font-medium text-contrast-high">{prompt.name}</h4>
                        <span className="text-xs bg-surface-primary px-2 py-0.5 rounded text-contrast-medium">
                          {prompt.category}
                        </span>
                      </div>
                      {prompt.description && (
                        <p className="text-metadata text-contrast-medium mb-2">{prompt.description}</p>
                      )}
                      <p className="text-description text-contrast-high line-clamp-2">{prompt.prompt}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPrompt(prompt)}
                        className="text-contrast-medium hover:text-contrast-high"
                        data-testid={`button-edit-prompt-${prompt.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePrompt(prompt.id)}
                        className={prompt.isActive ? "text-accent" : "text-contrast-medium"}
                        data-testid={`button-toggle-prompt-${prompt.id}`}
                      >
                        {prompt.isActive ? "Active" : "Inactive"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePrompt(prompt.id)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-delete-prompt-${prompt.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
