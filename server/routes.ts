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

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const updates = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        mode: z.enum(["interview", "stage-based", "survey"]).optional(),
        aiModel: z.string().optional(),
        surveyPhase: z.enum(["discovery", "survey", "complete"]).optional(),
        surveyDefinition: z.any().optional(),
        surveyResponses: z.any().optional(),
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
        
        // Build conversation history (existingMessages already includes the new user message we just created)
        const aiMessages: AIMessage[] = [
          { role: "system", content: stage.systemPrompt },
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

      const surveyPrompt = `Based on this product idea and discovery conversation, generate a comprehensive survey to capture the information needed to create detailed product documentation.

Product Idea: "${project.description}"

Discovery Conversation:
${discoveryMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Generate a survey with 5 sections (one for each documentation phase):
1. Requirements (user personas, problem statement, goals)
2. Product Features (core features, priority, MVP scope)
3. User Experience (key workflows, UI preferences)
4. Technical Architecture (scale, integrations, tech preferences)
5. Development Plan (timeline, team size, constraints)

Each section should have 3-5 questions. Use these question types strategically:
- "slider" for scales/priorities/ratings (include min, max, minLabel, maxLabel)
- "single-select" for mutually exclusive choices (include options array)
- "multi-select" for selecting multiple items (include options array)

Respond with ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "id": "requirements",
      "title": "Requirements & Goals",
      "description": "Define your target users and core objectives",
      "questions": [
        {
          "id": "q1_user_tech_level",
          "section": "requirements",
          "question": "How technical are your target users?",
          "type": "slider",
          "min": 1,
          "max": 5,
          "minLabel": "Non-technical",
          "maxLabel": "Highly technical",
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
      
      // Generate documentation for each stage based on survey responses
      const surveyContext = `
Product: ${project.description}
Survey Definition: ${JSON.stringify(project.surveyDefinition)}
Survey Responses: ${JSON.stringify(project.surveyResponses)}
`;

      for (const stage of stages) {
        const docPrompt = `Based on this survey data, generate comprehensive content for the "${stage.title}" section.

${surveyContext}

Generate detailed, professional documentation appropriate for this section. Be thorough and specific based on the survey answers provided.`;

        try {
          const response = await aiService.chat([
            { role: "system", content: stage.systemPrompt },
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

  const httpServer = createServer(app);
  return httpServer;
}
