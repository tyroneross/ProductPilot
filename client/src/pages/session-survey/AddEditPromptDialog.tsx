import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CustomPrompt } from "@shared/schema";

interface AddEditPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPromptId: string | null;
  newPrompt: Partial<CustomPrompt>;
  setNewPrompt: (prompt: Partial<CustomPrompt>) => void;
  handleAddPrompt: () => void;
}

export function AddEditPromptDialog({
  open,
  onOpenChange,
  editingPromptId,
  newPrompt,
  setNewPrompt,
  handleAddPrompt,
}: AddEditPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingPromptId ? "Edit Custom Prompt" : "Add Custom Prompt"}</DialogTitle>
          <DialogDescription>
            {editingPromptId ? "Update your LLM prompt." : "Create a new LLM prompt for use in your application."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-description mb-2 block">Name</Label>
            <Input
              placeholder="e.g., Code Review Prompt"
              value={newPrompt.name}
              onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
              data-testid="input-prompt-name"
            />
          </div>
          <div>
            <Label className="text-description mb-2 block">Category</Label>
            <Select
              value={newPrompt.category}
              onValueChange={(value) => setNewPrompt({ ...newPrompt, category: value as CustomPrompt["category"] })}
            >
              <SelectTrigger data-testid="select-prompt-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requirements">Requirements</SelectItem>
                <SelectItem value="features">Features</SelectItem>
                <SelectItem value="architecture">Architecture</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-description mb-2 block">Description (optional)</Label>
            <Input
              placeholder="Brief description of what this prompt does"
              value={newPrompt.description}
              onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
              data-testid="input-prompt-description"
            />
          </div>
          <div>
            <Label className="text-description mb-2 block">Prompt</Label>
            <Textarea
              placeholder="Enter your LLM prompt here..."
              value={newPrompt.prompt}
              onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
              className="min-h-[150px]"
              data-testid="textarea-prompt-content"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPrompt}
              disabled={!newPrompt.name?.trim() || !newPrompt.prompt?.trim()}
              data-testid="button-save-prompt"
            >
              {editingPromptId ? "Save Changes" : "Add Prompt"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
