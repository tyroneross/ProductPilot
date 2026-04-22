import type { Project, Stage, Message, InsertProject, InsertProjectWithOwner, InsertStage, InsertMessage, AdminPrompt, InsertAdminPrompt, InsertLlmCall, InsertAuditEvent } from "@shared/schema";
import { projects, stages, messages, adminPrompts, llmCalls, auditEvents, DEFAULT_STAGES } from "@shared/schema";
import { DISCOVERY_INITIAL_PROMPT } from "@shared/prompt-content";
import { eq, and, ne, desc, asc, sql } from "drizzle-orm";
import { db } from "./db";

interface IStorage {
  // Projects
  createProject(project: InsertProjectWithOwner): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  getProjectsByGuestOwnerId(guestOwnerId: string): Promise<Project[]>;
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

  // User Settings
  getUserSettings(userId: string): Promise<any | undefined>;
  upsertUserSettings(userId: string, updates: Record<string, any>): Promise<any>;

  // LLM Telemetry
  createLlmCall(call: InsertLlmCall): Promise<void>;

  // Audit log
  createAuditEvent(event: InsertAuditEvent): Promise<void>;
}

// In-memory storage fallback
class MemStorage implements IStorage {
  private projects: Map<string, Project> = new Map();
  private stages: Map<string, Stage> = new Map();
  private messages: Map<string, Message> = new Map();
  private userSettingsMap = new Map<string, any>();

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async createProject(insertProject: InsertProjectWithOwner): Promise<Project> {
    const project: Project = {
      id: this.generateId(),
      userId: insertProject.userId || null,
      guestOwnerId: insertProject.guestOwnerId || null,
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
      appStyle: insertProject.appStyle || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(project.id, project);

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
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return (await this.getAllProjects()).filter((project) => project.userId === userId);
  }

  async getProjectsByGuestOwnerId(guestOwnerId: string): Promise<Project[]> {
    return (await this.getAllProjects()).filter(
      (project) => project.guestOwnerId === guestOwnerId,
    );
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
      kind: insertMessage.kind ?? "chat",
      version: insertMessage.version ?? 1,
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
      content: DISCOVERY_INITIAL_PROMPT,
      isDefault: true,
      updatedBy: userId,
    });
  }

  // User Settings - MemStorage implementation
  async getUserSettings(userId: string) {
    return this.userSettingsMap.get(userId);
  }

  async upsertUserSettings(userId: string, updates: Record<string, any>) {
    const existing = this.userSettingsMap.get(userId) || { userId, llmProvider: 'groq', llmModel: 'llama-3.3-70b-versatile' };
    const merged = { ...existing, ...updates, userId, updatedAt: new Date() };
    this.userSettingsMap.set(userId, merged);
    return merged;
  }

  // LLM Telemetry - MemStorage implementation (dev fallback, in-memory only)
  private llmCallLog: InsertLlmCall[] = [];

  async createLlmCall(call: InsertLlmCall): Promise<void> {
    this.llmCallLog.push(call);
  }

  // Audit log - MemStorage implementation (dev fallback, in-memory only)
  private auditEventLog: InsertAuditEvent[] = [];

  async createAuditEvent(event: InsertAuditEvent): Promise<void> {
    this.auditEventLog.push(event);
  }
}

// PostgreSQL storage using Drizzle
class PostgresStorage implements IStorage {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  async createProject(insertProject: InsertProjectWithOwner): Promise<Project> {
    // Project + default stages atomically — no orphan project rows if a stage insert fails.
    return await this.db.transaction(async (tx: typeof this.db) => {
      const [project] = await tx.insert(projects).values(insertProject).returning();

      const stageRows = DEFAULT_STAGES.map((defaultStage) => ({
        projectId: project.id,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt,
        keyInsights: defaultStage.keyInsights || [],
        completedInsights: [],
        progress: 0,
        isUnlocked: true,
      }));
      if (stageRows.length > 0) {
        await tx.insert(stages).values(stageRows);
      }

      return project;
    });
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt));
  }

  async getProjectsByGuestOwnerId(guestOwnerId: string): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .where(eq(projects.guestOwnerId, guestOwnerId))
      .orderBy(desc(projects.createdAt));
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
      content: DISCOVERY_INITIAL_PROMPT,
      isDefault: true,
      updatedBy: userId,
    });
  }

  // User Settings - PostgresStorage implementation
  async getUserSettings(userId: string) {
    const result = await this.db.execute(
      sql`SELECT * FROM user_settings WHERE user_id = ${userId} LIMIT 1`
    );
    return result.rows?.[0] || undefined;
  }

  async upsertUserSettings(userId: string, updates: Record<string, any>) {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      await this.db.execute(
        sql`UPDATE user_settings SET
          llm_provider = COALESCE(${updates.llmProvider ?? null}, llm_provider),
          llm_api_key = ${updates.llmApiKey !== undefined ? updates.llmApiKey : sql`llm_api_key`},
          llm_model = COALESCE(${updates.llmModel ?? null}, llm_model),
          updated_at = NOW()
        WHERE user_id = ${userId}`
      );
      return this.getUserSettings(userId);
    } else {
      await this.db.execute(
        sql`INSERT INTO user_settings (id, user_id, llm_provider, llm_api_key, llm_model)
        VALUES (gen_random_uuid(), ${userId}, ${updates.llmProvider || 'groq'}, ${updates.llmApiKey || null}, ${updates.llmModel || 'llama-3.3-70b-versatile'})`
      );
      return this.getUserSettings(userId);
    }
  }

  // LLM Telemetry - PostgresStorage implementation
  async createLlmCall(call: InsertLlmCall): Promise<void> {
    await this.db.insert(llmCalls).values(call);
  }

  // Audit log - PostgresStorage implementation
  async createAuditEvent(event: InsertAuditEvent): Promise<void> {
    await this.db.insert(auditEvents).values(event);
  }
}

// Create the storage instance with proper fallback.
// Fail closed in production: never serve MemStorage in prod — it silently drops data on restart.
function createStorage(): IStorage {
  const hasDatabase = !!(
    process.env.DATABASE_URL ||
    (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE)
  );

  if (hasDatabase && db) {
    console.log("Using PostgreSQL storage");
    return new PostgresStorage(db);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No database configured in production. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Refusing to fall back to in-memory storage.",
    );
  }

  console.log("Using in-memory storage (no database configured — dev only)");
  return new MemStorage();
}

export const storage = createStorage();
