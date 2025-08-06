import type { Project, Stage, Message, InsertProject, InsertStage, InsertMessage } from "@shared/schema";

interface IStorage {
  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  deleteProject(id: string): Promise<boolean>;

  // Stages  
  createStage(stage: InsertStage): Promise<Stage>;
  getStage(id: string): Promise<Stage | undefined>;
  getStagesByProject(projectId: string): Promise<Stage[]>;
  updateStage(id: string, updates: Partial<Stage>): Promise<Stage>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByStage(stageId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessagesByStage(stageId: string): Promise<void>;
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
      ...insertProject,
      aiModel: insertProject.aiModel || "claude-sonnet",
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
        systemPrompt: "You are a PRD writing specialist. Help create detailed product specifications.",
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
      ...insertStage,
      progress: insertStage.progress || 0,
      isUnlocked: insertStage.isUnlocked !== undefined ? insertStage.isUnlocked : true,
      outputs: insertStage.outputs || null,
      keyInsights: insertStage.keyInsights || null,
      completedInsights: insertStage.completedInsights || null,
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
}

// PostgreSQL storage using Drizzle
class PostgresStorage implements IStorage {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const { projects } = await import("@shared/schema");
    const [project] = await this.db.insert(projects).values(insertProject).returning();
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const { projects } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    const { projects } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async deleteProject(id: string): Promise<boolean> {
    const { projects } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await this.db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    const { stages } = await import("@shared/schema");
    const [stage] = await this.db.insert(stages).values(insertStage).returning();
    return stage;
  }

  async getStage(id: string): Promise<Stage | undefined> {
    const { stages } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await this.db.select().from(stages).where(eq(stages.id, id)).limit(1);
    return result[0];
  }

  async getStagesByProject(projectId: string): Promise<Stage[]> {
    const { stages } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return await this.db.select().from(stages).where(eq(stages.projectId, projectId));
  }

  async updateStage(id: string, updates: Partial<Stage>): Promise<Stage> {
    const { stages } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
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
        finalUpdates.progress = Math.round((completedCount / totalCount) * 100);
      }
    }
    
    const [updatedStage] = await this.db.update(stages)
      .set(finalUpdates)
      .where(eq(stages.id, id))
      .returning();
    
    return updatedStage;
  }



  async getMessage(id: string): Promise<Message | undefined> {
    const { messages } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }

  async getMessagesByStage(stageId: string): Promise<Message[]> {
    const { messages } = await import("@shared/schema");
    const { eq, asc } = await import("drizzle-orm");
    return await this.db.select().from(messages)
      .where(eq(messages.stageId, stageId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const { messages } = await import("@shared/schema");
    const [message] = await this.db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async deleteMessagesByStage(stageId: string): Promise<void> {
    const { messages } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await this.db.delete(messages).where(eq(messages.stageId, stageId));
  }
}

// Create the storage instance with proper fallback
function createStorage(): IStorage {
  try {
    // Always use in-memory storage for now until database is properly configured
    console.log("Using in-memory storage");
    return new MemStorage();
  } catch (error) {
    console.log("Fallback to in-memory storage");
    return new MemStorage();
  }
}

export const storage = createStorage();