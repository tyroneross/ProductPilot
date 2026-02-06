import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema, type InsertProject, type Project } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";

interface NewProjectFormProps {
  onProjectCreated?: (project: Project) => void;
}

export default function NewProjectForm({ onProjectCreated }: NewProjectFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "A new product development project",
      mode: "interview",
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
      if (onProjectCreated) {
        onProjectCreated(project);
      }
      setIsExpanded(false);
      form.reset();
      setLocation(`/interview/${project.id}`);
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
      <div className="bg-surface-primary rounded-lg border border-gray-200 p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="button-toggle-new-project"
        >
          <div>
            <h2 className="text-title text-contrast-high">Start New Product</h2>
            <p className="text-description text-contrast-medium mt-1">Describe what you want to build</p>
          </div>
          <Button className="btn-primary min-h-[44px]" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New
          </Button>
        </div>
        
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="What product are you building? (e.g., Mobile fitness app, SaaS analytics tool)"
                          className="min-h-[44px]"
                          data-testid="input-project-name"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-3 justify-end">
                  <Button 
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setIsExpanded(false)}
                    data-testid="button-cancel-project"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-primary min-h-[44px] px-8"
                    disabled={createProjectMutation.isPending}
                    data-testid="button-create-project"
                  >
                    {createProjectMutation.isPending ? "Starting..." : "Start Building"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </section>
  );
}