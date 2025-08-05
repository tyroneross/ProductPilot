import { type Project, type InsertProject, type Stage, type InsertStage, type Message, type InsertMessage, type UpdateStage, DEFAULT_STAGES } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private projects: Map<string, Project>;
  private stages: Map<string, Stage>;
  private messages: Map<string, Message>;

  constructor() {
    this.projects = new Map();
    this.stages = new Map();
    this.messages = new Map();
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project: Project = {
      ...insertProject,
      id,
      createdAt: now,
      updatedAt: now,
      aiModel: insertProject.aiModel || "claude-sonnet",
    };
    this.projects.set(id, project);

    // Create default stages for the project
    for (const defaultStage of DEFAULT_STAGES) {
      await this.createStage({
        projectId: id,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt,
      });
      
      // Set first stage as unlocked
      if (defaultStage.stageNumber === 1) {
        const stages = Array.from(this.stages.values()).filter(s => s.projectId === id);
        const firstStage = stages.find(s => s.stageNumber === 1);
        if (firstStage) {
          firstStage.isUnlocked = true;
          this.stages.set(firstStage.id, firstStage);
        }
      }
    }

    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) return false;

    // Delete all stages and messages for this project
    const projectStages = Array.from(this.stages.values()).filter(s => s.projectId === id);
    for (const stage of projectStages) {
      await this.deleteMessagesByStage(stage.id);
      this.stages.delete(stage.id);
    }

    this.projects.delete(id);
    return true;
  }

  async getStage(id: string): Promise<Stage | undefined> {
    return this.stages.get(id);
  }

  async getStagesByProject(projectId: string): Promise<Stage[]> {
    return Array.from(this.stages.values())
      .filter(stage => stage.projectId === projectId)
      .sort((a, b) => a.stageNumber - b.stageNumber);
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    const id = randomUUID();
    const now = new Date();
    const stage: Stage = {
      ...insertStage,
      id,
      progress: 0,
      isUnlocked: insertStage.stageNumber === 1,
      outputs: null,
      aiModel: insertStage.aiModel || null,
      createdAt: now,
      updatedAt: now,
    };
    this.stages.set(id, stage);
    return stage;
  }

  async updateStage(id: string, updates: UpdateStage): Promise<Stage | undefined> {
    const stage = this.stages.get(id);
    if (!stage) return undefined;

    const updatedStage = {
      ...stage,
      ...updates,
      updatedAt: new Date(),
    };
    this.stages.set(id, updatedStage);

    // Check if stage is completed and unlock next stage
    if (updatedStage.progress >= 75) {
      const projectStages = await this.getStagesByProject(stage.projectId);
      const nextStage = projectStages.find(s => s.stageNumber === stage.stageNumber + 1);
      if (nextStage && !nextStage.isUnlocked) {
        const nextStageUpdate = { ...nextStage, isUnlocked: true };
        this.stages.set(nextStage.id, nextStageUpdate);
      }
    }

    return updatedStage;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByStage(stageId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.stageId === stageId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async deleteMessagesByStage(stageId: string): Promise<void> {
    const stageMessages = Array.from(this.messages.values()).filter(m => m.stageId === stageId);
    for (const message of stageMessages) {
      this.messages.delete(message.id);
    }
  }
}

export const storage = new MemStorage();
