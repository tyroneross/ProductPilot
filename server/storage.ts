import { eq, desc, asc } from "drizzle-orm";
import { db } from "./db";
import { projects, stages, messages, type Project, type InsertProject, type Stage, type InsertStage, type Message, type InsertMessage, type UpdateStage, DEFAULT_STAGES } from "@shared/schema";

export interface IStorage {
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Stages
  getStage(id: string): Promise<Stage | undefined>;
  getStagesByProject(projectId: string): Promise<Stage[]>;
  createStage(stage: InsertStage): Promise<Stage>;
  updateStage(id: string, updates: UpdateStage): Promise<Stage | undefined>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByStage(stageId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessagesByStage(stageId: string): Promise<void>;
}

export class PostgresStorage implements IStorage {
  constructor() {}

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values({
      ...insertProject,
      aiModel: insertProject.aiModel || "claude-sonnet",
    }).returning();

    // Create default stages for the project
    for (const defaultStage of DEFAULT_STAGES) {
      await this.createStage({
        projectId: project.id,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt,
      });
    }

    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const [updatedProject] = await db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async getStage(id: string): Promise<Stage | undefined> {
    const result = await db.select().from(stages).where(eq(stages.id, id)).limit(1);
    return result[0];
  }

  async getStagesByProject(projectId: string): Promise<Stage[]> {
    return await db.select().from(stages)
      .where(eq(stages.projectId, projectId))
      .orderBy(asc(stages.stageNumber));
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    // Find default stage configuration
    const defaultStage = DEFAULT_STAGES.find(ds => ds.stageNumber === insertStage.stageNumber);
    
    const [stage] = await db.insert(stages).values({
      ...insertStage,
      progress: 0,
      isUnlocked: true, // All stages unlocked by default now
      outputs: null,
      keyInsights: defaultStage?.keyInsights || [],
      completedInsights: [],
    }).returning();
    
    return stage;
  }

  async updateStage(id: string, updates: UpdateStage): Promise<Stage | undefined> {
    const stage = await this.getStage(id);
    if (!stage) return undefined;

    let finalUpdates = { ...updates, updatedAt: new Date() };
    
    // Auto-calculate progress based on completed insights
    if (updates.completedInsights && stage.keyInsights) {
      const totalInsights = Array.isArray(stage.keyInsights) ? stage.keyInsights.length : 0;
      const completedCount = Array.isArray(updates.completedInsights) ? updates.completedInsights.length : 0;
      if (totalInsights > 0) {
        finalUpdates.progress = Math.max(0, Math.min(100, Math.round((completedCount / totalInsights) * 100)));
      }
    }
    
    const [updatedStage] = await db.update(stages)
      .set(finalUpdates)
      .where(eq(stages.id, id))
      .returning();
    
    return updatedStage;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }

  async getMessagesByStage(stageId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.stageId, stageId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async deleteMessagesByStage(stageId: string): Promise<void> {
    await db.delete(messages).where(eq(messages.stageId, stageId));
  }
}

export const storage = new PostgresStorage();
