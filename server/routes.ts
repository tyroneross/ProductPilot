import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-hybrid";
import { aiService, type AIMessage } from "./services/ai";
import { insertProjectSchema, insertMessageSchema, updateStageSchema, insertAdminPromptSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

// Admin usernames allowed to access the admin panel (can be expanded)
const ADMIN_USERS = ["Glokta3000", "39614428", "tyrone.ross@gmail.com"]; // Add user ID or email here

// Middleware to check if user is an admin
const isAdmin: RequestHandler = (req: any, res, next) => {
  const user = req.user;
  if (!user || !user.claims) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Check if user email or ID matches admin list
  const userEmail = user.claims.email || "";
  const userId = user.claims.sub || "";
  
  // Check against allowlist - user ID or email must match
  const isAllowed = ADMIN_USERS.includes(userId) || ADMIN_USERS.includes(userEmail);
  
  if (!isAllowed) {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Admin check endpoint
  app.get("/api/admin/check", isAuthenticated, (req: any, res) => {
    const user = req.user?.claims;
    res.json({ 
      isAdmin: true, // All authenticated users are admins for now
      user: {
        id: user?.sub,
        email: user?.email,
        name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
      }
    });
  });

  // Get user's in-progress draft project (for session persistence)
  app.get("/api/user/draft", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const draft = await storage.getUserDraft(userId);
      res.json(draft || null);
    } catch (error) {
      console.error("Error fetching user draft:", error);
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  // Link a project to the current user
  app.post("/api/projects/:id/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const updatedProject = await storage.updateProject(req.params.id, { userId });
      res.json(updatedProject);
    } catch (error) {
      console.error("Error claiming project:", error);
      res.status(500).json({ message: "Failed to claim project" });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const updates = z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        mode: z.enum(["interview", "stage-based", "survey"]).optional(),
        aiModel: z.string().optional(),
        surveyPhase: z.enum(["discovery", "survey", "complete"]).optional(),
        surveyDefinition: z.any().optional(),
        surveyResponses: z.any().optional(),
        customPrompts: z.any().optional(),
        intakeAnswers: z.any().optional(),
        minimumDetails: z.any().optional(),
      }).parse(req.body);
      
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const updatedProject = await storage.updateProject(req.params.id, updates);
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Stages
  app.get("/api/projects/:projectId/stages", async (req, res) => {
    try {
      const stages = await storage.getStagesByProject(req.params.projectId);
      res.json(stages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });

  app.get("/api/stages/:id", async (req, res) => {
    try {
      const stage = await storage.getStage(req.params.id);
      if (!stage) {
        return res.status(404).json({ message: "Stage not found" });
      }
      res.json(stage);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stage" });
    }
  });

  app.patch("/api/stages/:id", async (req, res) => {
    try {
      const updates = updateStageSchema.parse(req.body);
      const stage = await storage.updateStage(req.params.id, updates);
      if (!stage) {
        return res.status(404).json({ message: "Stage not found" });
      }
      res.json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid stage data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update stage" });
    }
  });

  // Messages
  app.get("/api/stages/:stageId/messages", async (req, res) => {
    try {
      const messages = await storage.getMessagesByStage(req.params.stageId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/stages/:stageId/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        stageId: req.params.stageId,
      });
      
      const message = await storage.createMessage(messageData);
      
      // If this is a user message, generate AI response
      if (messageData.role === "user") {
        const stage = await storage.getStage(req.params.stageId);
        if (!stage) {
          return res.status(404).json({ message: "Stage not found" });
        }

        // Get project to use its AI model as default
        const project = await storage.getProject(stage.projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Get existing messages (including the one we just created)
        const existingMessages = await storage.getMessagesByStage(req.params.stageId);
        
        // Try to get admin prompt from database, fallback to stage's default systemPrompt
        const adminPrompt = await storage.getAdminPromptByTargetKey(`stage_${stage.stageNumber}`);
        let systemPromptToUse = adminPrompt?.content || stage.systemPrompt;
        
        // Build project context from intake answers and minimum details
        let projectContext = "";
        
        // Helper to parse JSON safely (handles both objects and JSON strings)
        const parseJsonField = (field: any): Record<string, any> | null => {
          if (!field) return null;
          if (typeof field === 'object') return field;
          if (typeof field === 'string') {
            try {
              return JSON.parse(field);
            } catch {
              return null;
            }
          }
          return null;
        };
        
        if (project.description) {
          projectContext += `\n\n=== PRODUCT IDEA ===\n${project.description}`;
        }
        
        const intake = parseJsonField(project.intakeAnswers);
        if (intake && Object.keys(intake).length > 0) {
          projectContext += `\n\n=== INTAKE SURVEY RESPONSES ===`;
          
          const intakeLabels: Record<string, string> = {
            intent: "What they're building",
            platform: "Platform/Type",
            aiFeatures: "AI Features",
            dataComplexity: "Data Complexity",
            qualityPriority: "Quality Priority",
            launchTimeline: "Launch Timeline",
            teamSize: "Team Size",
            budget: "Budget"
          };
          
          for (const [key, value] of Object.entries(intake)) {
            if (value) {
              const label = intakeLabels[key] || key;
              projectContext += `\n- ${label}: ${value}`;
            }
          }
        }
        
        const details = parseJsonField(project.minimumDetails);
        if (details && Object.keys(details).length > 0) {
          projectContext += `\n\n=== MINIMUM PRODUCT DETAILS ===`;
          
          if (details.problemStatement) {
            projectContext += `\nProblem Statement: ${details.problemStatement}`;
          }
          if (details.goals && Array.isArray(details.goals)) {
            projectContext += `\nGoals: ${details.goals.join(", ")}`;
          }
          if (details.objects && Array.isArray(details.objects)) {
            projectContext += `\nCore Objects/Entities: ${details.objects.join(", ")}`;
          }
          if (details.actions && Array.isArray(details.actions)) {
            projectContext += `\nKey Actions: ${details.actions.join(", ")}`;
          }
          if (details.v1Definition) {
            projectContext += `\nV1 Scope: ${details.v1Definition}`;
          }
        }
        
        // Log when context extraction succeeds or fails for debugging
        if (projectContext.length > 0) {
          console.log(`AI context enriched with project data (${projectContext.length} chars)`);
        } else if (project.intakeAnswers || project.minimumDetails) {
          console.warn("Project has intake/details but context extraction failed");
        }
        
        // Append project context to system prompt if available
        if (projectContext) {
          systemPromptToUse += `\n\n${projectContext}\n\nUse this context to ask informed, specific follow-up questions. DO NOT re-ask for information already provided above.`;
        }
        
        // Build conversation history (existingMessages already includes the new user message we just created)
        const aiMessages: AIMessage[] = [
          { role: "system", content: systemPromptToUse },
          ...existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
        ];

        try {
          const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";
          let aiResponse = await aiService.chat(aiMessages, modelToUse);
          
          // Special handling for PRD stage (stage 2) to prevent premature document generation
          if (stage.stageNumber === 2) {
            // Count user messages (including the one we just created)
            const userMessageCount = existingMessages.filter(m => m.role === "user").length;
            
            // If we have fewer than 6 user messages and the AI generated a document, force it to ask questions instead
            if (userMessageCount < 6) {
              const hasDocumentStructure = aiResponse.content.includes("##") || 
                                         aiResponse.content.includes("# Product") ||
                                         aiResponse.content.includes("# PRD") ||
                                         aiResponse.content.includes("Executive Summary") ||
                                         aiResponse.content.match(/\n\n.*:\n-/); // bullet lists with headers
              
              if (hasDocumentStructure || aiResponse.content.length > 800) {
                // Override with simple questions instead
                const overridePrompt = `The user said: "${messageData.content}". 

You MUST respond with ONLY 2-3 simple questions to learn more. Do NOT generate any document, sections, or headers.

Just ask questions like:
1. [Question about who will use this]
2. [Question about key features]
3. [Question about constraints]

Keep it conversational and brief.`;
                
                aiResponse = await aiService.chat([
                  { role: "system", content: "You are an interviewer. Ask 2-3 brief questions. No documents. No headers. Just questions." },
                  { role: "user", content: overridePrompt }
                ], modelToUse);
              }
            }
          }
          
          // Special handling for UI Design stage (stage 3) to ensure HTML wireframes
          if (stage.stageNumber === 3) {
            const hasHTML = aiResponse.content.includes("<!DOCTYPE") || 
                           aiResponse.content.includes("<html") ||
                           aiResponse.content.includes("```html");
            
            if (!hasHTML) {
              // Force HTML wireframe generation
              const overridePrompt = `Create a simple HTML wireframe for: "${messageData.content}". 

You MUST respond with actual HTML code wrapped in \`\`\`html code blocks. Use an orange color scheme (#FF6B35 for primary elements, #FFA500 for accents).

Include a complete HTML document with basic styling. Keep it simple but functional.`;
              
              aiResponse = await aiService.chat([
                { role: "system", content: "You are a UI designer. Generate complete HTML wireframes with inline CSS. Always use orange color schemes. Return code in ```html blocks." },
                { role: "user", content: overridePrompt }
              ], modelToUse);
            }
          }
          
          // Create AI response message
          const aiMessage = await storage.createMessage({
            stageId: req.params.stageId,
            role: "assistant",
            content: aiResponse.content,
          });

          // Update stage progress
          const allMessages = await storage.getMessagesByStage(req.params.stageId);
          const progress = await aiService.calculateProgress(
            allMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
            [stage.description] // In production, define more specific goals
          );
          
          await storage.updateStage(req.params.stageId, { progress });

          res.status(201).json({ userMessage: message, aiMessage });
        } catch (aiError) {
          console.error("AI service error:", aiError);
          res.status(201).json({ userMessage: message, aiMessage: null, error: "AI service unavailable" });
        }
      } else {
        res.status(201).json({ userMessage: message });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Survey endpoints
  app.post("/api/projects/:projectId/generate-survey", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get the discovery chat messages to inform the survey
      const stages = await storage.getStagesByProject(req.params.projectId);
      const prdStage = stages.find(s => s.stageNumber === 2);
      const discoveryMessages = prdStage ? await storage.getMessagesByStage(prdStage.id) : [];

      const surveyPrompt = `You are creating a DYNAMIC, PERSONALIZED survey based on THIS SPECIFIC product idea. Analyze the product type and tailor every question to be relevant.

Product Idea: "${project.description}"

Discovery Conversation:
${discoveryMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. ANALYZE the product type first (mobile app, web app, SaaS, marketplace, API, game, etc.)
2. TAILOR all questions specifically to this product - generic questions are NOT acceptable
3. Use product-specific terminology and options that match what the user described
4. Reference specific features or concepts mentioned in the conversation

Generate a survey with 5 sections:
1. Requirements - tailored to THIS product's user base and problem space
2. Product Features - specific to features that make sense for THIS product type
3. User Experience - relevant to how THIS product would be used
4. Technical Architecture - appropriate tech choices for THIS product type
5. Development Plan - realistic for THIS product scope

Question Type Guidelines:
- "slider" (1-5 or 1-10 scale) for priorities, importance, complexity ratings
- "single-select" for mutually exclusive choices - OPTIONS MUST BE SPECIFIC TO THIS PRODUCT
- "multi-select" for selecting multiple applicable items - OPTIONS MUST BE RELEVANT

EXAMPLE of product-specific questions:
- For a "task management app": "Which task views are essential?" with options like "List view", "Kanban board", "Calendar view", "Timeline/Gantt"
- For an "e-commerce platform": "Which payment methods will you support?" with options like "Credit cards", "PayPal", "Crypto", "Buy now pay later"
- For a "fitness app": "Which tracking features are priorities?" with options like "Workout logging", "Nutrition tracking", "Sleep monitoring", "Heart rate"

Respond with ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "id": "requirements",
      "title": "Requirements & Goals",
      "description": "Define your target users and core objectives",
      "questions": [
        {
          "id": "q1_example",
          "section": "requirements",
          "question": "[Product-specific question]",
          "type": "slider",
          "min": 1,
          "max": 5,
          "minLabel": "[Relevant label]",
          "maxLabel": "[Relevant label]",
          "required": true
        }
      ]
    }
  ]
}`;

      const response = await aiService.generateStructuredOutput([
        { role: "system", content: "You are a product requirements expert. Generate surveys that efficiently capture high-value information using sliders and select inputs. Always return valid JSON." },
        { role: "user", content: surveyPrompt }
      ], "claude-sonnet");

      // Update project with the survey definition
      await storage.updateProject(req.params.projectId, {
        surveyDefinition: response,
        surveyPhase: "survey",
      });

      res.json({ surveyDefinition: response });
    } catch (error) {
      console.error("Survey generation error:", error);
      res.status(500).json({ message: "Failed to generate survey" });
    }
  });

  app.post("/api/projects/:projectId/submit-survey", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { responses } = req.body;
      
      // Save survey responses
      await storage.updateProject(req.params.projectId, {
        surveyResponses: responses,
        surveyPhase: "complete",
      });

      res.json({ message: "Survey submitted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit survey" });
    }
  });

  app.post("/api/projects/:projectId/generate-docs-from-survey", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.surveyResponses || !project.surveyDefinition) {
        return res.status(400).json({ message: "Survey not completed" });
      }

      // Get stages to update with generated content
      const stages = await storage.getStagesByProject(req.params.projectId);
      
      // Get active custom prompts organized by category
      const customPrompts = (project.customPrompts || []) as { id: string; name: string; prompt: string; category: string; isActive: boolean; }[];
      const activePrompts = customPrompts.filter(p => p.isActive);
      
      // Create custom prompts context for AI
      const customPromptsContext = activePrompts.length > 0 
        ? `\n\nUSER'S CUSTOM PROMPTS (incorporate these into your response where appropriate):\n${activePrompts.map(p => `- ${p.name} [${p.category}]: ${p.prompt}`).join('\n')}`
        : '';
      
      // Generate documentation for each stage based on survey responses
      const surveyContext = `
Product: ${project.description}
Survey Definition: ${JSON.stringify(project.surveyDefinition)}
Survey Responses: ${JSON.stringify(project.surveyResponses)}${customPromptsContext}
`;

      // Map stage numbers to categories for reliable routing
      // Stage 1: Requirements Definition, Stage 2: PRD Writing, Stage 3: Architecture Design
      // Stage 4: Coding Prompts, Stage 5: Development Guide
      const stageCategoryMap: Record<number, string> = {
        1: 'requirements',
        2: 'requirements',
        3: 'architecture',
        4: 'coding',
        5: 'testing',
      };

      for (const stage of stages) {
        // Use stage number for deterministic category mapping, fallback to title-based matching
        const stageCategory = stageCategoryMap[stage.stageNumber] || (() => {
          const titleLower = stage.title.toLowerCase();
          if (titleLower.includes('requirement') || titleLower.includes('prd') || titleLower.includes('goal') || titleLower.includes('scope')) return 'requirements';
          if (titleLower.includes('feature') || titleLower.includes('ui') || titleLower.includes('design') || titleLower.includes('wireframe') || titleLower.includes('mockup')) return 'features';
          if (titleLower.includes('architecture') || titleLower.includes('system') || titleLower.includes('infrastructure')) return 'architecture';
          if (titleLower.includes('coding') || titleLower.includes('prompt') || titleLower.includes('implementation') || titleLower.includes('code')) return 'coding';
          if (titleLower.includes('test') || titleLower.includes('qa') || titleLower.includes('quality') || titleLower.includes('guide') || titleLower.includes('deploy') || titleLower.includes('release')) return 'testing';
          return 'general';
        })();
        
        const relevantPrompts = activePrompts.filter(p => p.category === stageCategory || p.category === 'general');
        const stagePromptsContext = relevantPrompts.length > 0
          ? `\n\nRelevant custom prompts for this section:\n${relevantPrompts.map(p => `- ${p.name}: ${p.prompt}`).join('\n')}`
          : '';
        
        const docPrompt = `Based on this survey data, generate comprehensive content for the "${stage.title}" section.

${surveyContext}${stagePromptsContext}

Generate detailed, professional documentation appropriate for this section. Be thorough and specific based on the survey answers provided.`;

        try {
          // Try to get admin prompt from database, fallback to stage's default systemPrompt
          const adminPrompt = await storage.getAdminPromptByTargetKey(`stage_${stage.stageNumber}`);
          const systemPromptToUse = adminPrompt?.content || stage.systemPrompt;
          
          const response = await aiService.chat([
            { role: "system", content: systemPromptToUse },
            { role: "user", content: docPrompt }
          ], "claude-sonnet");

          // Create a message in the stage with the generated content
          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content,
          });

          // Update stage progress to 100%
          await storage.updateStage(stage.id, { progress: 100 });
        } catch (stageError) {
          console.error(`Error generating docs for stage ${stage.title}:`, stageError);
        }
      }

      res.json({ message: "Documentation generated successfully" });
    } catch (error) {
      console.error("Doc generation error:", error);
      res.status(500).json({ message: "Failed to generate documentation" });
    }
  });

  // Export functionality
  app.get("/api/projects/:projectId/export", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const stages = await storage.getStagesByProject(req.params.projectId);
      const exportData = {
        project,
        stages: await Promise.all(stages.map(async (stage) => {
          const messages = await storage.getMessagesByStage(stage.id);
          return { ...stage, messages };
        })),
        exportedAt: new Date().toISOString(),
      };

      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export project" });
    }
  });

  // Admin Prompts CRUD (protected by isAdmin middleware)
  app.get("/api/admin/prompts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllAdminPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching admin prompts:", error);
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.get("/api/admin/prompts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const prompt = await storage.getAdminPrompt(req.params.id);
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(prompt);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch prompt" });
    }
  });

  app.post("/api/admin/prompts", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const promptData = insertAdminPromptSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "unknown";
      const prompt = await storage.createAdminPrompt({
        ...promptData,
        updatedBy: userId,
      });
      res.status(201).json(prompt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.errors });
      }
      console.error("Error creating prompt:", error);
      res.status(500).json({ message: "Failed to create prompt" });
    }
  });

  app.put("/api/admin/prompts/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updates = insertAdminPromptSchema.partial().parse(req.body);
      const userId = req.user?.claims?.sub || "unknown";
      const prompt = await storage.updateAdminPrompt(req.params.id, {
        ...updates,
        updatedBy: userId,
      });
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(prompt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update prompt" });
    }
  });

  app.delete("/api/admin/prompts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteAdminPrompt(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json({ message: "Prompt deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete prompt" });
    }
  });

  // Seed default prompts if none exist
  app.post("/api/admin/prompts/seed", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const existingPrompts = await storage.getAllAdminPrompts();
      if (existingPrompts.length > 0) {
        return res.json({ message: "Prompts already exist", count: existingPrompts.length });
      }
      
      const userId = req.user?.claims?.sub || "system";
      await storage.seedDefaultPrompts(userId);
      const prompts = await storage.getAllAdminPrompts();
      res.json({ message: "Default prompts seeded", count: prompts.length });
    } catch (error) {
      console.error("Error seeding prompts:", error);
      res.status(500).json({ message: "Failed to seed prompts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
