import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, LogIn, LogOut, Plus, Pencil, Trash2, Save, X,
  RefreshCw, Shield, AlertTriangle, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminPrompt } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterceptorPrompt {
  id: string;
  scope: string;
  targetKey: string;
  label: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string | null;
  triggerCondition: string;
  isEnabled: boolean;
}

interface ConfirmDialog {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

type AdminPromptListItem = Omit<AdminPrompt, "createdAt" | "updatedAt"> & {
  createdAt: Date | null;
  updatedAt: Date | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Scope Badge ──────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: string }) {
  const colors: Record<string, string> = {
    stage: "bg-[rgba(240,182,94,0.12)] text-[#f0b65e]",
    discovery: "bg-[rgba(200,180,160,0.08)] text-[#a89a8c]",
    system: "bg-[rgba(200,180,160,0.08)] text-[#6b5d52]",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${colors[scope] ?? "bg-[rgba(200,180,160,0.08)] text-[#6b5d52]"}`}>
      {scope}
    </span>
  );
}

// ─── Prompt Item ──────────────────────────────────────────────────────────────

function PromptItem({
  prompt,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  isSaving,
}: {
  prompt: AdminPromptListItem;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: Partial<AdminPrompt>) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDefault = prompt.id.startsWith("default-");
  const words = wordCount(prompt.content);
  const chars = prompt.content.length;

  // Collapsed content preview: first ~160 chars, no hard cut mid-word
  const PREVIEW_CHARS = 160;
  const previewText =
    prompt.content.length > PREVIEW_CHARS
      ? prompt.content.slice(0, prompt.content.lastIndexOf(" ", PREVIEW_CHARS)) + "…"
      : prompt.content;

  return (
    <div
      className={`px-4 py-4 ${isEditing ? "bg-[#231f1b]" : "bg-[#1a1714]"}`}
      data-testid={`card-prompt-${prompt.id}`}
    >
      {/* Title line */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[15px] font-semibold text-[#f5f0eb] leading-snug">{prompt.label}</span>
            <ScopeBadge scope={prompt.scope} />
            {isDefault && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[rgba(200,180,160,0.08)] text-[#6b5d52]">
                Default
              </span>
            )}
          </div>

          {/* Description line */}
          {prompt.description && (
            <p className="text-[13px] text-[#a89a8c] mb-1.5 leading-snug">{prompt.description}</p>
          )}

          {/* Metadata line */}
          <p className="text-[11px] text-[#6b5d52] leading-snug flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{prompt.targetKey}</span>
            {prompt.stageNumber != null && <span>·</span>}
            {prompt.stageNumber != null && <span>Stage {prompt.stageNumber}</span>}
            {prompt.updatedBy && <span>·</span>}
            {prompt.updatedBy && <span>Edited by {prompt.updatedBy}</span>}
            {prompt.updatedAt && <span>·</span>}
            {prompt.updatedAt && <span>{formatDate(prompt.updatedAt)}</span>}
            <span>·</span>
            <span>{words} words</span>
            <span>·</span>
            <span>{chars} chars</span>
          </p>
        </div>

        {/* Action buttons — only when not editing */}
        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <button
              className="p-1.5 rounded text-[#6b5d52] hover:text-[#f5f0eb] hover:bg-[rgba(200,180,160,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={onEdit}
              disabled={isDefault}
              title={isDefault ? "Seed prompts first to customize defaults" : "Edit prompt"}
              data-testid={`button-edit-${prompt.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded text-[#6b5d52] hover:text-red-400 hover:bg-[rgba(200,180,160,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              disabled={isDefault}
              onClick={onDelete}
              title={isDefault ? "Seed prompts first to delete defaults" : "Delete prompt"}
              data-testid={`button-delete-${prompt.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content block — collapsed or expanded */}
      {!isEditing && (
        <div className="mt-2.5">
          <pre className="text-[12px] text-[#a89a8c] bg-[#231f1b] border border-[rgba(200,180,160,0.08)] rounded px-3 py-2.5 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {expanded ? prompt.content : previewText}
          </pre>
          {prompt.content.length > PREVIEW_CHARS && (
            <button
              className="mt-1.5 text-[11px] text-[#6b5d52] hover:text-[#a89a8c] flex items-center gap-0.5 transition-colors"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" />Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" />Show more</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Inline edit form */}
      {isEditing && (
        <div className="mt-3 pt-3 border-t border-[rgba(200,180,160,0.08)]">
          <PromptForm
            initialData={prompt}
            onSubmit={onSave}
            onCancel={onCancelEdit}
            isLoading={isSaving}
          />
        </div>
      )}
    </div>
  );
}

// ─── Interceptor Item ─────────────────────────────────────────────────────────

function InterceptorItem({ interceptor }: { interceptor: InterceptorPrompt }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_CHARS = 160;
  const previewText =
    interceptor.systemPrompt.length > PREVIEW_CHARS
      ? interceptor.systemPrompt.slice(0, interceptor.systemPrompt.lastIndexOf(" ", PREVIEW_CHARS)) + "…"
      : interceptor.systemPrompt;

  return (
    <div
      className="px-4 py-4 bg-[#1a1714] border-l-2 border-orange-400"
      data-testid={`card-interceptor-${interceptor.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title line */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-[15px] font-semibold text-[#f5f0eb] leading-snug">{interceptor.label}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${interceptor.isEnabled ? "bg-[rgba(74,222,128,0.12)] text-green-400" : "bg-[rgba(200,180,160,0.08)] text-[#6b5d52]"}`}>
              {interceptor.isEnabled ? "Active" : "Disabled"}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-600">
              Read-only
            </span>
          </div>

          {/* Description */}
          {interceptor.description && (
            <p className="text-[13px] text-[#a89a8c] mb-1.5 leading-snug">{interceptor.description}</p>
          )}

          {/* Metadata */}
          <p className="text-[11px] text-[#6b5d52] leading-snug">
            Trigger: <code className="bg-[rgba(200,180,160,0.08)] px-1 py-0.5 rounded font-mono text-[11px]">{interceptor.triggerCondition}</code>
          </p>
        </div>
      </div>

      {/* System prompt preview */}
      <div className="mt-2.5">
        <p className="text-[11px] font-medium text-[#6b5d52] mb-1">System prompt</p>
        <pre className="text-[12px] text-[#a89a8c] bg-[rgba(240,182,94,0.04)] border border-orange-900/30 rounded px-3 py-2.5 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
          {expanded ? interceptor.systemPrompt : previewText}
        </pre>
        {interceptor.systemPrompt.length > PREVIEW_CHARS && (
          <button
            className="mt-1.5 text-[11px] text-[#6b5d52] hover:text-[#a89a8c] flex items-center gap-0.5 transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" />Show less</>
            ) : (
              <><ChevronDown className="w-3 h-3" />Show more</>
            )}
          </button>
        )}
      </div>

      {/* User prompt template */}
      {interceptor.userPromptTemplate && (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-[#6b5d52] mb-1">User prompt template</p>
          <pre className="text-[12px] text-[#a89a8c] bg-[rgba(240,182,94,0.04)] border border-orange-900/30 rounded px-3 py-2.5 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-20">
            {interceptor.userPromptTemplate.length > 200
              ? interceptor.userPromptTemplate.slice(0, 200) + "…"
              : interceptor.userPromptTemplate}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  onSeed,
  isSeeding,
}: {
  onSeed: () => void;
  isSeeding: boolean;
}) {
  return (
    <div className="py-16 text-center px-6">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(200,180,160,0.08)] mb-4">
        <Shield className="w-5 h-5 text-[#6b5d52]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#f5f0eb] mb-1.5">No prompts configured yet</h3>
      <p className="text-[13px] text-[#a89a8c] max-w-xs mx-auto mb-5 leading-relaxed">
        Stage prompts tell the AI how to respond at each step of the product discovery flow.
        Seed the defaults to get started instantly, or create a custom prompt above.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onSeed}
        disabled={isSeeding}
        className="h-9 px-4 text-[13px]"
        data-testid="button-seed-empty"
      >
        {isSeeding ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
        )}
        Seed default prompts
      </Button>
    </div>
  );
}

// ─── PromptForm ───────────────────────────────────────────────────────────────

function PromptForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: AdminPromptListItem;
  onSubmit: (data: Partial<AdminPrompt>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    scope: initialData?.scope || "stage",
    targetKey: initialData?.targetKey || "",
    label: initialData?.label || "",
    description: initialData?.description || "",
    content: initialData?.content || "",
    stageNumber: initialData?.stageNumber?.toString() || "",
    isDefault: initialData?.isDefault || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      scope: formData.scope,
      targetKey: formData.targetKey,
      label: formData.label,
      description: formData.description || null,
      content: formData.content,
      stageNumber: formData.stageNumber ? parseInt(formData.stageNumber) : null,
      isDefault: formData.isDefault,
    });
  };

  const contentWordCount = wordCount(formData.content);
  const contentCharCount = formData.content.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-medium text-[#a89a8c] mb-1 block">Scope</label>
          <Select
            value={formData.scope}
            onValueChange={(v) => setFormData({ ...formData, scope: v })}
          >
            <SelectTrigger className="h-8 text-[13px]" data-testid="select-prompt-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stage">Stage</SelectItem>
              <SelectItem value="discovery">Discovery</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[12px] font-medium text-[#a89a8c] mb-1 block">Target Key</label>
          <Input
            className="h-8 text-[13px]"
            value={formData.targetKey}
            onChange={(e) => setFormData({ ...formData, targetKey: e.target.value })}
            placeholder="e.g., stage_1, discovery_initial"
            required
            data-testid="input-prompt-targetKey"
          />
        </div>
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#a89a8c] mb-1 block">Label</label>
        <Input
          className="h-8 text-[13px]"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="Human-readable name"
          required
          data-testid="input-prompt-label"
        />
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#a89a8c] mb-1 block">Description</label>
        <Input
          className="h-8 text-[13px]"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          data-testid="input-prompt-description"
        />
      </div>

      <div>
        <label className="text-[12px] font-medium text-[#a89a8c] mb-1 block">Prompt Content</label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="The actual prompt text…"
          rows={8}
          required
          className="font-mono text-[12px] leading-relaxed resize-y"
          data-testid="textarea-prompt-content"
        />
        <p className="mt-1 text-[11px] text-[#6b5d52]">
          {contentWordCount} words · {contentCharCount} characters
        </p>
      </div>

      {formData.scope === "stage" && (
        <div className="w-32">
          <label className="text-[12px] font-medium text-[#a89a8c] mb-1 block">Stage Number</label>
          <Input
            className="h-8 text-[13px]"
            type="number"
            min="1"
            max="6"
            value={formData.stageNumber}
            onChange={(e) => setFormData({ ...formData, stageNumber: e.target.value })}
            placeholder="1–6"
            data-testid="input-prompt-stageNumber"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-3 text-[13px]"
          onClick={onCancel}
          data-testid="button-prompt-cancel"
        >
          <X className="w-3.5 h-3.5 mr-1.5" />
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8 px-3 text-[13px] btn-primary"
          disabled={isLoading}
          data-testid="button-prompt-save"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          Save
        </Button>
      </div>
    </form>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  accent,
}: {
  title: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#231f1b] border-b border-[rgba(200,180,160,0.08)] sticky top-[57px] z-[5]">
      {accent && <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />}
      <span className="text-[12px] font-semibold text-[#6b5d52] uppercase tracking-wide">{title}</span>
      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[rgba(200,180,160,0.08)] text-[11px] font-semibold text-[#a89a8c]">
        {count}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [pendingUpdateData, setPendingUpdateData] = useState<{ id: string; data: Partial<AdminPrompt> } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterScope, setFilterScope] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: prompts, isLoading: promptsLoading, error } = useQuery<AdminPrompt[]>({
    queryKey: ["/api/admin/prompts"],
    enabled: isAuthenticated,
  });

  const { data: defaultStages = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/default-stages"],
    enabled: isAuthenticated,
  });

  const { data: interceptorPrompts = [] } = useQuery<InterceptorPrompt[]>({
    queryKey: ["/api/admin/interceptor-prompts"],
    enabled: isAuthenticated,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/prompts/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      toast({ title: "Success", description: "Default prompts seeded successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to seed prompts", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<AdminPrompt>) => apiRequest("POST", "/api/admin/prompts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setIsCreateOpen(false);
      toast({ title: "Success", description: "Prompt created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create prompt", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminPrompt> }) =>
      apiRequest("PUT", `/api/admin/prompts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setEditingPromptId(null);
      setPendingUpdateData(null);
      setConfirmDialog((prev) => ({ ...prev, open: false }));
      toast({ title: "Success", description: "Prompt updated successfully" });
    },
    onError: () => {
      setConfirmDialog((prev) => ({ ...prev, open: false }));
      toast({ title: "Error", description: "Failed to update prompt", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/prompts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setConfirmDialog((prev) => ({ ...prev, open: false }));
      toast({ title: "Success", description: "Prompt deleted successfully" });
    },
    onError: () => {
      setConfirmDialog((prev) => ({ ...prev, open: false }));
      toast({ title: "Error", description: "Failed to delete prompt", variant: "destructive" });
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredPrompts: AdminPromptListItem[] = (() => {
    const dbPrompts = (prompts || []) as AdminPromptListItem[];
    const dbTargetKeys = new Set(dbPrompts.map((p) => p.targetKey));

    const defaultEntries = defaultStages
      .filter((s) => !dbTargetKeys.has(`stage_${s.stageNumber}`))
      .map(
        (s) =>
          ({
            id: `default-${s.stageNumber}`,
            scope: "stage",
            targetKey: `stage_${s.stageNumber}`,
            label: s.title,
            description: s.description,
            content: s.systemPrompt,
            isDefault: true,
            stageNumber: s.stageNumber,
            updatedBy: null,
            createdAt: null,
            updatedAt: null,
          } satisfies AdminPromptListItem)
      );

    return [...dbPrompts, ...defaultEntries].filter((p) => {
      const matchesScope = filterScope === "all" || p.scope === filterScope;
      const matchesSearch =
        !searchQuery ||
        p.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.targetKey?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesScope && matchesSearch;
    });
  })();

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSeedConfirm() {
    setConfirmDialog({
      open: true,
      title: "Seed Default Prompts",
      description:
        "This will create default prompts for all 6 stages and the discovery flow. Existing prompts with the same target keys will not be overwritten.",
      onConfirm: () => {
        seedMutation.mutate();
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  }

  function handleEditSave(prompt: AdminPromptListItem, data: Partial<AdminPrompt>) {
    setPendingUpdateData({ id: prompt.id, data });
    setConfirmDialog({
      open: true,
      title: "Confirm Prompt Update",
      description: `Are you sure you want to update "${prompt.label}"? This will affect how the AI responds in the application.`,
      onConfirm: () => {
        updateMutation.mutate({ id: prompt.id, data });
      },
    });
  }

  function handleDeleteConfirm(prompt: AdminPromptListItem) {
    setConfirmDialog({
      open: true,
      title: "Confirm Delete",
      description: `Are you sure you want to delete "${prompt.label}"? This action cannot be undone.`,
      onConfirm: () => {
        deleteMutation.mutate(prompt.id);
      },
    });
  }

  // ── Auth states ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#110f0d]">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b5d52]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#110f0d]">
        <Card className="w-full max-w-sm border-[rgba(200,180,160,0.08)] shadow-sm bg-[#1a1714]">
          <CardHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(200,180,160,0.08)] mx-auto mb-3">
              <Shield className="w-5 h-5 text-[#a89a8c]" />
            </div>
            <CardTitle className="text-[16px] font-semibold text-[#f5f0eb]">Admin Panel</CardTitle>
            <p className="text-[13px] text-[#a89a8c] mt-1">
              Sign in to access the admin panel.
            </p>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button
              onClick={() => setLocation("/settings")}
              className="btn-primary h-9 px-5 text-[13px]"
              data-testid="button-admin-login"
            >
              <LogIn className="w-3.5 h-3.5 mr-2" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasNoPrompts = !promptsLoading && !error && filteredPrompts.length === 0;

  return (
    <div className="min-h-screen bg-[#110f0d]">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="bg-[#1a1714] border-b border-[rgba(200,180,160,0.08)] sticky top-0 z-10 h-[57px]">
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#a89a8c] shrink-0" />
            <span className="text-[15px] font-semibold text-[#f5f0eb]">Prompt Manager</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-[12px] text-[#a89a8c] hidden sm:inline truncate max-w-[180px]"
              data-testid="text-admin-user"
            >
              {user?.email || user?.name || "Admin"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-[13px]"
              onClick={() => logout()}
              data-testid="button-admin-logout"
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-5">

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-5">
          <Input
            placeholder="Search prompts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-9 text-[13px]"
          />
          <Select value={filterScope} onValueChange={setFilterScope}>
            <SelectTrigger className="h-9 text-[13px] sm:w-36" data-testid="select-filter-scope">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              <SelectItem value="stage">Stage</SelectItem>
              <SelectItem value="discovery">Discovery</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          {/* Seed button — only visible when no DB prompts exist */}
          {(!prompts || prompts.length === 0) && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-[13px]"
              onClick={handleSeedConfirm}
              disabled={seedMutation.isPending}
              data-testid="button-seed-prompts"
            >
              {seedMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Seed defaults
            </Button>
          )}

          {/* New Prompt dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                className="h-9 px-4 text-[13px] btn-primary shrink-0"
                data-testid="button-create-prompt"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-[15px]">Create New Prompt</DialogTitle>
              </DialogHeader>
              <PromptForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateOpen(false)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Stage Prompts list ────────────────────────────────────────────── */}
        <div className="border border-[rgba(200,180,160,0.08)] rounded-lg overflow-hidden bg-[#1a1714] mb-6">
          <SectionHeader title="Stage Prompts" count={filteredPrompts.length} />

          {promptsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[#6b5d52]" />
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-[#a89a8c]">Failed to load prompts. Please try again.</p>
            </div>
          ) : hasNoPrompts ? (
            <EmptyState onSeed={handleSeedConfirm} isSeeding={seedMutation.isPending} />
          ) : (
            <div className="divide-y divide-[rgba(200,180,160,0.06)]">
              {filteredPrompts.map((prompt) => (
                <PromptItem
                  key={prompt.id}
                  prompt={prompt}
                  isEditing={editingPromptId === prompt.id}
                  onEdit={() => setEditingPromptId(prompt.id)}
                  onCancelEdit={() => setEditingPromptId(null)}
                  onSave={(data) => handleEditSave(prompt, data)}
                  onDelete={() => handleDeleteConfirm(prompt)}
                  isSaving={updateMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Interceptors list ─────────────────────────────────────────────── */}
        {interceptorPrompts.length > 0 && (
          <div className="border border-[rgba(200,180,160,0.08)] rounded-lg overflow-hidden bg-[#1a1714] mb-6">
            <SectionHeader title="Interceptors" count={interceptorPrompts.length} accent />

            {/* Read-only notice */}
            <div className="px-4 py-2.5 bg-orange-50/60 border-b border-orange-100 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-orange-700 leading-snug">
                <span className="font-semibold">Read-only.</span> Interceptors are defined in{" "}
                <code className="bg-orange-100 px-1 rounded font-mono text-[11px]">shared/schema.ts</code>{" "}
                and require code changes to modify. They control runtime AI behavior.
              </p>
            </div>

            <div className="divide-y divide-[rgba(200,180,160,0.06)]">
              {interceptorPrompts.map((interceptor) => (
                <InterceptorItem key={interceptor.id} interceptor={interceptor} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Confirm dialog ─────────────────────────────────────────────────── */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[15px]">
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]" data-testid="button-confirm-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-[13px]"
              onClick={confirmDialog.onConfirm}
              data-testid="button-confirm-action"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
