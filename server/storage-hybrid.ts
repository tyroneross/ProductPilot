import type { Project, Stage, Message, InsertProject, InsertStage, InsertMessage, AdminPrompt, InsertAdminPrompt } from "@shared/schema";
import { projects, stages, messages, adminPrompts, DEFAULT_STAGES } from "@shared/schema";
import { eq, and, ne, desc, asc } from "drizzle-orm";
import { db } from "./db";

interface IStorage {
  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getUserDraft(userId: string): Promise<Project | undefined>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Stages  
  createStage(stage: InsertStage): Promise<Stage>;
  getStage(id: string): Promise<Stage | undefined>;
  getStagesByProject(projectId: string): Promise<Stage[]>;
  updateStage(id: string, updates: Partial<Stage>): Promise<Stage>;
  ensureStagesForProject(projectId: string): Promise<Stage[]>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByStage(stageId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessagesByStage(stageId: string): Promise<void>;

  // Admin Prompts
  getAllAdminPrompts(): Promise<AdminPrompt[]>;
  getAdminPrompt(id: string): Promise<AdminPrompt | undefined>;
  getAdminPromptByTargetKey(targetKey: string): Promise<AdminPrompt | undefined>;
  createAdminPrompt(prompt: InsertAdminPrompt): Promise<AdminPrompt>;
  updateAdminPrompt(id: string, updates: Partial<AdminPrompt>): Promise<AdminPrompt | undefined>;
  deleteAdminPrompt(id: string): Promise<boolean>;
  seedDefaultPrompts(userId: string): Promise<void>;
}

// In-memory storage fallback
class MemStorage implements IStorage {
  private projects: Map<string, Project> = new Map();
  private stages: Map<string, Stage> = new Map();
  private messages: Map<string, Message> = new Map();

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const project: Project = {
      id: this.generateId(),
      userId: insertProject.userId || null,
      name: insertProject.name,
      description: insertProject.description,
      mode: insertProject.mode || "survey",
      aiModel: insertProject.aiModel || "claude-sonnet",
      surveyPhase: insertProject.surveyPhase || "discovery",
      surveyDefinition: insertProject.surveyDefinition || null,
      surveyResponses: insertProject.surveyResponses || null,
      customPrompts: insertProject.customPrompts || null,
      intakeAnswers: insertProject.intakeAnswers || null,
      minimumDetails: insertProject.minimumDetails || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(project.id, project);
    
    // Create default stages for the project
    const DEFAULT_STAGES = [
      {
        stageNumber: 1,
        title: "Requirements Definition",
        description: "Define core requirements and user needs",
        systemPrompt: "You are a product requirements expert. Help define clear, actionable requirements.",
        keyInsights: [
          "What is the main problem you're solving?",
          "Who is your target user?", 
          "What's the core value proposition?",
          "What are your key success metrics?",
          "What's your MVP scope?"
        ]
      },
      {
        stageNumber: 2,
        title: "PRD Writing",
        description: "Create comprehensive Product Requirements Document",
        systemPrompt: `<CRITICAL_INSTRUCTION>
You are an interviewer gathering requirements. You MUST NOT generate any PRD document until AFTER at least 6 user responses.

FIRST: Count how many USER messages exist in this conversation.
- If USER messages < 6: Ask ONE question ONLY. DO NOT generate ANY document sections, headers, or formatted content.
- If USER messages >= 6: You may offer to generate the PRD if you have sufficient information.

IMPORTANT: ASK ONLY ONE QUESTION AT A TIME. This makes the conversation feel natural and less overwhelming.

YOUR RESPONSE FORMAT when USER messages < 6:
1. Briefly acknowledge their previous answer (1-2 sentences max)
2. Ask exactly ONE focused follow-up question
3. Keep your response short and conversational

Example GOOD responses:
"That makes sense! Who are the primary users of this app?"

"Great context. What's the one problem they face that frustrates them most?"

"Interesting! How do they currently handle this without your app?"

Example BAD response (too many questions):
"Let me understand better:
1. Who are the primary users?
2. What problem do they face?
3. How do they handle it now?"
<DO_NOT_ASK_MULTIPLE_QUESTIONS>

CONVERSATION FLOW (one question per exchange):
Exchange 1: Who are the target users?
Exchange 2: What problem are they facing?
Exchange 3: What's the core solution/value prop?
Exchange 4: What are the must-have features?
Exchange 5: Any technical or business constraints?
Exchange 6: How will you measure success?
Exchange 7+: Offer to generate the PRD

QUESTION TOPICS (ask ONE per response):
- Target users and their pain points
- Core problem being solved
- Essential features vs nice-to-haves
- Key user workflows
- Technical or business constraints
- Success metrics
</CRITICAL_INSTRUCTION>`,
        keyInsights: [
          "What are your key user stories?",
          "What features are absolutely essential?",
          "How will users interact with your product?",
          "What's your technical approach?",
          "What's your launch timeline?"
        ]
      },
      {
        stageNumber: 3,
        title: "Architecture Design",
        description: "Design system architecture and technical approach",
        systemPrompt: "You are a software architect. Help design scalable, maintainable systems.",
        keyInsights: [
          "What's your overall system architecture?",
          "What technology stack will you use?",
          "How will data flow through your system?",
          "What are your security requirements?",
          "How will you handle scaling?"
        ]
      },
      {
        stageNumber: 4,
        title: "Coding Prompts",
        description: "Generate development prompts and implementation guides",
        systemPrompt: "You are a senior developer. Help create clear coding guidelines and prompts.",
        keyInsights: [
          "What's your development approach?",
          "How will you structure your code?",
          "What are the key components to build?",
          "What are your integration points?",
          "What's your testing strategy?"
        ]
      },
      {
        stageNumber: 5,
        title: "Development Guide",
        description: "Create step-by-step implementation roadmap",
        systemPrompt: "You are a development team lead. Help create actionable development plans.",
        keyInsights: [
          "What are your development phases?",
          "What tasks should you prioritize?",
          "What resources do you need?",
          "What are the main risks?",
          "What's your delivery timeline?"
        ]
      }
    ];

    for (const defaultStage of DEFAULT_STAGES) {
      const stage: Stage = {
        id: this.generateId(),
        projectId: project.id,
        ...defaultStage,
        progress: 0,
        isUnlocked: true,
        outputs: null,
        completedInsights: [],
        aiModel: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.stages.set(stage.id, stage);
    }
    
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getUserDraft(userId: string): Promise<Project | undefined> {
    const allProjects = Array.from(this.projects.values());
    return allProjects.find(p => p.userId === userId && p.surveyPhase !== "complete");
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) {
      return undefined;
    }
    
    const updated: Project = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const deleted = this.projects.delete(id);
    // Also delete related stages and messages
    const stagesToDelete = Array.from(this.stages.values()).filter(s => s.projectId === id);
    for (const stage of stagesToDelete) {
      await this.deleteMessagesByStage(stage.id);
      this.stages.delete(stage.id);
    }
    return deleted;
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    const stage: Stage = {
      id: this.generateId(),
      projectId: insertStage.projectId,
      stageNumber: insertStage.stageNumber,
      title: insertStage.title,
      description: insertStage.description,
      systemPrompt: insertStage.systemPrompt,
      aiModel: insertStage.aiModel || null,
      progress: 0,
      isUnlocked: true,
      outputs: null,
      keyInsights: null,
      completedInsights: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stages.set(stage.id, stage);
    return stage;
  }

  async getStage(id: string): Promise<Stage | undefined> {
    return this.stages.get(id);
  }

  async getStagesByProject(projectId: string): Promise<Stage[]> {
    return Array.from(this.stages.values()).filter(s => s.projectId === projectId);
  }

  async updateStage(id: string, updates: Partial<Stage>): Promise<Stage> {
    const existing = this.stages.get(id);
    if (!existing) {
      throw new Error(`Stage with id ${id} not found`);
    }
    
    const updated: Stage = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.stages.set(id, updated);
    return updated;
  }

  async ensureStagesForProject(projectId: string): Promise<Stage[]> {
    const existing = await this.getStagesByProject(projectId);
    if (existing.length > 0) return existing;

    const DEFAULT_STAGES = [
      { stageNumber: 1, title: "Requirements Definition", description: "Define core requirements and user needs", systemPrompt: "You are a product requirements expert.", keyInsights: [] },
      { stageNumber: 2, title: "PRD Writing", description: "Create comprehensive PRD", systemPrompt: "You are a PRD expert.", keyInsights: [] },
      { stageNumber: 3, title: "UI Design", description: "Create UI wireframes", systemPrompt: "You are a UI/UX expert.", keyInsights: [] },
      { stageNumber: 4, title: "Architecture", description: "Technical architecture design", systemPrompt: "You are a software architect.", keyInsights: [] },
      { stageNumber: 5, title: "Coding Prompts", description: "Generate coding prompts", systemPrompt: "You are an AI prompt engineer.", keyInsights: [] },
      { stageNumber: 6, title: "Development Guide", description: "Create development guide", systemPrompt: "You are a development guide expert.", keyInsights: [] },
    ];

    const createdStages: Stage[] = [];
    for (const defaultStage of DEFAULT_STAGES) {
      const stage = await this.createStage({
        projectId,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt,
      });
      createdStages.push(stage);
    }
    return createdStages;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByStage(stageId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.stageId === stageId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const message: Message = {
      id: this.generateId(),
      ...insertMessage,
      createdAt: new Date(),
    };
    this.messages.set(message.id, message);
    return message;
  }

  async deleteMessagesByStage(stageId: string): Promise<void> {
    const messagesToDelete = Array.from(this.messages.values()).filter(m => m.stageId === stageId);
    for (const message of messagesToDelete) {
      this.messages.delete(message.id);
    }
  }

  // Admin Prompts - In-memory implementation
  private adminPrompts: Map<string, AdminPrompt> = new Map();

  async getAllAdminPrompts(): Promise<AdminPrompt[]> {
    return Array.from(this.adminPrompts.values());
  }

  async getAdminPrompt(id: string): Promise<AdminPrompt | undefined> {
    return this.adminPrompts.get(id);
  }

  async getAdminPromptByTargetKey(targetKey: string): Promise<AdminPrompt | undefined> {
    const prompts = Array.from(this.adminPrompts.values());
    return prompts.find(p => p.targetKey === targetKey);
  }

  async createAdminPrompt(insertPrompt: InsertAdminPrompt): Promise<AdminPrompt> {
    const prompt: AdminPrompt = {
      id: this.generateId(),
      scope: insertPrompt.scope,
      targetKey: insertPrompt.targetKey,
      label: insertPrompt.label,
      description: insertPrompt.description || null,
      content: insertPrompt.content,
      isDefault: insertPrompt.isDefault || false,
      stageNumber: insertPrompt.stageNumber || null,
      updatedBy: insertPrompt.updatedBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.adminPrompts.set(prompt.id, prompt);
    return prompt;
  }

  async updateAdminPrompt(id: string, updates: Partial<AdminPrompt>): Promise<AdminPrompt | undefined> {
    const existing = this.adminPrompts.get(id);
    if (!existing) return undefined;
    
    const updated: AdminPrompt = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.adminPrompts.set(id, updated);
    return updated;
  }

  async deleteAdminPrompt(id: string): Promise<boolean> {
    return this.adminPrompts.delete(id);
  }

  async seedDefaultPrompts(userId: string): Promise<void> {
    // Seed stage prompts
    for (const stage of DEFAULT_STAGES) {
      await this.createAdminPrompt({
        scope: "stage",
        targetKey: `stage_${stage.stageNumber}`,
        label: stage.title,
        description: stage.description,
        content: stage.systemPrompt,
        isDefault: true,
        stageNumber: stage.stageNumber,
        updatedBy: userId,
      });
    }

    // Seed discovery prompt
    await this.createAdminPrompt({
      scope: "discovery",
      targetKey: "discovery_initial",
      label: "Discovery Initial Prompt",
      description: "The initial prompt used to start the discovery conversation in Survey Mode",
      content: `You are a product discovery expert helping users define their product vision. Ask clarifying questions one at a time to understand:
- What problem they're solving
- Who their target users are
- Key features and functionality
- Technical constraints or preferences
- Success metrics

Be conversational and encouraging. After 4-5 exchanges, you'll have enough context to generate a personalized survey.`,
      isDefault: true,
      updatedBy: userId,
    });
  }
}

// PostgreSQL storage using Drizzle
class PostgresStorage implements IStorage {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await this.db.insert(projects).values(insertProject).returning();
    
    // Create default stages for the project
    for (const defaultStage of DEFAULT_STAGES) {
      await this.db.insert(stages).values({
        projectId: project.id,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt,
        keyInsights: defaultStage.keyInsights || [],
        completedInsights: [],
        progress: 0,
        isUnlocked: true,
      });
    }
    
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getUserDraft(userId: string): Promise<Project | undefined> {
    const result = await this.db.select().from(projects)
      .where(and(eq(projects.userId, userId), ne(projects.surveyPhase, "complete")))
      .limit(1);
    return result[0];
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const finalUpdates: any = { ...updates };
    if (Object.keys(finalUpdates).length > 0 && !finalUpdates.updatedAt) {
      finalUpdates.updatedAt = new Date();
    }
    
    const [updatedProject] = await this.db.update(projects)
      .set(finalUpdates)
      .where(eq(projects.id, id))
      .returning();
    
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await this.db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    const [stage] = await this.db.insert(stages).values(insertStage).returning();
    return stage;
  }

  async getStage(id: string): Promise<Stage | undefined> {
    const result = await this.db.select().from(stages).where(eq(stages.id, id)).limit(1);
    return result[0];
  }

  async getStagesByProject(projectId: string): Promise<Stage[]> {
    return await this.db.select().from(stages).where(eq(stages.projectId, projectId));
  }

  async updateStage(id: string, updates: Partial<Stage>): Promise<Stage> {
    const finalUpdates: any = { ...updates };
    if (Object.keys(finalUpdates).length > 0 && !finalUpdates.updatedAt) {
      finalUpdates.updatedAt = new Date();
    }
    
    // Handle insights updates specially
    if (updates.completedInsights !== undefined) {
      const keyInsights = updates.keyInsights || [];
      const completedInsights = updates.completedInsights || [];
      
      if (Array.isArray(keyInsights) && keyInsights.length > 0) {
        const completedCount = Array.isArray(completedInsights) ? completedInsights.length : 0;
        const totalCount = keyInsights.length;
        finalUpdates.progress = Math.max(0, Math.min(100, Math.round((completedCount / totalCount) * 100)));
      }
    }
    
    const [updatedStage] = await this.db.update(stages)
      .set(finalUpdates)
      .where(eq(stages.id, id))
      .returning();
    
    return updatedStage;
  }

  async ensureStagesForProject(projectId: string): Promise<Stage[]> {
    // Check if stages already exist
    const existing = await this.db.select().from(stages).where(eq(stages.projectId, projectId));
    if (existing.length > 0) return existing;

    // Create default stages
    const createdStages: Stage[] = [];
    for (const defaultStage of DEFAULT_STAGES) {
      const [stage] = await this.db.insert(stages).values({
        projectId,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt,
        keyInsights: defaultStage.keyInsights || [],
        completedInsights: [],
        progress: 0,
        isUnlocked: true,
      }).returning();
      createdStages.push(stage);
    }
    return createdStages;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const result = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }

  async getMessagesByStage(stageId: string): Promise<Message[]> {
    return await this.db.select().from(messages)
      .where(eq(messages.stageId, stageId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await this.db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async deleteMessagesByStage(stageId: string): Promise<void> {
    await this.db.delete(messages).where(eq(messages.stageId, stageId));
  }

  // Admin Prompts - PostgreSQL implementation
  async getAllAdminPrompts(): Promise<AdminPrompt[]> {
    return await this.db.select().from(adminPrompts);
  }

  async getAdminPrompt(id: string): Promise<AdminPrompt | undefined> {
    const result = await this.db.select().from(adminPrompts).where(eq(adminPrompts.id, id)).limit(1);
    return result[0];
  }

  async getAdminPromptByTargetKey(targetKey: string): Promise<AdminPrompt | undefined> {
    const result = await this.db.select().from(adminPrompts).where(eq(adminPrompts.targetKey, targetKey)).limit(1);
    return result[0];
  }

  async createAdminPrompt(insertPrompt: InsertAdminPrompt): Promise<AdminPrompt> {
    const [prompt] = await this.db.insert(adminPrompts).values(insertPrompt).returning();
    return prompt;
  }

  async updateAdminPrompt(id: string, updates: Partial<AdminPrompt>): Promise<AdminPrompt | undefined> {
    const finalUpdates: any = { ...updates };
    if (!finalUpdates.updatedAt) {
      finalUpdates.updatedAt = new Date();
    }
    
    const [updatedPrompt] = await this.db.update(adminPrompts)
      .set(finalUpdates)
      .where(eq(adminPrompts.id, id))
      .returning();
    
    return updatedPrompt;
  }

  async deleteAdminPrompt(id: string): Promise<boolean> {
    const result = await this.db.delete(adminPrompts).where(eq(adminPrompts.id, id));
    return result.rowCount > 0;
  }

  async seedDefaultPrompts(userId: string): Promise<void> {
    // Seed stage prompts
    for (const stage of DEFAULT_STAGES) {
      await this.createAdminPrompt({
        scope: "stage",
        targetKey: `stage_${stage.stageNumber}`,
        label: stage.title,
        description: stage.description,
        content: stage.systemPrompt,
        isDefault: true,
        stageNumber: stage.stageNumber,
        updatedBy: userId,
      });
    }

    // Seed discovery prompt
    await this.createAdminPrompt({
      scope: "discovery",
      targetKey: "discovery_initial",
      label: "Discovery Initial Prompt",
      description: "The initial prompt used to start the discovery conversation in Survey Mode",
      content: `You are a product discovery expert helping users define their product vision. Ask clarifying questions one at a time to understand:
- What problem they're solving
- Who their target users are
- Key features and functionality
- Technical constraints or preferences
- Success metrics

Be conversational and encouraging. After 4-5 exchanges, you'll have enough context to generate a personalized survey.`,
      isDefault: true,
      updatedBy: userId,
    });
  }
}

// Create the storage instance with proper fallback
function createStorage(): IStorage {
  try {
    // Check if database environment is available
    const hasDatabase = !!(
      process.env.DATABASE_URL || 
      (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE)
    );
    
    if (hasDatabase && db) {
      console.log("Using PostgreSQL storage");
      return new PostgresStorage(db);
    }
    
    console.log("Using in-memory storage (no database configured)");
    return new MemStorage();
  } catch (error) {
    console.log("Fallback to in-memory storage:", error);
    return new MemStorage();
  }
}

export const storage = createStorage();