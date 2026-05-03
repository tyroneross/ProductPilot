import type { Express, RequestHandler } from "express";
import { logger } from "./lib/logger";
import { randomUUID } from "crypto";
import { createServer, type Server } from "http";
import { runWithDbActorContext, storage, updateDbActorContext } from "./storage-hybrid";
import { aiService, type AIMessage, type LLMConfig } from "./services/ai";
import {
  insertProjectSchema,
  insertMessageSchema,
  updateStageSchema,
  insertAdminPromptSchema,
  INTERCEPTOR_PROMPTS,
  DEFAULT_STAGES,
  type Project,
  type Stage,
} from "@shared/schema";
import { z } from "zod";
import { extractUser, requireAuth, trustedOrigins as authTrustedOrigins } from "./auth";
import {
  buildDocumentGenerationPrompt,
  buildMinimumDetailsDocumentPrompt,
  buildProjectContext,
  buildStageRuntimeSystemPrompt,
  buildSurveyGenerationPrompt,
} from "./prompt-builders";

// Helper to resolve per-user LLM config from stored settings
async function getLLMConfig(req: any): Promise<LLMConfig | null> {
  if (!req.userId) return null;
  const settings = await storage.getUserSettings(req.userId);
  const apiKey = settings?.llm_api_key || settings?.llmApiKey;
  if (!apiKey) return null;
  return {
    provider: (settings.llm_provider || settings.llmProvider || 'groq') as LLMConfig['provider'],
    apiKey,
    model: settings.llm_model || settings.llmModel || undefined,
  };
}

// Admin allowlist by email only. Previous ID-based allowlist used stale Neon/Replit IDs.
const ADMIN_EMAILS = new Set(["tyrone.ross@gmail.com"]);

// Helper to get interceptor prompt by targetKey
const getInterceptorPrompt = (targetKey: string) =>
  INTERCEPTOR_PROMPTS.find(p => p.targetKey === targetKey);

const hasAdminAccess = (req: any) => {
  const email = typeof req.user?.email === "string" ? req.user.email.toLowerCase() : null;
  return Boolean(req.userId && email && ADMIN_EMAILS.has(email));
};

const isAdmin: RequestHandler = (req: any, res, next) => {
  if (!hasAdminAccess(req)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const DEMO_OWNER_COOKIE = "productpilot_demo_owner";
const DEMO_OWNER_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const SHOULD_SECURE_DEMO_COOKIE =
  process.env.NODE_ENV === "production" || process.env.BETTER_AUTH_URL?.startsWith("https://");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type ActorContext =
  | { kind: "user"; id: string }
  | { kind: "guest"; id: string }
  | { kind: "none" };

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((accumulator, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return accumulator;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      accumulator[key] = decodeURIComponent(value);
    }
    return accumulator;
  }, {});
}

function getOrigin(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function validateUnsafeRequestOrigin(req: any, res: any, next: any) {
  if (!req.path.startsWith("/api") || req.path.startsWith("/api/auth") || SAFE_METHODS.has(req.method)) {
    return next();
  }

  const allowedOrigins = new Set(authTrustedOrigins.map((origin) => getOrigin(origin)).filter(Boolean));
  const originHeader = req.get("origin");
  const refererHeader = req.get("referer");
  const requestOrigin = getOrigin(originHeader) || getOrigin(refererHeader);

  if ((originHeader || refererHeader) && !requestOrigin) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }

  if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }

  next();
}

function getGuestOwnerId(req: any): string | null {
  const cookies = parseCookies(req.headers?.cookie);
  const guestOwnerId = cookies[DEMO_OWNER_COOKIE];
  return typeof guestOwnerId === "string" && guestOwnerId.trim() ? guestOwnerId : null;
}

function setGuestOwnerCookie(res: any, guestOwnerId: string) {
  res.cookie(DEMO_OWNER_COOKIE, guestOwnerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: SHOULD_SECURE_DEMO_COOKIE,
    maxAge: DEMO_OWNER_COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

function clearGuestOwnerCookie(res: any) {
  res.clearCookie(DEMO_OWNER_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: SHOULD_SECURE_DEMO_COOKIE,
    path: "/",
  });
}

function getActorContext(req: any): ActorContext {
  if (req.userId) {
    return { kind: "user", id: req.userId };
  }

  const guestOwnerId = getGuestOwnerId(req);
  if (guestOwnerId) {
    return { kind: "guest", id: guestOwnerId };
  }

  return { kind: "none" };
}

function projectBelongsToActor(
  project: Project,
  actor: Exclude<ActorContext, { kind: "none" }>,
): boolean {
  if (actor.kind === "user") {
    return project.userId === actor.id;
  }

  return project.guestOwnerId === actor.id;
}

// Orphan-claim data-leak fix: ownerless rows are no longer silently adopted by the first
// requester. Guests who lose their cookie lose access (document UX for recovery separately).
// Admin path can manually reassign via a future /api/admin/projects/:id/reassign endpoint.
function isOrphanProject(project: Project): boolean {
  return !project.userId && !project.guestOwnerId;
}

function requireActor(
  req: any,
  res: any,
): Exclude<ActorContext, { kind: "none" }> | null {
  const actor = getActorContext(req);
  if (actor.kind === "none") {
    res.status(401).json({ message: "Authentication or demo mode is required" });
    return null;
  }

  return actor;
}

async function loadOwnedProject(
  req: any,
  res: any,
  projectId: string,
): Promise<{ actor: Exclude<ActorContext, { kind: "none" }>; project: Project } | null> {
  const actor = requireActor(req, res);
  if (!actor) {
    return null;
  }

  const project = await storage.getProject(projectId);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }

  if (isOrphanProject(project)) {
    // Ownerless rows are not auto-adopted. Return 404 so their existence isn't leaked.
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  if (!projectBelongsToActor(project, actor)) {
    res.status(403).json({ message: "You do not have access to this project" });
    return null;
  }

  // Sliding 30-day guest cookie refresh — active guests don't silently expire.
  if (actor.kind === "guest") {
    setGuestOwnerCookie(res, actor.id);
  }

  return { actor, project };
}

async function loadOwnedStage(
  req: any,
  res: any,
  stageId: string,
): Promise<{
  actor: Exclude<ActorContext, { kind: "none" }>;
  project: Project;
  stage: Stage;
} | null> {
  const actor = requireActor(req, res);
  if (!actor) {
    return null;
  }

  const stage = await storage.getStage(stageId);
  if (!stage) {
    res.status(404).json({ message: "Stage not found" });
    return null;
  }

  const project = await storage.getProject(stage.projectId);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }

  if (isOrphanProject(project)) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  if (!projectBelongsToActor(project, actor)) {
    res.status(403).json({ message: "You do not have access to this project" });
    return null;
  }
  if (actor.kind === "guest") {
    setGuestOwnerCookie(res, actor.id);
  }

  return { actor, project, stage };
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(extractUser);
  app.use(validateUnsafeRequestOrigin);
  app.use((req: any, _res, next) => {
    const actor = getActorContext(req);
    const guestOwnerId = getGuestOwnerId(req);
    runWithDbActorContext(
      {
        userId: actor.kind === "user" ? actor.id : null,
        guestOwnerId,
      },
      next,
    );
  });

  // Admin check endpoint
  app.get("/api/admin/check", requireAuth, (req: any, res) => {
    res.json({
      isAdmin: hasAdminAccess(req),
      user: { id: req.userId, email: req.user?.email ?? null },
    });
  });

  // Get user's in-progress draft project (for session persistence)
  app.get("/api/user/draft", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const draft = await storage.getUserDraft(userId);
      res.json(draft || null);
    } catch (error) {
      logger.error({ err: error }, "Error fetching user draft");
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  // Link a project to the current user
  app.post("/api/projects/:id/claim", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (project.userId && project.userId !== userId) {
        return res.status(403).json({ message: "Project already belongs to another user" });
      }

      const guestOwnerId = getGuestOwnerId(req);
      const callerOwnsDemoProject =
        !project.userId &&
        Boolean(project.guestOwnerId) &&
        project.guestOwnerId === guestOwnerId;

      // Orphan rows (neither userId nor guestOwnerId) are no longer claimable — prevents
      // the data-leak path where anyone could claim a guest's abandoned project.
      if (project.userId !== userId && !callerOwnsDemoProject) {
        return res.status(403).json({ message: "You do not have access to claim this project" });
      }

      const updatedProject =
        project.userId === userId
          ? project
          : await storage.updateProject(req.params.id, {
              userId,
              guestOwnerId: null,
            });

      clearGuestOwnerCookie(res);
      res.json(updatedProject);
    } catch (error) {
      logger.error({ err: error }, "Error claiming project");
      res.status(500).json({ message: "Failed to claim project" });
    }
  });

  // Projects
  app.get("/api/projects", async (req: any, res) => {
    try {
      const actor = getActorContext(req);
      const projects =
        actor.kind === "user"
          ? await storage.getProjectsByUserId(actor.id)
          : actor.kind === "guest"
            ? await storage.getProjectsByGuestOwnerId(actor.id)
            : [];
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.id);
      if (!projectAccess) {
        return;
      }
      res.json(projectAccess.project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req: any, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const actor = getActorContext(req);
      const demoModeRequested = req.body?.demoMode === true;

      if (actor.kind === "none" && !demoModeRequested) {
        return res.status(401).json({ message: "Sign in or explicitly start demo mode" });
      }

      const guestOwnerId =
        actor.kind === "guest"
          ? actor.id
          : actor.kind === "none"
            ? randomUUID()
            : null;

      if (guestOwnerId) {
        setGuestOwnerCookie(res, guestOwnerId);
        updateDbActorContext({ guestOwnerId });
      }

      const project = await storage.createProject({
        ...projectData,
        userId: actor.kind === "user" ? actor.id : null,
        guestOwnerId,
      });
      // Audit: record project creation (fire-and-forget; never throws)
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.kind === "user" ? actor.id : guestOwnerId,
        action: "project.create",
        resourceType: "project",
        resourceId: project.id,
        metadata: { name: project.name, mode: project.mode },
      }).catch((e) => logger.error({ err: e }, "[audit] project.create failed"));
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.id);
      if (!projectAccess) {
        return;
      }

      const updates = z.object({
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

      const updatedProject = await storage.updateProject(projectAccess.project.id, updates);
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.id);
      if (!projectAccess) {
        return;
      }

      const deleted = await storage.deleteProject(projectAccess.project.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      void storage.createAuditEvent({
        actorType: projectAccess.actor.kind,
        actorId: projectAccess.actor.id,
        action: "project.delete",
        resourceType: "project",
        resourceId: projectAccess.project.id,
        metadata: { name: projectAccess.project.name },
      }).catch((e) => logger.error({ err: e }, "[audit] project.delete failed"));
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Stages
  app.get("/api/projects/:projectId/stages", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }

      const stages = await storage.getStagesByProject(projectAccess.project.id);
      res.json(stages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });

  // Create stages for a project that doesn't have them (for legacy projects)
  app.post("/api/projects/:projectId/ensure-stages", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      
      const existingStages = await storage.getStagesByProject(projectAccess.project.id);
      if (existingStages.length > 0) {
        return res.json(existingStages);
      }
      
      // Create stages using the storage method
      const stages = await storage.ensureStagesForProject(projectAccess.project.id);
      res.status(201).json(stages);
    } catch (error) {
      logger.error({ err: error }, "Error ensuring stages");
      res.status(500).json({ message: "Failed to create stages" });
    }
  });

  app.get("/api/stages/:id", async (req: any, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.id);
      if (!stageAccess) {
        return;
      }
      res.json(stageAccess.stage);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stage" });
    }
  });

  app.patch("/api/stages/:id", async (req: any, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.id);
      if (!stageAccess) {
        return;
      }

      const updates = updateStageSchema.parse(req.body);
      const stage = await storage.updateStage(req.params.id, updates);
      if (!stage) {
        return res.status(404).json({ message: "Stage not found" });
      }
      res.json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid stage data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update stage" });
    }
  });

  // Messages
  app.get("/api/stages/:stageId/messages", async (req: any, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
      if (!stageAccess) {
        return;
      }

      const messages = await storage.getMessagesByStage(stageAccess.stage.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/stages/:stageId/messages", async (req: any, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
      if (!stageAccess) {
        return;
      }

      const messageData = insertMessageSchema.parse({
        ...req.body,
        stageId: stageAccess.stage.id,
      });
      
      const message = await storage.createMessage(messageData);
      
      // If this is a user message, generate AI response
      if (messageData.role === "user") {
        const { stage, project } = stageAccess;

        // Get existing messages (including the one we just created)
        const existingMessages = await storage.getMessagesByStage(stage.id);
        
        // Try to get admin prompt from database, fallback to stage's default systemPrompt
        const adminPrompt = await storage.getAdminPromptByTargetKey(`stage_${stage.stageNumber}`);
        const projectContext = buildProjectContext(project);
        
        // Log when context extraction succeeds or fails for debugging
        if (projectContext.length > 0) {
          logger.debug({ chars: projectContext.length }, "AI context enriched with project data");
        } else if (project.intakeAnswers || project.minimumDetails) {
          logger.warn({ projectId: project.id }, "Project has intake/details but context extraction failed");
        }
        const userMessageCount = existingMessages.filter(m => m.role === "user").length;
        const systemPromptToUse = buildStageRuntimeSystemPrompt({
          basePrompt: adminPrompt?.content || stage.systemPrompt,
          projectContext,
          stageNumber: stage.stageNumber,
          userMessageCount,
        });

        // Build conversation history (existingMessages already includes the new user message we just created)
        const aiMessages: AIMessage[] = [
          { role: "system", content: systemPromptToUse },
          ...existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
        ];

        try {
          const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";
          const userConfig = await getLLMConfig(req);
          // Conversation stages use 'chat' tier (Groq default); stages 4+ are complex reasoning.
          const task = stage.stageNumber >= 4 ? 'complex' : 'chat';
          const aiResponse = await aiService.chat(aiMessages, modelToUse, userConfig, task, {
            userId: stageAccess.actor.kind === 'user' ? stageAccess.actor.id : null,
            guestOwnerId: stageAccess.actor.kind === 'guest' ? stageAccess.actor.id : null,
            projectId: project.id,
            stageId: stage.id,
          });

          // Create AI response message
          const aiMessage = await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: aiResponse.content,
          });

          // Throttle progress assessment — run on 1st user message and every 3rd after.
          // Cuts progress-LLM calls by ~67% without meaningfully stale UI (stage.progress persists between checks).
          const shouldAssessProgress = userMessageCount === 1 || userMessageCount % 3 === 0;
          if (shouldAssessProgress) {
            const allMessages = [
              ...existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
              { role: "assistant" as const, content: aiResponse.content }
            ];
            const progress = await aiService.calculateProgress(
              allMessages,
              [stage.description] // In production, define more specific goals
            );

            await storage.updateStage(stage.id, { progress });
          }

          res.status(201).json({ userMessage: message, aiMessage });
        } catch (aiError) {
          logger.error({ err: aiError }, "AI service error");
          res.status(503).json({ userMessage: message, aiMessage: null, error: "AI service unavailable" });
        }
      } else {
        res.status(201).json({ userMessage: message });
      }
    } catch (error) {
      logger.error({ err: error }, "Message creation error");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create message", error: String(error) });
    }
  });

  // Streaming variant — SSE; emits delta chunks and a final `done` event with the full content.
  // Same semantics as POST /messages above (persists user + assistant messages, updates progress).
  app.post("/api/stages/:stageId/messages/stream", async (req: any, res) => {
    const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
    if (!stageAccess) return;

    let userMessage: any;
    try {
      const messageData = insertMessageSchema.parse({ ...req.body, stageId: stageAccess.stage.id });
      userMessage = await storage.createMessage(messageData);

      if (messageData.role !== "user") {
        res.status(400).json({ message: "Streaming only supports user-initiated messages" });
        return;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.issues });
      }
      return res.status(500).json({ message: "Failed to create message", error: String(error) });
    }

    const { stage, project } = stageAccess;
    const existingMessages = await storage.getMessagesByStage(stage.id);
    const adminPrompt = await storage.getAdminPromptByTargetKey(`stage_${stage.stageNumber}`);
    const projectContext = buildProjectContext(project);
    const userMessageCount = existingMessages.filter((m) => m.role === "user").length;
    const systemPromptToUse = buildStageRuntimeSystemPrompt({
      basePrompt: adminPrompt?.content || stage.systemPrompt,
      projectContext,
      stageNumber: stage.stageNumber,
      userMessageCount,
    });
    const aiMessages: AIMessage[] = [
      { role: "system", content: systemPromptToUse },
      ...existingMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Echo back the persisted user message first so the client can reconcile
    send("user", { userMessage });

    try {
      const userConfig = await getLLMConfig(req);
      const task = stage.stageNumber >= 4 ? "complex" : "chat";
      const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";

      let full = "";
      for await (const chunk of aiService.chatStream(aiMessages, modelToUse, userConfig, task, {
        userId: stageAccess.actor.kind === 'user' ? stageAccess.actor.id : null,
        guestOwnerId: stageAccess.actor.kind === 'guest' ? stageAccess.actor.id : null,
        projectId: project.id,
        stageId: stage.id,
      })) {
        if (chunk.type === "delta") {
          full += chunk.text;
          send("delta", { text: chunk.text });
        } else {
          full = chunk.fullContent;
        }
      }

      const aiMessage = await storage.createMessage({
        stageId: stage.id,
        role: "assistant",
        content: full,
      });
      send("message", { aiMessage });

      // Throttled progress assessment — same rule as non-streaming path
      const shouldAssessProgress = userMessageCount === 1 || userMessageCount % 3 === 0;
      if (shouldAssessProgress) {
        const allMessages = [
          ...existingMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "assistant" as const, content: full },
        ];
        const progress = await aiService.calculateProgress(allMessages, [stage.description]);
        await storage.updateStage(stage.id, { progress });
        send("progress", { progress });
      }

      send("done", {});
      res.end();
    } catch (err) {
      logger.error({ err }, "Stream error");
      send("error", { message: err instanceof Error ? err.message : "AI service error" });
      res.end();
    }
  });

  // Survey endpoints
  app.post("/api/projects/:projectId/generate-survey", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;

      // Get the discovery chat messages to inform the survey
      const stages = await storage.getStagesByProject(project.id);
      const prdStage = stages.find(s => s.stageNumber === 2);
      const discoveryMessages = prdStage ? await storage.getMessagesByStage(prdStage.id) : [];

      const surveyPrompt = buildSurveyGenerationPrompt({
        projectDescription: project.description,
        discoveryMessages,
      });

      // Use interceptor prompt from schema.ts for survey generation
      const surveyInterceptor = getInterceptorPrompt("survey_generation_system");
      const systemPrompt = surveyInterceptor?.isEnabled 
        ? surveyInterceptor.systemPrompt 
        : "You are a product requirements expert. Generate surveys that efficiently capture high-value information using sliders and select inputs. Always return valid JSON.";
      
      // Survey generation is structured + moderately complex — route to Sonnet-tier when Anthropic is set.
      const response = await aiService.generateStructuredOutput([
        { role: "system", content: systemPrompt },
        { role: "user", content: surveyPrompt }
      ], "claude-sonnet", undefined, 'deliverable');

      // Update project with the survey definition
      await storage.updateProject(project.id, {
        surveyDefinition: response,
        surveyPhase: "survey",
      });

      res.json({ surveyDefinition: response });
    } catch (error) {
      logger.error({ err: error }, "Survey generation error");
      res.status(500).json({ message: "Failed to generate survey" });
    }
  });

  app.post("/api/projects/:projectId/submit-survey", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;

      const { responses } = req.body;
      
      // Save survey responses
      await storage.updateProject(project.id, {
        surveyResponses: responses,
        surveyPhase: "complete",
      });

      res.json({ message: "Survey submitted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit survey" });
    }
  });

  app.post("/api/projects/:projectId/generate-docs-from-survey", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;

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
      const allStages = await storage.getStagesByProject(project.id);
      
      // Filter stages based on preferences (if provided), otherwise generate all
      const stages = documentPreferences.length > 0
        ? allStages.filter(s => preferencesMap.has(s.id))
        : allStages;
      
      // Get active custom prompts organized by category
      const customPrompts = (project.customPrompts || []) as { id: string; name: string; prompt: string; category: string; isActive: boolean; }[];
      const activePrompts = customPrompts.filter(p => p.isActive);

      const stageCategoryMap: Record<number, string> = {
        1: 'requirements',
        2: 'requirements',
        3: 'features',
        4: 'architecture',
        5: 'coding',
        6: 'testing',
      };

      // Batch-fetch all admin prompts once to avoid N queries in the loop
      const allAdminPrompts = await storage.getAllAdminPrompts();
      const adminPromptMap = new Map(allAdminPrompts.map(p => [p.targetKey, p]));

      const userConfig = await getLLMConfig(req);

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
        const docPrompt = buildDocumentGenerationPrompt({
          stage,
          surveyDefinition: project.surveyDefinition,
          surveyResponses: project.surveyResponses,
          detailLevel,
          activePrompts,
          relevantPrompts,
          productDescription: project.description,
        });

        try {
          // Use pre-fetched admin prompt map to avoid per-stage DB query
          const adminPrompt = adminPromptMap.get(`stage_${stage.stageNumber}`);
          const systemPromptToUse = adminPrompt?.content || stage.systemPrompt;

          // Deliverable generation — route to Anthropic Sonnet when available (stage 4+ uses Opus).
          const task = stage.stageNumber >= 4 ? 'complex' : 'deliverable';
          const response = await aiService.chat([
            { role: "system", content: systemPromptToUse },
            { role: "user", content: docPrompt }
          ], "claude-sonnet", userConfig, task, {
            userId: projectAccess.actor.kind === 'user' ? projectAccess.actor.id : null,
            guestOwnerId: projectAccess.actor.kind === 'guest' ? projectAccess.actor.id : null,
            projectId: project.id,
            stageId: stage.id,
          });

          // Create a message in the stage with the generated content.
          // kind='deliverable' distinguishes a final doc from conversational turns.
          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content,
            kind: "deliverable",
          });

          // Update stage progress to 100%
          await storage.updateStage(stage.id, { progress: 100 });

          // Audit: record stage regeneration (fire-and-forget; never throws).
          // Matches the other 4 audit write sites (project.create, project.delete,
          // admin.prompt.create, admin.prompt.update).
          void storage.createAuditEvent({
            actorType: projectAccess.actor.kind,
            actorId: projectAccess.actor.kind === "user"
              ? projectAccess.actor.id
              : projectAccess.actor.kind === "guest"
                ? projectAccess.actor.id
                : null,
            action: "stage.regenerate",
            resourceType: "stage",
            resourceId: stage.id,
            metadata: {
              projectId: project.id,
              stageNumber: stage.stageNumber,
              detailLevel,
            },
          }).catch((e) => logger.error({ err: e }, "[audit] stage.regenerate failed"));
        } catch (stageError) {
          logger.error({ err: stageError, stageTitle: stage.title }, "Error generating docs for stage");
        }
      }))

      res.json({ message: "Documentation generated successfully" });
    } catch (error) {
      logger.error({ err: error }, "Doc generation error");
      res.status(500).json({ message: "Failed to generate documentation" });
    }
  });

  // Generate docs from minimum details only (faster path for quick start)
  app.post("/api/projects/:projectId/generate-docs-from-minimum", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;

      const minimumDetails = req.body.minimumDetails || project.minimumDetails;
      if (!minimumDetails) {
        return res.status(400).json({ message: "Minimum details not provided" });
      }

      // Ensure project has stages
      let stages = await storage.getStagesByProject(project.id);
      if (stages.length === 0) {
        for (const stageData of DEFAULT_STAGES) {
          await storage.createStage({
            projectId: project.id,
            stageNumber: stageData.stageNumber,
            title: stageData.title,
            description: stageData.description,
            systemPrompt: stageData.systemPrompt,
            aiModel: stageData.aiModel || null,
          });
        }
        stages = await storage.getStagesByProject(project.id);
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
      let appStyleSummary: string | null = null;
      if (appStyle) {
        const styleParts = [`UI/UX STYLE: ${appStyle.name}`];
        if (appStyle.tagline) styleParts.push(`Style approach: ${appStyle.tagline}`);
        if (appStyle.vibe) styleParts.push(`Vibe: ${appStyle.vibe}`);
        if (appStyle.description) styleParts.push(`Custom description: ${appStyle.description}`);
        if (appStyle.brands) styleParts.push(`Reference brands: ${appStyle.brands}`);
        appStyleSummary = styleParts.join(". ");
        contextParts.push(appStyleSummary);
      }

      const minimalContext = contextParts.join("\n");

      const coreStagesToGenerate = stages.filter(s => s.stageNumber <= 4);

      // Batch-fetch all admin prompts once to avoid N queries in the loop
      const allAdminPrompts = await storage.getAllAdminPrompts();
      const adminPromptMap = new Map(allAdminPrompts.map(p => [p.targetKey, p]));

      const userConfig = await getLLMConfig(req);

      await Promise.allSettled(coreStagesToGenerate.map(async (stage) => {
        const docPrompt = buildMinimumDetailsDocumentPrompt({
          stage,
          minimalContext,
          appStyleSummary,
        });

        try {
          const adminPrompt = adminPromptMap.get(`stage_${stage.stageNumber}`);
          const systemPromptToUse = adminPrompt?.content || stage.systemPrompt;

          const task = stage.stageNumber >= 4 ? 'complex' : 'deliverable';
          const response = await aiService.chat([
            { role: "system", content: systemPromptToUse },
            { role: "user", content: docPrompt }
          ], "claude-sonnet", userConfig, task, {
            userId: projectAccess.actor.kind === 'user' ? projectAccess.actor.id : null,
            guestOwnerId: projectAccess.actor.kind === 'guest' ? projectAccess.actor.id : null,
            projectId: project.id,
            stageId: stage.id,
          });

          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content,
            kind: "deliverable",
          });

          await storage.updateStage(stage.id, { progress: 100 });
        } catch (stageError) {
          logger.error({ err: stageError, stageTitle: stage.title }, "Error generating docs for stage (minimum)");
        }
      }));

      res.json({ message: "Documentation generated from minimum details" });
    } catch (error) {
      logger.error({ err: error }, "Min doc generation error");
      res.status(500).json({ message: "Failed to generate documentation" });
    }
  });

  // ── Adaptive intake (Phase 2) ─────────────────────────────────────────
  // Three endpoints:
  //   POST /api/projects/:projectId/intake/next      — next question or "infer"/"done"
  //   POST /api/projects/:projectId/intake/answer    — persist a user answer
  //   POST /api/projects/:projectId/intake/finalize  — render Stage 1 Brief from productState
  //
  // Gating:
  //   - All three require an authenticated user OR a guest session (loadOwnedProject).
  //   - All three require project.intakeMode === "adaptive" — else respond 409 (conflict).
  //   - All three write to audit_events.
  //
  // Security:
  //   - Project ownership enforced via loadOwnedProject (RLS already in effect via
  //     runWithDbActorContext middleware at the top of this file).
  //   - intake-controller.ts strips secret-shaped strings before any provider call.

  function requireAdaptiveMode(project: Project, res: any): boolean {
    if (project.intakeMode !== "adaptive") {
      res.status(409).json({
        message: `Adaptive intake is not enabled for this project (intake_mode='${project.intakeMode}')`,
        code: "intake_mode_not_adaptive",
      });
      return false;
    }
    return true;
  }

  // POST /api/projects/:projectId/intake/next
  app.post("/api/projects/:projectId/intake/next", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;

      const { hydrateProductState, hydrateSpec, nextStep } = await import("./services/intake-controller");

      const productState = hydrateProductState(project.productState);
      const spec = hydrateSpec(null, `spec-${project.id}`, project.name, project.description);
      // Phase 2 reads intake_answers from DB (intake_questions table). Phase 3 will
      // join in the latest spec_artifacts payload. For now, derive history from intake_questions.
      const intakeQs = await storage.getIntakeQuestionsByProject(project.id);
      const history = intakeQs.map((row) => ({
        step: row.step,
        method: row.method,
        question: row.questionText,
        answer: row.answerText,
        metadata: row.metadata,
      }));

      const llmConfig = await getLLMConfig(req);
      const action = await nextStep({
        productState,
        spec,
        history,
        llmConfig,
        context: {
          userId: actor.kind === "user" ? actor.id : null,
          guestOwnerId: actor.kind === "guest" ? actor.id : null,
          projectId: project.id,
        },
      });

      // Audit row — every "next" call is a side-effecting LLM call.
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.next",
        resourceType: "project",
        resourceId: project.id,
        metadata: { action: action.action, historyLength: history.length },
      }).catch((e) => logger.error({ err: e }, "[audit] intake.next failed"));

      res.json(action);
    } catch (error) {
      logger.error({ err: error }, "[intake/next] error");
      res.status(500).json({ message: "Failed to compute next intake step" });
    }
  });

  // POST /api/projects/:projectId/intake/answer
  app.post("/api/projects/:projectId/intake/answer", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;

      const body = z.object({
        questionText: z.string().min(1).max(2000),
        answer: z.string().min(1).max(8000),
        method: z.enum(["jtbd", "qfd", "pugh"]).nullable().optional(),
        questionId: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }).parse(req.body);

      const existing = await storage.getIntakeQuestionsByProject(project.id);
      const step = existing.length + 1;

      // Persist the question + answer atomically — one row per turn.
      const row = await storage.createIntakeQuestion({
        projectId: project.id,
        step,
        method: body.method ?? null,
        questionText: body.questionText,
        answerText: body.answer,
        metadata: body.metadata ?? null,
        answeredAt: new Date(),
      });

      // Update productState in the project row.
      const { hydrateProductState, ingestAnswer } = await import("./services/intake-controller");
      const currentState = hydrateProductState(project.productState);
      const { productState } = ingestAnswer({
        state: currentState,
        answer: {
          projectId: project.id,
          step,
          questionText: body.questionText,
          answer: body.answer,
          method: body.method ?? null,
          metadata: body.metadata,
        },
      });

      const updated = await storage.updateProject(project.id, { productState });

      // Audit metadata includes the promoted spec_path / topic so the timeline
      // shows which slice of the spec each turn advanced. Non-PII, safe to log.
      const promotedSpecPath = (body.metadata as any)?.extracts_into?.spec_path ?? null;
      const promotedTopic = (body.metadata as any)?.topic ?? null;
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.answer",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          step,
          method: body.method ?? null,
          intakeQuestionId: row.id,
          promotedSpecPath,
          promotedTopic,
        },
      }).catch((e) => logger.error({ err: e }, "[audit] intake.answer failed"));

      res.json({
        productState: updated?.productState ?? productState,
        intakeQuestion: row,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid intake answer", errors: error.issues });
      }
      logger.error({ err: error }, "[intake/answer] error");
      res.status(500).json({ message: "Failed to ingest intake answer" });
    }
  });

  // POST /api/projects/:projectId/intake/finalize
  //
  // Phase 4: terminal step accepts an OPTIONAL tradeoffWeights body — the 100-point
  // allocation across the six axes plus an unacceptable_tradeoff choice. Validation:
  //   - When productState already has weights set (sum===100, schema-valid), body
  //     may omit them. We use the stored weights.
  //   - When the project does NOT already have weights AND body omits them → 400.
  //   - When body weights fail Zod (sum!==100, missing axis, bad enum) → 400.
  //   - Successful body is persisted to productState BEFORE finalize runs, and
  //     audit_events captures the weights JSON (security gate: weights are
  //     non-PII metadata; safe to log).
  app.post("/api/projects/:projectId/intake/finalize", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;

      const {
        hydrateProductState,
        finalize,
        applyTradeoffWeights,
        weightsAreSet,
      } = await import("./services/intake-controller");
      let productState = hydrateProductState(project.productState);

      const bodyWeights = req.body?.tradeoffWeights;
      let weightsApplied = false;
      if (bodyWeights !== undefined) {
        try {
          const result = applyTradeoffWeights({ state: productState, weights: bodyWeights });
          productState = result.productState;
          await storage.updateProject(project.id, { productState });
          weightsApplied = true;
        } catch (err) {
          if (err instanceof z.ZodError) {
            return res
              .status(400)
              .json({ message: "Invalid tradeoff weights", errors: err.issues });
          }
          throw err;
        }
      } else if (!weightsAreSet(productState.tradeoffWeights)) {
        return res.status(400).json({
          message:
            "Tradeoff weights are required to finalize. Provide a tradeoffWeights body summing to 100 across the six axes plus an unacceptable_tradeoff.",
          code: "tradeoff_weights_required",
        });
      }

      const { spec, renderedMarkdown } = finalize({
        projectId: project.id,
        productName: project.name,
        productDescription: project.description,
        productState,
        existingSpec: null,
      });

      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.finalize",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          specId: spec.id,
          markdownChars: renderedMarkdown.length,
          weightsApplied,
          tradeoffWeights: productState.tradeoffWeights ?? null,
        },
      }).catch((e) => logger.error({ err: e }, "[audit] intake.finalize failed"));

      res.json({ spec, renderedMarkdown, productState });
    } catch (error) {
      logger.error({ err: error }, "[intake/finalize] error");
      res.status(500).json({ message: "Failed to finalize intake" });
    }
  });

  // ── Spec linter (Phase 3) ─────────────────────────────────────────────
  // Two endpoints:
  //   POST /api/projects/:projectId/spec/lint    — run deterministic + Haiku-tier checks
  //   POST /api/projects/:projectId/spec/waive   — record a written waiver for a blocker
  //
  // Gating mirrors the intake routes: ownership via loadOwnedProject + adaptive-mode gate.
  // Audit row written on every request. PII handling-note rule is non-waivable (server-side).

  // POST /api/projects/:projectId/spec/lint
  app.post("/api/projects/:projectId/spec/lint", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;

      const { hydrateProductState, hydrateSpec, finalize } = await import("./services/intake-controller");
      const { lintSpec } = await import("./services/spec-linter");

      // Optional inline override — caller may post a Spec to lint a draft that
      // is not yet persisted. When omitted, we hydrate from productState the
      // same way intake/finalize does.
      const productState = hydrateProductState(project.productState);
      let spec;
      const inlineSpec = req.body?.spec;
      if (inlineSpec && typeof inlineSpec === "object") {
        spec = hydrateSpec(inlineSpec, `spec-${project.id}`, project.name, project.description);
      } else {
        const built = finalize({
          projectId: project.id,
          productName: project.name,
          productDescription: project.description,
          productState,
          existingSpec: null,
        });
        spec = built.spec;
      }

      const llmConfig = await getLLMConfig(req);
      const result = await lintSpec({
        spec,
        productState,
        llmConfig,
        context: {
          userId: actor.kind === "user" ? actor.id : null,
          guestOwnerId: actor.kind === "guest" ? actor.id : null,
          projectId: project.id,
        },
      });

      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "spec.lint",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          issueCount: result.issues.length,
          blockerCount: result.blockerCount,
          nonWaivableCount: result.nonWaivableCount,
          llmRan: result.llmRan,
        },
      }).catch((e) => logger.error({ err: e }, "[audit] spec.lint failed"));

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, "[spec/lint] error");
      res.status(500).json({ message: "Failed to lint spec" });
    }
  });

  // POST /api/projects/:projectId/spec/waive
  // Body: { issueId: string, rule: string, reason: string, refs?: Array<{kind, id}> }
  app.post("/api/projects/:projectId/spec/waive", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;

      const body = z.object({
        issueId: z.string().min(1).max(200),
        rule: z.string().min(1).max(200),
        reason: z.string().min(1).max(2000),
        refs: z.array(z.object({
          kind: z.string().max(40),
          id: z.string().max(200),
        })).optional(),
      }).parse(req.body);

      // Server-side enforcement of the non-waivable PII rule. The UI should
      // never attempt this, but a manual API call must be rejected anyway.
      if (body.rule === "pii_handling_note_missing") {
        return res.status(409).json({
          message: "This rule is non-waivable: PII handling notes are required by policy.",
          code: "rule_non_waivable",
          rule: body.rule,
        });
      }

      const { sanitizeWaiverReason } = await import("./services/spec-linter");
      const cleanReason = sanitizeWaiverReason(body.reason);
      if (cleanReason.length === 0) {
        return res.status(400).json({ message: "Waiver reason is empty after sanitization." });
      }

      // Persist to productState.workingMemory.waivers — keyed by issueId. The
      // working-memory bag already round-trips through ProductStateSchema, so no
      // schema change required.
      const { hydrateProductState } = await import("./services/intake-controller");
      const currentState = hydrateProductState(project.productState);
      const waivers = (currentState.workingMemory.waivers as Record<string, unknown> | undefined) ?? {};
      waivers[body.issueId] = {
        issueId: body.issueId,
        rule: body.rule,
        reason: cleanReason,
        refs: body.refs ?? [],
        actorId: actor.id,
        actorKind: actor.kind,
        waivedAt: new Date().toISOString(),
      };
      const nextState = {
        ...currentState,
        workingMemory: { ...currentState.workingMemory, waivers },
      };
      await storage.updateProject(project.id, { productState: nextState });

      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "spec.waive",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          issueId: body.issueId,
          rule: body.rule,
          reasonChars: cleanReason.length,
        },
      }).catch((e) => logger.error({ err: e }, "[audit] spec.waive failed"));

      res.json({
        ok: true,
        waiver: waivers[body.issueId],
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid waiver payload", errors: error.issues });
      }
      logger.error({ err: error }, "[spec/waive] error");
      res.status(500).json({ message: "Failed to record waiver" });
    }
  });

  // ── Coding-agent handoff export (Phase 5) ──────────────────────────────
  // GET /api/projects/:projectId/handoff.md
  //
  // Returns the alpha-completion artifact: a Markdown handoff a coding agent
  // (Claude Code, Cursor, Codex) consumes directly.
  //
  // Gating ladder (each returns 409 with a distinct code so the client can
  // surface a useful error):
  //   1. Auth        — loadOwnedProject (401 unauth, 403 cross-tenant).
  //   2. Mode        — intake_mode === 'adaptive' (409 intake_mode_not_adaptive).
  //   3. Weights     — productState.tradeoffWeights set (409 tradeoff_weights_required).
  //   4. PII         — no non-waivable lint issues (409 pii_handling_note_missing).
  //   5. Lint blocks — no unwaived blockers (409 unwaived_blocker_present + issue list).
  //
  // Audit row written on every request — success or failure.
  // Content-Type: text/markdown; charset=utf-8.
  // Body content: scrubbed via scrubSecretsDeep + secret-shaped regex defense.
  app.get("/api/projects/:projectId/handoff.md", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;

      const { hydrateProductState, finalize, weightsAreSet } = await import(
        "./services/intake-controller"
      );
      const { lintSpec } = await import("./services/spec-linter");
      const { generateHandoff } = await import("./services/agent-handoff");
      const { scrubSecretsDeep } = await import("./lib/secret-crypto");

      const productState = hydrateProductState(project.productState);

      // Gate 3: weights must be allocated. Mirrors the intake/finalize gate.
      if (!weightsAreSet(productState.tradeoffWeights)) {
        void storage.createAuditEvent({
          actorType: actor.kind,
          actorId: actor.id,
          action: "handoff.export",
          resourceType: "project",
          resourceId: project.id,
          metadata: { outcome: "blocked", reason: "tradeoff_weights_required" },
        }).catch((e) => logger.error({ err: e }, "[audit] handoff.export failed"));
        return res.status(409).json({
          message:
            "Tradeoff weights are required before export. Allocate the 100-point distribution across the six axes plus an unacceptable_tradeoff.",
          code: "tradeoff_weights_required",
        });
      }

      // Build the spec the same way intake/finalize does.
      const built = finalize({
        projectId: project.id,
        productName: project.name,
        productDescription: project.description,
        productState,
        existingSpec: null,
      });
      const spec = built.spec;

      // Run the linter (deterministic + LLM tier when key present).
      const llmConfig = await getLLMConfig(req);
      const lint = await lintSpec({
        spec,
        productState,
        llmConfig,
        context: {
          userId: actor.kind === "user" ? actor.id : null,
          guestOwnerId: actor.kind === "guest" ? actor.id : null,
          projectId: project.id,
        },
      });

      // Load waivers from working memory.
      const waiverBag =
        (productState.workingMemory.waivers as Record<string, unknown> | undefined) ?? {};
      const isWaived = (issueId: string) =>
        Object.prototype.hasOwnProperty.call(waiverBag, issueId);

      // Gate 4: any non-waivable issue is unconditionally blocking. The PII
      // handling-note rule sets waivable=false, so any issue with waivable=false
      // is server-policy-enforced regardless of severity.
      const nonWaivable = lint.issues.filter((i) => i.waivable === false);
      if (nonWaivable.length > 0) {
        const issueIds = nonWaivable.map((i) => i.id);
        const waiverIds = Object.keys(waiverBag);
        void storage.createAuditEvent({
          actorType: actor.kind,
          actorId: actor.id,
          action: "handoff.export",
          resourceType: "project",
          resourceId: project.id,
          metadata: {
            outcome: "blocked",
            reason: "pii_handling_note_missing",
            nonWaivableCount: nonWaivable.length,
            waiverIds,
          },
        }).catch((e) => logger.error({ err: e }, "[audit] handoff.export failed"));
        return res.status(409).json({
          message:
            "Export blocked: one or more non-waivable issues remain. PII DataPoints without handlingNote are non-waivable by policy.",
          code: "pii_handling_note_missing",
          issues: nonWaivable.map((i) => ({
            id: i.id,
            rule: i.rule,
            message: i.message,
            refs: i.refs,
          })),
        });
      }

      // Gate 5: any unwaived blocker fails export.
      const unwaivedBlockers = lint.issues.filter(
        (i) => i.severity === "block" && !isWaived(i.id),
      );
      if (unwaivedBlockers.length > 0) {
        const waiverIds = Object.keys(waiverBag);
        void storage.createAuditEvent({
          actorType: actor.kind,
          actorId: actor.id,
          action: "handoff.export",
          resourceType: "project",
          resourceId: project.id,
          metadata: {
            outcome: "blocked",
            reason: "unwaived_blocker_present",
            unwaivedBlockerCount: unwaivedBlockers.length,
            blockerIds: unwaivedBlockers.map((i) => i.id),
            waiverIds,
          },
        }).catch((e) => logger.error({ err: e }, "[audit] handoff.export failed"));
        return res.status(409).json({
          message: `Export blocked: ${unwaivedBlockers.length} unwaived blocker${unwaivedBlockers.length === 1 ? "" : "s"} remain.`,
          code: "unwaived_blocker_present",
          issues: unwaivedBlockers.map((i) => ({
            id: i.id,
            rule: i.rule,
            message: i.message,
            refs: i.refs,
          })),
        });
      }

      // All gates clear. Scrub once at the boundary as defense in depth, then render.
      const safeSpec = scrubSecretsDeep(spec) as typeof spec;
      const safeProductState = scrubSecretsDeep(productState) as typeof productState;
      const handoffMarkdown = generateHandoff(safeSpec, safeProductState);

      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "handoff.export",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          outcome: "success",
          markdownChars: handoffMarkdown.length,
          platformTarget: spec.platformTarget,
          waiverIds: Object.keys(waiverBag),
        },
      }).catch((e) => logger.error({ err: e }, "[audit] handoff.export failed"));

      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.status(200).send(handoffMarkdown);
    } catch (error) {
      logger.error({ err: error }, "[handoff.md] error");
      res.status(500).json({ message: "Failed to generate handoff" });
    }
  });

  // Export functionality
  app.get("/api/projects/:projectId/export", async (req: any, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;

      const stages = await storage.getStagesByProject(project.id);
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
  app.get("/api/admin/prompts", requireAuth, isAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllAdminPrompts();
      res.json(prompts);
    } catch (error) {
      logger.error({ err: error }, "Error fetching admin prompts");
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.get("/api/admin/prompts/:id", requireAuth, isAdmin, async (req, res) => {
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

  app.post("/api/admin/prompts", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const promptData = insertAdminPromptSchema.parse(req.body);
      const userId = req.userId || "unknown";
      const prompt = await storage.createAdminPrompt({
        ...promptData,
        updatedBy: userId,
      });
      void storage.createAuditEvent({
        actorType: "admin",
        actorId: userId,
        action: "admin.prompt.create",
        resourceType: "admin_prompt",
        resourceId: prompt.id,
        metadata: { targetKey: prompt.targetKey, scope: prompt.scope },
      }).catch((e) => logger.error({ err: e }, "[audit] admin.prompt.create failed"));
      res.status(201).json(prompt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.issues });
      }
      logger.error({ err: error }, "Error creating prompt");
      res.status(500).json({ message: "Failed to create prompt" });
    }
  });

  app.put("/api/admin/prompts/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const updates = insertAdminPromptSchema.partial().parse(req.body);
      const userId = req.userId || "unknown";
      const prompt = await storage.updateAdminPrompt(req.params.id, {
        ...updates,
        updatedBy: userId,
      });
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      void storage.createAuditEvent({
        actorType: "admin",
        actorId: userId,
        action: "admin.prompt.update",
        resourceType: "admin_prompt",
        resourceId: prompt.id,
        metadata: { targetKey: prompt.targetKey },
      }).catch((e) => logger.error({ err: e }, "[audit] admin.prompt.update failed"));
      res.json(prompt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update prompt" });
    }
  });

  app.delete("/api/admin/prompts/:id", requireAuth, isAdmin, async (req, res) => {
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
  app.post("/api/admin/prompts/seed", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const existingPrompts = await storage.getAllAdminPrompts();
      if (existingPrompts.length > 0) {
        return res.json({ message: "Prompts already exist", count: existingPrompts.length });
      }
      
      const userId = req.userId || "system";
      await storage.seedDefaultPrompts(userId);
      const prompts = await storage.getAllAdminPrompts();
      res.json({ message: "Default prompts seeded", count: prompts.length });
    } catch (error) {
      logger.error({ err: error }, "Error seeding prompts");
      res.status(500).json({ message: "Failed to seed prompts" });
    }
  });

  app.get("/api/admin/default-stages", requireAuth, isAdmin, async (req, res) => {
    try {
      const { DEFAULT_STAGES } = await import("@shared/schema");
      res.json(DEFAULT_STAGES);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch default stages" });
    }
  });

  app.get("/api/admin/interceptor-prompts", requireAuth, isAdmin, async (req, res) => {
    try {
      const { INTERCEPTOR_PROMPTS } = await import("@shared/schema");
      res.json(INTERCEPTOR_PROMPTS);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch interceptor prompts" });
    }
  });

  // ── Admin observability: audit_events + llm_calls ──
  // List + detail endpoints. Read-only. Filters are optional string equalities.
  // Pagination via `limit` (max 200, default 50) + `offset` (default 0).

  const parseIntSafe = (v: unknown, fallback: number): number => {
    const n = typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const pickString = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

  app.get("/api/admin/audit-events", requireAuth, isAdmin, async (req, res) => {
    try {
      const { rows, total } = await storage.listAuditEvents({
        actorType: pickString(req.query.actorType),
        actorId: pickString(req.query.actorId),
        action: pickString(req.query.action),
        resourceType: pickString(req.query.resourceType),
        resourceId: pickString(req.query.resourceId),
        limit: Math.min(parseIntSafe(req.query.limit, 50), 200),
        offset: parseIntSafe(req.query.offset, 0),
      });
      res.json({ rows, total });
    } catch (error) {
      logger.error({ err: error }, "Error listing audit events");
      res.status(500).json({ message: "Failed to list audit events" });
    }
  });

  app.get("/api/admin/audit-events/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const event = await storage.getAuditEvent(req.params.id);
      if (!event) return res.status(404).json({ message: "Not found" });
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit event" });
    }
  });

  app.get("/api/admin/llm-calls", requireAuth, isAdmin, async (req, res) => {
    try {
      const { rows, total } = await storage.listLlmCalls({
        userId: pickString(req.query.userId),
        guestOwnerId: pickString(req.query.guestOwnerId),
        projectId: pickString(req.query.projectId),
        stageId: pickString(req.query.stageId),
        provider: pickString(req.query.provider),
        model: pickString(req.query.model),
        task: pickString(req.query.task),
        status: pickString(req.query.status),
        limit: Math.min(parseIntSafe(req.query.limit, 50), 200),
        offset: parseIntSafe(req.query.offset, 0),
      });
      res.json({ rows, total });
    } catch (error) {
      logger.error({ err: error }, "Error listing LLM calls");
      res.status(500).json({ message: "Failed to list LLM calls" });
    }
  });

  app.get("/api/admin/llm-calls/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const call = await storage.getLlmCall(req.params.id);
      if (!call) return res.status(404).json({ message: "Not found" });
      res.json(call);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LLM call" });
    }
  });

  // ── Settings routes (require auth) ──

  // GET /api/settings — get current user's LLM settings
  app.get("/api/settings", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getUserSettings(req.userId);
      const result = settings || { llmProvider: 'groq', llmModel: 'openai/gpt-oss-120b', llmApiKey: null };
      // Mask API key in response
      const rawKey = result.llm_api_key || result.llmApiKey;
      if (rawKey) {
        result.llmApiKeyMasked = rawKey.slice(0, 7) + '...' + rawKey.slice(-4);
        delete result.llm_api_key;
        delete result.llmApiKey;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  // POST /api/enhance-idea — unauth; uses demo Groq key (fast tier) to expand a short idea.
  // Returns a 2-3 sentence description suitable for dropping into the details textarea.
  app.post("/api/enhance-idea", async (req: any, res) => {
    try {
      const raw = typeof req.body?.idea === "string" ? req.body.idea : "";
      const idea = raw.trim();
      if (idea.length < 3) {
        return res.status(400).json({ message: "Idea must be at least 3 characters." });
      }
      if (idea.length > 500) {
        return res.status(400).json({ message: "Idea too long (max 500 chars)." });
      }

      // Use the same per-user LLM config if the user has one, else fall back to demo Groq.
      const userConfig = await getLLMConfig(req);
      const messages: AIMessage[] = [
        {
          role: "system",
          content:
            "You are a product-idea editor. Given a short product idea, rewrite it as a 2-3 sentence description. " +
            "Keep the user's core concept. Add only obvious specifics (who it's for, what it does, the key value). " +
            "Do not invent features the user didn't hint at. No headers, no markdown, no quotes — plain text only. " +
            "Write in the same tone the user used. Keep it under 80 words.",
        },
        { role: "user", content: idea },
      ];

      const result = await aiService.chat(messages, "claude-sonnet", userConfig, "chat");
      const enhanced = (result.content || "").trim().replace(/^["']|["']$/g, "");
      if (!enhanced) {
        return res.status(502).json({ message: "Empty response from model." });
      }
      return res.json({ enhanced });
    } catch (error: any) {
      logger.warn({ err: error?.message }, "enhance-idea failed");
      return res.status(500).json({ message: "Failed to enhance idea." });
    }
  });

  // POST /api/clarify — unauth; returns 2-4 targeted clarifying questions with quick-answer chips
  // for an under-specified product idea. Used by the /details page before starting generation,
  // so that the AI asks the user load-bearing things (audience, platform, scope) BEFORE kicking
  // off an expensive survey + doc pipeline.
  app.post("/api/clarify", async (req: any, res) => {
    try {
      const raw = typeof req.body?.idea === "string" ? req.body.idea : "";
      const idea = raw.trim();
      if (idea.length < 3) {
        return res.status(400).json({ message: "Idea must be at least 3 characters." });
      }
      if (idea.length > 2000) {
        return res.status(400).json({ message: "Idea too long (max 2000 chars)." });
      }
      const priorAnswers = req.body?.priorAnswers && typeof req.body.priorAnswers === "object"
        ? req.body.priorAnswers : {};

      const userConfig = await getLLMConfig(req);

      const systemPrompt = `You are ProductPilot's clarification step. The user typed a product idea and is about to generate PRD/architecture/coding docs. Your job is to decide whether the idea is well-enough specified to generate good docs, and if not, to ask the 2–4 highest-leverage clarifying questions before generation starts.

Priority of missing information: audience → primary platform → scope (must-have v1) → budget/timeline → constraints.

You MUST return valid JSON only, matching this schema:
{
  "needsClarification": true,
  "summary": "One short sentence restating the idea in the user's own words.",
  "questions": [
    {
      "id": "audience",
      "question": "Short, single-focus question in plain English.",
      "chips": ["Concrete option 1", "Concrete option 2", "Concrete option 3", "Concrete option 4"]
    }
  ]
}

Rules:
- Ask 2–4 questions when needsClarification is true. Never only 1 — that wastes a turn. If you can only think of one, also ask about scope or primary platform.
- Each question must be answerable by tapping exactly one chip. Chips must be concrete, mutually exclusive, 3 or 4 per question, never longer than 4 words each.
- If the idea already names an audience, do NOT ask about audience — skip to the next missing slot.
- If the idea already names a platform, do NOT ask about platform — skip to scope or constraints.
- Never ask about team size, hiring, agencies, or staffing.
- Never echo the idea back as a question.
- If the idea is already strongly specified (names audience + platform + scope), return {"needsClarification": false, "summary": "<one sentence>", "questions": []}.`;

      const userPrompt = `Idea: "${idea}"

Prior answers from the user (may be empty): ${JSON.stringify(priorAnswers)}

Return the JSON now.`;

      // Use 'chat' tier (Groq fast or Sonnet depending on config) rather than classification
      // so Haiku doesn't under-deliver — we want 2–4 rich questions, not a single safe one.
      const result = await aiService.generateStructuredOutput(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        "claude-sonnet",
        userConfig,
        "chat",
      );

      // Coerce shape — belt-and-braces in case the model drifted.
      const questions = Array.isArray(result?.questions) ? result.questions.slice(0, 4).map((q: any, i: number) => ({
        id: typeof q?.id === "string" && q.id.trim() ? q.id.trim() : `q${i + 1}`,
        question: typeof q?.question === "string" ? q.question.slice(0, 180) : "",
        chips: Array.isArray(q?.chips)
          ? q.chips.filter((c: any) => typeof c === "string" && c.trim()).slice(0, 5).map((c: string) => c.slice(0, 32))
          : [],
      })).filter((q: any) => q.question && q.chips.length >= 2) : [];

      // Deterministic fallback: if the model decided clarification is needed but only returned
      // 1 question, append a high-leverage follow-up (platform, then scope) from a short canned
      // list of slots that aren't already covered. Avoids a second LLM round-trip while keeping
      // the "never only 1 question" invariant the system prompt promises.
      const FALLBACK_QUESTIONS: Array<{ id: string; question: string; chips: string[] }> = [
        {
          id: "platform",
          question: "What's the primary surface you want to ship on first?",
          chips: ["Web", "iOS", "Android", "Desktop"],
        },
        {
          id: "scope",
          question: "For a first version, which feels most important?",
          chips: ["Fast to ship", "Beautiful UI", "Power-user depth", "Rock-solid data"],
        },
        {
          id: "audience",
          question: "Who is this mostly for?",
          chips: ["Just me", "Small team", "A community", "Customers"],
        },
      ];
      const needs = Boolean(result?.needsClarification) && questions.length > 0;
      if (needs && questions.length === 1) {
        const takenIds = new Set(questions.map((q: any) => q.id.toLowerCase()));
        for (const fb of FALLBACK_QUESTIONS) {
          if (!takenIds.has(fb.id) && questions.length < 2) {
            questions.push(fb);
          }
        }
      }

      return res.json({
        needsClarification: needs,
        summary: typeof result?.summary === "string" ? result.summary.slice(0, 240) : "",
        questions,
      });
    } catch (error: any) {
      logger.warn({ err: error?.message }, "clarify failed");
      // Fail open — never block the user from continuing. Frontend treats no questions as "skip clarify".
      return res.json({ needsClarification: false, summary: "", questions: [] });
    }
  });

  // PUT /api/settings — update LLM settings
  app.put("/api/settings", requireAuth, async (req: any, res) => {
    try {
      const { llmProvider, llmApiKey, llmModel } = req.body;
      const settings = await storage.upsertUserSettings(req.userId, {
        llmProvider, llmApiKey, llmModel,
      });
      res.json({ message: 'Settings updated', provider: settings.llm_provider || settings.llmProvider });
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // DELETE /api/settings/key — remove custom API key (revert to demo)
  app.delete("/api/settings/key", requireAuth, async (req: any, res) => {
    try {
      await storage.upsertUserSettings(req.userId, { llmApiKey: null });
      res.json({ message: 'API key removed. Using demo key.' });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove key" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
