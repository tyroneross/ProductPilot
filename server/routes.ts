import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-hybrid";
import { aiService, type AIMessage } from "./services/ai";
import { insertProjectSchema, insertMessageSchema, updateStageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

        // Get existing messages BEFORE creating the new one to get accurate count
        const existingMessages = await storage.getMessagesByStage(req.params.stageId);
        
        // Create and save the user message first for resilient error handling
        const message = await storage.createMessage(messageData);
        
        // Build conversation history with the new user message
        const aiMessages: AIMessage[] = [
          { role: "system", content: stage.systemPrompt },
          ...existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: messageData.content }
        ];

        try {
          const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";
          let aiResponse = await aiService.chat(aiMessages, modelToUse);
          
          // Special handling for PRD stage (stage 2) to prevent premature document generation
          if (stage.stageNumber === 2) {
            // Count existing messages + 1 for the message we just created
            const userMessageCount = existingMessages.filter(m => m.role === "user").length + 1;
            
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

  const httpServer = createServer(app);
  return httpServer;
}
