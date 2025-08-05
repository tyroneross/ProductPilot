import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema, type InsertProject, type Project } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

interface NewProjectFormProps {
  onProjectCreated: (project: Project) => void;
}

export default function NewProjectForm({ onProjectCreated }: NewProjectFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      aiModel: "claude-sonnet",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onProjectCreated(project);
      setIsExpanded(false);
      form.reset();
      toast({
        title: "Project created",
        description: "Your new project has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    createProjectMutation.mutate(data);
  };

  return (
    <section>
      <div className="bg-surface-primary rounded-lg border border-gray-200 p-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="button-toggle-new-project"
        >
          <div>
            <h2 className="text-body font-medium text-contrast-high">Start New Project</h2>
            <p className="text-small text-contrast-medium">Create a guided development workflow</p>
          </div>
          <Button className="btn-primary" size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-small font-medium text-contrast-high">Project Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your project name..."
                            className="min-h-[44px]"
                            data-testid="input-project-name"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-small font-medium text-contrast-high">Project Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of what you're building..."
                            className="h-16 resize-none"
                            data-testid="textarea-project-description"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="md:col-span-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="aiModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-small font-medium text-contrast-high">
                          AI Model
                        </FormLabel>
                        <p className="text-xs text-contrast-medium">Used for output generation and processing</p>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="min-h-[44px]" data-testid="select-ai-model">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="claude-sonnet">Claude Sonnet (Default)</SelectItem>
                            <SelectItem value="chatgpt-4">ChatGPT-4</SelectItem>
                            <SelectItem value="groq-llama">Groq Llama 3.1</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex space-x-3">
                    <Button 
                      type="submit" 
                      className="btn-primary flex-1 min-h-[44px]"
                      disabled={createProjectMutation.isPending}
                      data-testid="button-create-project"
                    >
                      {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                    </Button>
                    <Button 
                      type="button"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => setIsExpanded(false)}
                      data-testid="button-cancel-project"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </section>
  );
}