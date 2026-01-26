import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, LogIn, LogOut, Plus, Pencil, Trash2, Save, X, RefreshCw, Shield, AlertTriangle, Zap } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminPrompt } from "@shared/schema";

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

export default function AdminPage() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [editingPrompt, setEditingPrompt] = useState<AdminPrompt | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterScope, setFilterScope] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("stage");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

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
    mutationFn: (data: Partial<AdminPrompt>) => 
      apiRequest("POST", "/api/admin/prompts", data),
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
      setEditingPrompt(null);
      setConfirmDialog(prev => ({ ...prev, open: false }));
      toast({ title: "Success", description: "Prompt updated successfully" });
    },
    onError: () => {
      setConfirmDialog(prev => ({ ...prev, open: false }));
      toast({ title: "Error", description: "Failed to update prompt", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/prompts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setConfirmDialog(prev => ({ ...prev, open: false }));
      toast({ title: "Success", description: "Prompt deleted successfully" });
    },
    onError: () => {
      setConfirmDialog(prev => ({ ...prev, open: false }));
      toast({ title: "Error", description: "Failed to delete prompt", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-accent" />
            <CardTitle>Admin Panel</CardTitle>
            <p className="text-description text-contrast-medium mt-2">
              Sign in with your GitHub account to access the admin panel
            </p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              onClick={() => window.location.href = "/api/login"}
              className="btn-primary"
              data-testid="button-admin-login"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with GitHub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredPrompts = [
    ...(prompts || []),
    ...defaultStages.map(s => ({
      id: `default-${s.stageNumber}`,
      scope: "stage",
      targetKey: `stage_${s.stageNumber}`,
      label: s.title,
      description: s.description,
      content: s.systemPrompt,
      isDefault: true,
      stageNumber: s.stageNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AdminPrompt))
  ].filter(p => 
    filterScope === "all" || p.scope === filterScope
  );

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="bg-surface-primary border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-accent" />
            <h1 className="text-title font-semibold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-description text-contrast-medium hidden sm:inline" data-testid="text-admin-user">
              {user?.email || user?.firstName || "Admin"}
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()} className="shrink-0" data-testid="button-admin-logout">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="stage" data-testid="tab-stage-prompts">
              Stage Prompts
            </TabsTrigger>
            <TabsTrigger value="interceptor" data-testid="tab-interceptor-prompts">
              <Zap className="w-4 h-4 mr-1" />
              Interceptors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stage">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">Stage Prompts</h2>
                <Select value={filterScope} onValueChange={setFilterScope}>
                  <SelectTrigger className="w-40" data-testid="select-filter-scope">
                    <SelectValue placeholder="Filter by scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scopes</SelectItem>
                    <SelectItem value="stage">Stage</SelectItem>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 shrink-0">
                {(!prompts || prompts.length === 0) && (
                  <Button
                    variant="outline"
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    data-testid="button-seed-prompts"
                  >
                    {seedMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Seed Defaults
                  </Button>
                )}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-primary" data-testid="button-create-prompt">
                      <Plus className="w-4 h-4 mr-2" />
                      New Prompt
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Prompt</DialogTitle>
                    </DialogHeader>
                    <PromptForm
                      onSubmit={(data) => createMutation.mutate(data)}
                      onCancel={() => setIsCreateOpen(false)}
                      isLoading={createMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {promptsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-contrast-medium">Failed to load prompts. Please try again.</p>
                </CardContent>
              </Card>
            ) : filteredPrompts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-contrast-medium mb-4">No prompts found.</p>
                  <Button
                    variant="outline"
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    data-testid="button-seed-empty"
                  >
                    {seedMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Seed Default Prompts
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPrompts.map((prompt) => (
                  <Card key={prompt.id} data-testid={`card-prompt-${prompt.id}`}>
                    <CardContent className="py-4">
                      {editingPrompt?.id === prompt.id ? (
                        <PromptForm
                          initialData={prompt}
                          onSubmit={(data) => {
                            setConfirmDialog({
                              open: true,
                              title: "Confirm Prompt Update",
                              description: `Are you sure you want to update "${prompt.label}"? This will affect how the AI responds in the application.`,
                              onConfirm: () => {
                                updateMutation.mutate({ id: prompt.id, data });
                              },
                            });
                          }}
                          onCancel={() => setEditingPrompt(null)}
                          isLoading={updateMutation.isPending}
                        />
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-title font-medium">{prompt.label}</h3>
                              <span className="px-2 py-0.5 text-xs bg-accent/10 text-accent rounded">
                                {prompt.scope}
                              </span>
                              {prompt.isDefault && (
                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-contrast-medium rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            {prompt.description && (
                              <p className="text-description text-contrast-medium mb-2">
                                {prompt.description}
                              </p>
                            )}
                            <pre className="text-metadata text-contrast-low bg-surface-secondary p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-32">
                              {prompt.content.substring(0, 300)}
                              {prompt.content.length > 300 && "..."}
                            </pre>
                            <p className="text-metadata text-contrast-low mt-2">
                              Key: {prompt.targetKey}
                              {prompt.stageNumber && ` | Stage ${prompt.stageNumber}`}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPrompt(prompt)}
                              data-testid={`button-edit-${prompt.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  title: "Confirm Delete",
                                  description: `Are you sure you want to delete "${prompt.label}"? This action cannot be undone.`,
                                  onConfirm: () => {
                                    deleteMutation.mutate(prompt.id);
                                  },
                                });
                              }}
                              data-testid={`button-delete-${prompt.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="interceptor">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold">Interceptor Prompts</h2>
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Advanced
                </span>
              </div>
              <p className="text-description text-contrast-medium">
                Interceptor prompts modify AI behavior at runtime. They can override responses, enforce output formats, or add guardrails. Changes here directly affect how the AI responds to users.
              </p>
            </div>

            <Card className="mb-4 bg-orange-50 border-orange-200">
              <CardContent className="py-3">
                <p className="text-sm text-orange-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    <strong>Read-only:</strong> Interceptor prompts are defined in code (<code className="bg-orange-100 px-1 rounded">shared/schema.ts</code>) and cannot be edited through this panel. They control runtime AI behavior and require code changes to modify.
                  </span>
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {interceptorPrompts.map((interceptor) => (
                <Card key={interceptor.id} className="border-orange-200" data-testid={`card-interceptor-${interceptor.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-4 h-4 text-orange-500" />
                          <h3 className="text-title font-medium">{interceptor.label}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded ${interceptor.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {interceptor.isEnabled ? 'Active' : 'Disabled'}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            Read-only
                          </span>
                        </div>
                        <p className="text-description text-contrast-medium mb-2">
                          {interceptor.description}
                        </p>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-contrast-medium mb-1">System Prompt:</p>
                            <pre className="text-metadata text-contrast-low bg-surface-secondary p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-24">
                              {interceptor.systemPrompt}
                            </pre>
                          </div>
                          {interceptor.userPromptTemplate && (
                            <div>
                              <p className="text-xs font-medium text-contrast-medium mb-1">User Prompt Template:</p>
                              <pre className="text-metadata text-contrast-low bg-surface-secondary p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-24">
                                {interceptor.userPromptTemplate.substring(0, 200)}
                                {interceptor.userPromptTemplate.length > 200 && "..."}
                              </pre>
                            </div>
                          )}
                          <p className="text-metadata text-contrast-low">
                            <span className="font-medium">Trigger:</span> <code className="bg-gray-100 px-1 rounded">{interceptor.triggerCondition}</code>
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                {confirmDialog.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDialog.onConfirm} data-testid="button-confirm-action">
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

function PromptForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: AdminPrompt;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-description font-medium mb-1 block">Scope</label>
          <Select
            value={formData.scope}
            onValueChange={(v) => setFormData({ ...formData, scope: v })}
          >
            <SelectTrigger data-testid="select-prompt-scope">
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
          <label className="text-description font-medium mb-1 block">Target Key</label>
          <Input
            value={formData.targetKey}
            onChange={(e) => setFormData({ ...formData, targetKey: e.target.value })}
            placeholder="e.g., stage_1, discovery_initial"
            required
            data-testid="input-prompt-targetKey"
          />
        </div>
      </div>

      <div>
        <label className="text-description font-medium mb-1 block">Label</label>
        <Input
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="Human-readable name"
          required
          data-testid="input-prompt-label"
        />
      </div>

      <div>
        <label className="text-description font-medium mb-1 block">Description</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          data-testid="input-prompt-description"
        />
      </div>

      <div>
        <label className="text-description font-medium mb-1 block">Prompt Content</label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="The actual prompt text..."
          rows={8}
          required
          className="font-mono text-sm"
          data-testid="textarea-prompt-content"
        />
      </div>

      {formData.scope === "stage" && (
        <div>
          <label className="text-description font-medium mb-1 block">Stage Number</label>
          <Input
            type="number"
            min="1"
            max="6"
            value={formData.stageNumber}
            onChange={(e) => setFormData({ ...formData, stageNumber: e.target.value })}
            placeholder="1-6"
            data-testid="input-prompt-stageNumber"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-prompt-cancel">
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="btn-primary" disabled={isLoading} data-testid="button-prompt-save">
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save
        </Button>
      </div>
    </form>
  );
}

