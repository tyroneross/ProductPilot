import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-hybrid";
import { aiService, type AIMessage } from "./services/ai";
import { insertProjectSchema, insertMessageSchema, updateStageSchema, insertAdminPromptSchema, INTERCEPTOR_PROMPTS } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

// Admin usernames allowed to access the admin panel (can be expanded)
const ADMIN_USERS = ["Glokta3000", "39614428", "tyrone.ross@gmail.com"]; // Add user ID or email here

// Helper to get interceptor prompt by targetKey
const getInterceptorPrompt = (targetKey: string) =>
  INTERCEPTOR_PROMPTS.find(p => p.targetKey === targetKey);

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

// Passthrough middleware for non-Replit environments where auth is unavailable
const noAuth: RequestHandler = (_req, _res, next) => next();
const authMiddleware: RequestHandler = process.env.REPL_ID ? isAuthenticated : noAuth;
const adminMiddleware: RequestHandler = process.env.REPL_ID ? isAdmin : noAuth;

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication BEFORE other routes (Replit only — REPL_ID absent on Vercel/local)
  if (process.env.REPL_ID) {
    await setupAuth(app);
    registerAuthRoutes(app);
  }

  // Admin check endpoint
  app.get("/api/admin/check", authMiddleware, (req: any, res) => {
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
  app.get("/api/user/draft", authMiddleware, async (req: any, res) => {
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
  app.post("/api/projects/:id/claim", authMiddleware, async (req: any, res) => {
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
        appStyle: z.any().optional(),
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

  // Create stages for a project that doesn't have them (for legacy projects)
  app.post("/api/projects/:projectId/ensure-stages", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const existingStages = await storage.getStagesByProject(req.params.projectId);
      if (existingStages.length > 0) {
        return res.json(existingStages);
      }
      
      // Create stages using the storage method
      const stages = await storage.ensureStagesForProject(req.params.projectId);
      res.status(201).json(stages);
    } catch (error) {
      console.error("Error ensuring stages:", error);
      res.status(500).json({ message: "Failed to create stages" });
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
          if (details.userGoals && Array.isArray(details.userGoals)) {
            const goals = details.userGoals.filter((g: string) => g.trim());
            if (goals.length > 0) {
              projectContext += `\nUser Goals: ${goals.join(", ")}`;
            }
          }
          if (details.goals && Array.isArray(details.goals)) {
            projectContext += `\nGoals: ${details.goals.join(", ")}`;
          }
          if (details.mainObjects && Array.isArray(details.mainObjects)) {
            const objects = details.mainObjects.filter((o: string) => o.trim());
            if (objects.length > 0) {
              projectContext += `\nCore Objects/Entities: ${objects.join(", ")}`;
            }
          }
          if (details.objects && Array.isArray(details.objects)) {
            projectContext += `\nCore Objects/Entities: ${details.objects.join(", ")}`;
          }
          if (details.mainActions && Array.isArray(details.mainActions)) {
            const actions = details.mainActions.filter((a: string) => a.trim());
            if (actions.length > 0) {
              projectContext += `\nKey Actions: ${actions.join(", ")}`;
            }
          }
          if (details.actions && Array.isArray(details.actions)) {
            projectContext += `\nKey Actions: ${details.actions.join(", ")}`;
          }
          if (details.v1Definition) {
            projectContext += `\nV1 Scope: ${details.v1Definition}`;
          }
          if (details.inspirationLink) {
            projectContext += `\nInspiration/Reference: ${details.inspirationLink}`;
          }
          if (details.mustUseTools) {
            projectContext += `\nMUST use these tools/technologies: ${details.mustUseTools}`;
          }
          if (details.mustAvoidTools) {
            projectContext += `\nMUST AVOID these tools/technologies: ${details.mustAvoidTools}`;
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
        
        // Inject enforcement instructions upfront to avoid wasteful double-calls
        const userMessageCount = existingMessages.filter(m => m.role === "user").length;

        if (stage.stageNumber === 2 && userMessageCount < 6) {
          systemPromptToUse += `\n\n<ENFORCEMENT>You have received ${userMessageCount} user messages so far. Since this is less than 6, you MUST ONLY ask 1-2 brief follow-up questions. Do NOT generate any document sections, headers (##), PRD content, or formatted output. Keep your response under 300 characters.</ENFORCEMENT>`;
        }

        if (stage.stageNumber === 3) {
          systemPromptToUse += `\n\n<ENFORCEMENT>You MUST include HTML wireframe code in \`\`\`html code blocks in every response. Use orange color scheme (#FF6B35 primary, #FFA500 accents). If the user hasn't specified what to wireframe yet, ask them, but still include a simple placeholder HTML wireframe.</ENFORCEMENT>`;
        }

        // Build conversation history (existingMessages already includes the new user message we just created)
        const aiMessages: AIMessage[] = [
          { role: "system", content: systemPromptToUse },
          ...existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
        ];

        try {
          const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";
          const aiResponse = await aiService.chat(aiMessages, modelToUse);

          // Create AI response message
          const aiMessage = await storage.createMessage({
            stageId: req.params.stageId,
            role: "assistant",
            content: aiResponse.content,
          });

          // Update stage progress — construct from what we already have, no extra DB call
          const allMessages = [
            ...existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "assistant" as const, content: aiResponse.content }
          ];
          const progress = await aiService.calculateProgress(
            allMessages,
            [stage.description] // In production, define more specific goals
          );
          
          await storage.updateStage(req.params.stageId, { progress });

          res.status(201).json({ userMessage: message, aiMessage });
        } catch (aiError) {
          console.error("AI service error:", aiError);
          res.status(503).json({ userMessage: message, aiMessage: null, error: "AI service unavailable" });
        }
      } else {
        res.status(201).json({ userMessage: message });
      }
    } catch (error) {
      console.error("Message creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create message", error: String(error) });
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

      // Use interceptor prompt from schema.ts for survey generation
      const surveyInterceptor = getInterceptorPrompt("survey_generation_system");
      const systemPrompt = surveyInterceptor?.isEnabled 
        ? surveyInterceptor.systemPrompt 
        : "You are a product requirements expert. Generate surveys that efficiently capture high-value information using sliders and select inputs. Always return valid JSON.";
      
      const response = await aiService.generateStructuredOutput([
        { role: "system", content: systemPrompt },
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

      // Parse document preferences from request body
      const documentPreferences = (req.body.documentPreferences || []) as Array<{
        stageId: string;
        detailLevel: "detailed" | "summary";
      }>;
      
      // Create a map for quick lookup
      const preferencesMap = new Map(
        documentPreferences.map(p => [p.stageId, p.detailLevel])
      );

      // Get stages to update with generated content
      const allStages = await storage.getStagesByProject(req.params.projectId);
      
      // Filter stages based on preferences (if provided), otherwise generate all
      const stages = documentPreferences.length > 0
        ? allStages.filter(s => preferencesMap.has(s.id))
        : allStages;
      
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

      // Batch-fetch all admin prompts once to avoid N queries in the loop
      const allAdminPrompts = await storage.getAllAdminPrompts();
      const adminPromptMap = new Map(allAdminPrompts.map(p => [p.targetKey, p]));

      await Promise.allSettled(stages.map(async (stage) => {
        // Get detail level for this stage (default to detailed)
        const detailLevel = preferencesMap.get(stage.id) || "detailed";

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
        
        // Adjust prompt based on detail level
        const detailInstruction = detailLevel === "summary"
          ? "Generate a CONCISE SUMMARY version - focus on key points, main decisions, and essential information only. Keep it brief but actionable (roughly 1/3 the length of a full document)."
          : "Generate DETAILED, COMPREHENSIVE documentation with thorough explanations, examples, and specific recommendations.";
        
        const docPrompt = `Based on this survey data, generate content for the "${stage.title}" section.

${surveyContext}${stagePromptsContext}

${detailInstruction}

Be thorough and specific based on the survey answers provided.`;

        try {
          // Use pre-fetched admin prompt map to avoid per-stage DB query
          const adminPrompt = adminPromptMap.get(`stage_${stage.stageNumber}`);
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
      }))

      res.json({ message: "Documentation generated successfully" });
    } catch (error) {
      console.error("Doc generation error:", error);
      res.status(500).json({ message: "Failed to generate documentation" });
    }
  });

  // Generate docs from minimum details only (faster path for quick start)
  app.post("/api/projects/:projectId/generate-docs-from-minimum", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const minimumDetails = req.body.minimumDetails || project.minimumDetails;
      if (!minimumDetails) {
        return res.status(400).json({ message: "Minimum details not provided" });
      }

      // Ensure project has stages
      let stages = await storage.getStagesByProject(req.params.projectId);
      if (stages.length === 0) {
        // Create default stages
        const defaultStages = [
          { stageNumber: 1, title: "Requirements Definition", description: "User personas, use cases, and MVP scope", progress: 0, systemPrompt: "You are a product manager helping define requirements." },
          { stageNumber: 2, title: "Product Requirements Document", description: "User stories, features, and success metrics", progress: 0, systemPrompt: "You are a product manager writing a detailed PRD." },
          { stageNumber: 3, title: "UI Design & Wireframes", description: "Simple wireframe mockups", progress: 0, systemPrompt: "You are a UI designer creating wireframes." },
          { stageNumber: 4, title: "System Architecture", description: "Technical design and architecture", progress: 0, systemPrompt: "You are a software architect designing the system." },
          { stageNumber: 5, title: "Coding Prompts", description: "AI-optimized implementation instructions", progress: 0, systemPrompt: "You are a senior developer creating coding prompts." },
          { stageNumber: 6, title: "Development Guide", description: "Implementation roadmap and milestones", progress: 0, systemPrompt: "You are a tech lead writing a development guide." },
        ];
        
        for (const stageData of defaultStages) {
          await storage.createStage({
            projectId: req.params.projectId,
            ...stageData,
          });
        }
        stages = await storage.getStagesByProject(req.params.projectId);
      }

      // Build context from minimum details
      const md = minimumDetails as {
        problemStatement: string;
        userGoals: string[];
        v1Definition: string;
        mainObjects?: string[];
        mainActions?: string[];
        inspirationLink?: string;
        mustUseTools?: string;
        mustAvoidTools?: string;
      };

      const contextParts = [
        `PROBLEM: ${md.problemStatement}`,
        `USER GOALS: ${md.userGoals.join(", ")}`,
        `V1 DEFINITION: ${md.v1Definition}`,
      ];

      if (md.mainObjects?.length) contextParts.push(`MAIN OBJECTS: ${md.mainObjects.join(", ")}`);
      if (md.mainActions?.length) contextParts.push(`MAIN ACTIONS: ${md.mainActions.join(", ")}`);
      if (md.inspirationLink) contextParts.push(`INSPIRATION: ${md.inspirationLink}`);
      if (md.mustUseTools) contextParts.push(`MUST USE: ${md.mustUseTools}`);
      if (md.mustAvoidTools) contextParts.push(`MUST AVOID: ${md.mustAvoidTools}`);

      const appStyle = project.appStyle as { id: string; name: string; description?: string; tagline?: string; vibe?: string; bestFor?: string; brands?: string } | null;
      if (appStyle) {
        const styleParts = [`UI/UX STYLE: ${appStyle.name}`];
        if (appStyle.tagline) styleParts.push(`Style approach: ${appStyle.tagline}`);
        if (appStyle.vibe) styleParts.push(`Vibe: ${appStyle.vibe}`);
        if (appStyle.description) styleParts.push(`Custom description: ${appStyle.description}`);
        if (appStyle.brands) styleParts.push(`Reference brands: ${appStyle.brands}`);
        contextParts.push(styleParts.join(". "));
      }

      const minimalContext = contextParts.join("\n");

      const coreStagesToGenerate = stages.filter(s => s.stageNumber <= 4);

      // Batch-fetch all admin prompts once to avoid N queries in the loop
      const allAdminPrompts = await storage.getAllAdminPrompts();
      const adminPromptMap = new Map(allAdminPrompts.map(p => [p.targetKey, p]));

      await Promise.allSettled(coreStagesToGenerate.map(async (stage) => {
        const docPrompt = `Based on this minimal product context, generate content for the "${stage.title}" section.

${minimalContext}

Generate practical, actionable documentation based on the information provided. Be specific but acknowledge where more detail would be helpful. Focus on the core requirements and make reasonable assumptions where needed.${appStyle ? ` The UI/UX should follow a "${appStyle.name}" style direction.` : ''}`;

        try {
          const adminPrompt = adminPromptMap.get(`stage_${stage.stageNumber}`);
          const systemPromptToUse = adminPrompt?.content || stage.systemPrompt;

          const response = await aiService.chat([
            { role: "system", content: systemPromptToUse },
            { role: "user", content: docPrompt }
          ], "claude-sonnet");

          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content,
          });

          await storage.updateStage(stage.id, { progress: 100 });
        } catch (stageError) {
          console.error(`Error generating docs for stage ${stage.title}:`, stageError);
        }
      }));

      res.json({ message: "Documentation generated from minimum details" });
    } catch (error) {
      console.error("Min doc generation error:", error);
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
  app.get("/api/admin/prompts", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const prompts = await storage.getAllAdminPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching admin prompts:", error);
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.get("/api/admin/prompts/:id", authMiddleware, adminMiddleware, async (req, res) => {
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

  app.post("/api/admin/prompts", authMiddleware, adminMiddleware, async (req: any, res) => {
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

  app.put("/api/admin/prompts/:id", authMiddleware, adminMiddleware, async (req: any, res) => {
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

  app.delete("/api/admin/prompts/:id", authMiddleware, adminMiddleware, async (req, res) => {
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
  app.post("/api/admin/prompts/seed", authMiddleware, adminMiddleware, async (req: any, res) => {
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

  app.get("/api/admin/default-stages", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { DEFAULT_STAGES } = await import("@shared/schema");
      res.json(DEFAULT_STAGES);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch default stages" });
    }
  });

  app.get("/api/admin/interceptor-prompts", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { INTERCEPTOR_PROMPTS } = await import("@shared/schema");
      res.json(INTERCEPTOR_PROMPTS);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch interceptor prompts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
