import type {
  Project, Stage, Message, InsertProject, InsertProjectWithOwner, InsertStage,
  InsertMessage, AdminPrompt, InsertAdminPrompt, InsertLlmCall, InsertAuditEvent,
  AuditEvent, LlmCall, IntakeQuestion, InsertIntakeQuestion,
} from "@shared/schema";
import { AsyncLocalStorage } from "async_hooks";
import { logger } from "./lib/logger";
import { decryptSecret, encryptSecret } from "./lib/secret-crypto";
import { projects, stages, messages, adminPrompts, llmCalls, auditEvents, intakeQuestions, DEFAULT_STAGES } from "@shared/schema";
import { DISCOVERY_INITIAL_PROMPT } from "@shared/prompt-content";
import { eq, and, ne, isNull, desc, asc, sql } from "drizzle-orm";
import { db } from "./db";

interface IStorage {
  // Projects
  createProject(project: InsertProjectWithOwner): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  getProjectsByGuestOwnerId(guestOwnerId: string): Promise<Project[]>;
  claimProjectsForUser(guestOwnerId: string, userId: string): Promise<Project[]>;
  getOpsSummary(): Promise<OpsSummary>;
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
  // Deliverable history for a stage (kind='deliverable'), oldest version first.
  // Every regenerate appends a new row; nothing is deleted, so this is the
  // version history substrate for export + restore.
  getDeliverablesByStage(stageId: string): Promise<Message[]>;
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
  listLlmCalls(filters: LlmCallListFilters): Promise<{ rows: LlmCall[]; total: number }>;
  getLlmCall(id: string): Promise<LlmCall | undefined>;

  // Audit log
  createAuditEvent(event: InsertAuditEvent): Promise<void>;
  listAuditEvents(filters: AuditEventListFilters): Promise<{ rows: AuditEvent[]; total: number }>;
  getAuditEvent(id: string): Promise<AuditEvent | undefined>;

  // Intake questions (Phase 2 — adaptive intake)
  createIntakeQuestion(row: InsertIntakeQuestion): Promise<IntakeQuestion>;
  updateIntakeQuestionAnswer(id: string, answerText: string): Promise<IntakeQuestion | undefined>;
  getIntakeQuestionsByProject(projectId: string): Promise<IntakeQuestion[]>;
}

/**
 * Operational snapshot for the admin overview.
 *
 * Every field here had to be derived by hand-written SQL during the 2026-07-30
 * incident. The numbers that mattered most — how many projects are stranded
 * behind an expired guest cookie, and how many real people are actually using
 * the product — were invisible from inside the app.
 *
 * `strandedProjects` counts guest-owned rows older than the 30-day cookie
 * lifetime. Those are unreachable by their creators: listing filters on
 * user_id, and a direct link 403s without the cookie.
 */
export type OpsSummary = {
  users: {
    registeredAccounts: number;
    accountsWithProjects: number;
    distinctGuests: number;
    guestsWithRealWork: number;
  };
  ownership: {
    accountOwned: number;
    guestOwnedAtRisk: number;
    strandedProjects: number;
    orphaned: number;
    totalProjects: number;
  };
  engagement: {
    projectsPerGuest: Array<{ projects: number; guests: number }>;
    totalStages: number;
    totalMessages: number;
  };
  spend: {
    windowDays: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    errorCalls: number;
    byModel: Array<{ model: string; calls: number; costUsd: number }>;
  };
  generatedAt: string;
};

/** Cookie lifetime that decides whether a guest project is still reachable. */
export const GUEST_COOKIE_DAYS = 30;

// Filter shape for admin observability pages. All fields optional.
export type AuditEventListFilters = {
  actorType?: string;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
};

export type LlmCallListFilters = {
  userId?: string;
  guestOwnerId?: string;
  projectId?: string;
  stageId?: string;
  provider?: string;
  model?: string;
  task?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

type DbActorContext = {
  userId?: string | null;
  guestOwnerId?: string | null;
};

const dbActorContext = new AsyncLocalStorage<DbActorContext>();

export function runWithDbActorContext<T>(context: DbActorContext, callback: () => T): T {
  return dbActorContext.run(context, callback);
}

export function updateDbActorContext(updates: DbActorContext): void {
  const context = dbActorContext.getStore();
  if (context) {
    Object.assign(context, updates);
  }
}

// In-memory storage fallback
export class MemStorage implements IStorage {
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
      // Phase 1 (migration 0003): adaptive intake state.
      productState: null,
      traceMatrix: null,
      intakeMode: "adaptive",
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

  async getOpsSummary(): Promise<OpsSummary> {
    // In-memory fallback (dev only, no database). Numbers are real for what
    // this process holds; llm spend is not tracked here, so it reports zero
    // rather than a fabricated figure.
    const all = await this.getAllProjects();
    const cutoff = Date.now() - GUEST_COOKIE_DAYS * 24 * 60 * 60 * 1000;
    const guestProjects = all.filter((p) => !p.userId && p.guestOwnerId);
    const perGuestMap = new Map<string, number>();
    for (const p of guestProjects) {
      perGuestMap.set(p.guestOwnerId!, (perGuestMap.get(p.guestOwnerId!) ?? 0) + 1);
    }
    const dist = new Map<number, number>();
    Array.from(perGuestMap.values()).forEach((c) => dist.set(c, (dist.get(c) ?? 0) + 1));
    return {
      users: {
        registeredAccounts: new Set(all.map((p) => p.userId).filter(Boolean)).size,
        accountsWithProjects: new Set(all.filter((p) => p.userId).map((p) => p.userId)).size,
        distinctGuests: perGuestMap.size,
        guestsWithRealWork: 0,
      },
      ownership: {
        accountOwned: all.filter((p) => p.userId).length,
        guestOwnedAtRisk: guestProjects.filter((p) => p.createdAt.getTime() >= cutoff).length,
        strandedProjects: guestProjects.filter((p) => p.createdAt.getTime() < cutoff).length,
        orphaned: all.filter((p) => !p.userId && !p.guestOwnerId).length,
        totalProjects: all.length,
      },
      engagement: {
        projectsPerGuest: Array.from(dist.entries()).map(([projects, guests]) => ({ projects, guests })).sort((a, b) => a.projects - b.projects),
        totalStages: this.stages.size,
        totalMessages: this.messages.size,
      },
      spend: { windowDays: 30, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, errorCalls: 0, byModel: [] },
      generatedAt: new Date().toISOString(),
    };
  }

  async claimProjectsForUser(guestOwnerId: string, userId: string): Promise<Project[]> {
    if (!guestOwnerId || !userId) return [];
    const claimed: Project[] = [];
    for (const project of await this.getAllProjects()) {
      // Mirrors the SQL predicate: never reassign a row that already belongs
      // to an account, even when the guest cookie matches.
      if (project.guestOwnerId === guestOwnerId && !project.userId) {
        const updated = await this.updateProject(project.id, {
          userId,
          guestOwnerId: null,
        } as Partial<Project>);
        if (updated) claimed.push(updated);
      }
    }
    return claimed;
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

  async getDeliverablesByStage(stageId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.stageId === stageId && m.kind === "deliverable")
      .sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
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
    const settings = this.userSettingsMap.get(userId);
    if (!settings) return undefined;
    return {
      ...settings,
      llmApiKey: decryptSecret(settings.llmApiKey),
      llm_api_key: decryptSecret(settings.llm_api_key),
    };
  }

  async upsertUserSettings(userId: string, updates: Record<string, any>) {
    const existing = this.userSettingsMap.get(userId) || { userId, llmProvider: 'groq', llmModel: 'llama-3.3-70b-versatile' };
    const encryptedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(encryptedUpdates, "llmApiKey")) {
      encryptedUpdates.llmApiKey = encryptSecret(encryptedUpdates.llmApiKey);
    }
    if (Object.prototype.hasOwnProperty.call(encryptedUpdates, "llm_api_key")) {
      encryptedUpdates.llm_api_key = encryptSecret(encryptedUpdates.llm_api_key);
    }
    const merged = { ...existing, ...encryptedUpdates, userId, updatedAt: new Date() };
    this.userSettingsMap.set(userId, merged);
    return this.getUserSettings(userId);
  }

  // LLM Telemetry - MemStorage implementation (dev fallback, in-memory only)
  private llmCallLog: LlmCall[] = [];

  async createLlmCall(call: InsertLlmCall): Promise<void> {
    this.llmCallLog.push({
      id: this.generateId(),
      userId: call.userId ?? null,
      guestOwnerId: call.guestOwnerId ?? null,
      projectId: call.projectId ?? null,
      stageId: call.stageId ?? null,
      provider: call.provider,
      model: call.model,
      task: call.task,
      inputTokens: call.inputTokens ?? 0,
      outputTokens: call.outputTokens ?? 0,
      cacheReadTokens: call.cacheReadTokens ?? null,
      cacheWriteTokens: call.cacheWriteTokens ?? null,
      costUsd: call.costUsd ?? null,
      latencyMs: call.latencyMs ?? null,
      status: call.status,
      errorCode: call.errorCode ?? null,
      streamed: call.streamed ?? false,
      byok: call.byok ?? false,
      requestId: call.requestId ?? null,
      createdAt: new Date(),
    });
  }

  async listLlmCalls(filters: LlmCallListFilters): Promise<{ rows: LlmCall[]; total: number }> {
    const filtered = this.llmCallLog.filter((row) => {
      if (filters.userId && row.userId !== filters.userId) return false;
      if (filters.guestOwnerId && row.guestOwnerId !== filters.guestOwnerId) return false;
      if (filters.projectId && row.projectId !== filters.projectId) return false;
      if (filters.stageId && row.stageId !== filters.stageId) return false;
      if (filters.provider && row.provider !== filters.provider) return false;
      if (filters.model && row.model !== filters.model) return false;
      if (filters.task && row.task !== filters.task) return false;
      if (filters.status && row.status !== filters.status) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    return { rows: sorted.slice(offset, offset + limit), total: sorted.length };
  }

  async getLlmCall(id: string): Promise<LlmCall | undefined> {
    return this.llmCallLog.find((row) => row.id === id);
  }

  // Audit log - MemStorage implementation (dev fallback, in-memory only)
  private auditEventLog: AuditEvent[] = [];

  async createAuditEvent(event: InsertAuditEvent): Promise<void> {
    this.auditEventLog.push({
      id: this.generateId(),
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      metadata: event.metadata ?? null,
      requestId: event.requestId ?? null,
      createdAt: new Date(),
    });
  }

  async listAuditEvents(filters: AuditEventListFilters): Promise<{ rows: AuditEvent[]; total: number }> {
    const filtered = this.auditEventLog.filter((row) => {
      if (filters.actorType && row.actorType !== filters.actorType) return false;
      if (filters.actorId && row.actorId !== filters.actorId) return false;
      if (filters.action && row.action !== filters.action) return false;
      if (filters.resourceType && row.resourceType !== filters.resourceType) return false;
      if (filters.resourceId && row.resourceId !== filters.resourceId) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    return { rows: sorted.slice(offset, offset + limit), total: sorted.length };
  }

  async getAuditEvent(id: string): Promise<AuditEvent | undefined> {
    return this.auditEventLog.find((row) => row.id === id);
  }

  // Intake questions — MemStorage implementation (dev fallback, in-memory)
  private intakeQuestionLog: IntakeQuestion[] = [];

  async createIntakeQuestion(row: InsertIntakeQuestion): Promise<IntakeQuestion> {
    const stamp: IntakeQuestion = {
      id: this.generateId(),
      projectId: row.projectId,
      step: row.step,
      method: row.method ?? null,
      questionText: row.questionText,
      answerText: row.answerText ?? null,
      metadata: row.metadata ?? null,
      createdAt: new Date(),
      answeredAt: row.answeredAt ?? null,
    };
    this.intakeQuestionLog.push(stamp);
    return stamp;
  }

  async updateIntakeQuestionAnswer(id: string, answerText: string): Promise<IntakeQuestion | undefined> {
    const row = this.intakeQuestionLog.find((r) => r.id === id);
    if (!row) return undefined;
    row.answerText = answerText;
    row.answeredAt = new Date();
    return row;
  }

  async getIntakeQuestionsByProject(projectId: string): Promise<IntakeQuestion[]> {
    return this.intakeQuestionLog
      .filter((row) => row.projectId === projectId)
      .sort((a, b) => a.step - b.step);
  }
}

// PostgreSQL storage using Drizzle
class PostgresStorage implements IStorage {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  private async withActor(operation: (database: any) => any): Promise<any> {
    const actor = dbActorContext.getStore();

    return await this.db.transaction(async (tx: typeof this.db) => {
      await tx.execute(sql`
        SELECT
          set_config('app.current_user_id', ${actor?.userId ?? ""}, true),
          set_config('app.current_guest_owner_id', ${actor?.guestOwnerId ?? ""}, true)
      `);
      return operation(tx);
    });
  }

  async createProject(insertProject: InsertProjectWithOwner): Promise<Project> {
    // Project + default stages atomically — no orphan project rows if a stage insert fails.
    return await this.withActor(async (tx: typeof this.db) => {
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
    const result = await this.withActor((tx) =>
      tx.select().from(projects).where(eq(projects.id, id)).limit(1)
    );
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.withActor((tx) =>
      tx.select().from(projects).orderBy(desc(projects.createdAt))
    );
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return await this.withActor((tx) =>
      tx
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.createdAt))
    );
  }

  async getProjectsByGuestOwnerId(guestOwnerId: string): Promise<Project[]> {
    return await this.withActor((tx) =>
      tx
        .select()
        .from(projects)
        .where(eq(projects.guestOwnerId, guestOwnerId))
        .orderBy(desc(projects.createdAt))
    );
  }

  /**
   * Transfer EVERY project owned by a guest cookie to a real account, in one
   * statement.
   *
   * Claiming one project at a time was the bug: the claim route cleared the
   * guest cookie after the first transfer, so every remaining project owned by
   * that cookie became unreachable — the browser could no longer present the
   * identity that proved ownership, and GET /api/projects only ever returns
   * rows matching user_id. 35 of 46 production projects were stranded this way.
   *
   * The `user_id is null` predicate is a safety net, not an optimization: a row
   * that already belongs to an account must never be reassigned by a guest
   * cookie, even one that legitimately matches guest_owner_id.
   */
  async claimProjectsForUser(guestOwnerId: string, userId: string): Promise<Project[]> {
    if (!guestOwnerId || !userId) return [];
    return await this.withActor((tx) =>
      tx
        .update(projects)
        .set({ userId, guestOwnerId: null, updatedAt: new Date() })
        .where(and(eq(projects.guestOwnerId, guestOwnerId), isNull(projects.userId)))
        .returning()
    );
  }

  async getOpsSummary(): Promise<OpsSummary> {
    const SPEND_WINDOW_DAYS = 30;
    const cutoff = `${GUEST_COOKIE_DAYS} days`;

    // One round trip per logical group rather than per metric. All counts come
    // from live rows — there is no cached or derived table behind this.
    const [counts] = await this.withActor((tx) =>
      tx.execute(sql`
        select
          (select count(*) from "user")::int as registered_accounts,
          (select count(distinct user_id) from projects where user_id is not null)::int as accounts_with_projects,
          (select count(distinct guest_owner_id) from projects where guest_owner_id is not null)::int as distinct_guests,
          (select count(distinct p.guest_owner_id) from projects p
             where p.guest_owner_id is not null
               and exists (select 1 from stages s where s.project_id = p.id and s.progress > 0))::int as guests_with_real_work,
          (select count(*) from projects where user_id is not null)::int as account_owned,
          (select count(*) from projects where user_id is null and guest_owner_id is not null
             and created_at >= now() - ${cutoff}::interval)::int as guest_owned_at_risk,
          (select count(*) from projects where user_id is null and guest_owner_id is not null
             and created_at <  now() - ${cutoff}::interval)::int as stranded,
          (select count(*) from projects where user_id is null and guest_owner_id is null)::int as orphaned,
          (select count(*) from projects)::int as total_projects,
          (select count(*) from stages)::int as total_stages,
          (select count(*) from messages)::int as total_messages
      `) as any
    );

    const perGuest = (await this.withActor((tx) =>
      tx.execute(sql`
        select c::int as projects, count(*)::int as guests from (
          select guest_owner_id, count(*) c from projects
          where user_id is null and guest_owner_id is not null group by 1
        ) t group by 1 order by 1
      `) as any
    )) as Array<{ projects: number; guests: number }>;

    const [spend] = await this.withActor((tx) =>
      tx.execute(sql`
        select
          count(*)::int as calls,
          coalesce(sum(input_tokens),0)::bigint as input_tokens,
          coalesce(sum(output_tokens),0)::bigint as output_tokens,
          coalesce(sum(cost_usd),0)::numeric as cost_usd,
          count(*) filter (where status <> 'ok')::int as error_calls
        from llm_calls where created_at >= now() - ${`${SPEND_WINDOW_DAYS} days`}::interval
      `) as any
    );

    const byModel = (await this.withActor((tx) =>
      tx.execute(sql`
        select model, count(*)::int as calls, coalesce(sum(cost_usd),0)::numeric as cost_usd
        from llm_calls where created_at >= now() - ${`${SPEND_WINDOW_DAYS} days`}::interval
        group by 1 order by 3 desc nulls last limit 10
      `) as any
    )) as Array<{ model: string; calls: number; cost_usd: string }>;

    const n = (v: unknown) => Number(v ?? 0);
    return {
      users: {
        registeredAccounts: n(counts?.registered_accounts),
        accountsWithProjects: n(counts?.accounts_with_projects),
        distinctGuests: n(counts?.distinct_guests),
        guestsWithRealWork: n(counts?.guests_with_real_work),
      },
      ownership: {
        accountOwned: n(counts?.account_owned),
        guestOwnedAtRisk: n(counts?.guest_owned_at_risk),
        strandedProjects: n(counts?.stranded),
        orphaned: n(counts?.orphaned),
        totalProjects: n(counts?.total_projects),
      },
      engagement: {
        projectsPerGuest: (perGuest ?? []).map((r) => ({ projects: n(r.projects), guests: n(r.guests) })),
        totalStages: n(counts?.total_stages),
        totalMessages: n(counts?.total_messages),
      },
      spend: {
        windowDays: SPEND_WINDOW_DAYS,
        calls: n(spend?.calls),
        inputTokens: n(spend?.input_tokens),
        outputTokens: n(spend?.output_tokens),
        costUsd: n(spend?.cost_usd),
        errorCalls: n(spend?.error_calls),
        byModel: (byModel ?? []).map((r) => ({ model: r.model, calls: n(r.calls), costUsd: n(r.cost_usd) })),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getUserDraft(userId: string): Promise<Project | undefined> {
    const result = await this.withActor((tx) =>
      tx.select().from(projects)
        .where(and(eq(projects.userId, userId), ne(projects.surveyPhase, "complete")))
        .limit(1)
    );
    return result[0];
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const finalUpdates: any = { ...updates };
    if (Object.keys(finalUpdates).length > 0 && !finalUpdates.updatedAt) {
      finalUpdates.updatedAt = new Date();
    }
    
    const [updatedProject] = await this.withActor((tx) =>
      tx.update(projects)
        .set(finalUpdates)
        .where(eq(projects.id, id))
        .returning()
    );
    
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await this.withActor((tx) => tx.delete(projects).where(eq(projects.id, id)));
    return result.rowCount > 0;
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    const [stage] = await this.withActor((tx) => tx.insert(stages).values(insertStage).returning());
    return stage;
  }

  async getStage(id: string): Promise<Stage | undefined> {
    const result = await this.withActor((tx) =>
      tx.select().from(stages).where(eq(stages.id, id)).limit(1)
    );
    return result[0];
  }

  async getStagesByProject(projectId: string): Promise<Stage[]> {
    return await this.withActor((tx) =>
      tx.select().from(stages).where(eq(stages.projectId, projectId))
    );
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
    
    const [updatedStage] = await this.withActor((tx) =>
      tx.update(stages)
        .set(finalUpdates)
        .where(eq(stages.id, id))
        .returning()
    );
    
    return updatedStage;
  }

  async ensureStagesForProject(projectId: string): Promise<Stage[]> {
    // Check if stages already exist
    const existing = await this.withActor((tx) =>
      tx.select().from(stages).where(eq(stages.projectId, projectId))
    );
    if (existing.length > 0) return existing;

    // Create default stages
    const createdStages: Stage[] = [];
    for (const defaultStage of DEFAULT_STAGES) {
      const [stage] = await this.withActor((tx) =>
        tx.insert(stages).values({
          projectId,
          stageNumber: defaultStage.stageNumber,
          title: defaultStage.title,
          description: defaultStage.description,
          systemPrompt: defaultStage.systemPrompt,
          keyInsights: defaultStage.keyInsights || [],
          completedInsights: [],
          progress: 0,
          isUnlocked: true,
        }).returning()
      );
      createdStages.push(stage);
    }
    return createdStages;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const result = await this.withActor((tx) =>
      tx.select().from(messages).where(eq(messages.id, id)).limit(1)
    );
    return result[0];
  }

  async getMessagesByStage(stageId: string): Promise<Message[]> {
    return await this.withActor((tx) =>
      tx.select().from(messages)
        .where(eq(messages.stageId, stageId))
        .orderBy(asc(messages.createdAt))
    );
  }

  async getDeliverablesByStage(stageId: string): Promise<Message[]> {
    return await this.withActor((tx) =>
      tx.select().from(messages)
        .where(and(eq(messages.stageId, stageId), eq(messages.kind, "deliverable")))
        .orderBy(asc(messages.version), asc(messages.createdAt))
    );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await this.withActor((tx) =>
      tx.insert(messages).values(insertMessage).returning()
    );
    return message;
  }

  async deleteMessagesByStage(stageId: string): Promise<void> {
    await this.withActor((tx) => tx.delete(messages).where(eq(messages.stageId, stageId)));
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
    const result = await this.withActor((tx) =>
      tx.execute(sql`SELECT * FROM user_settings WHERE user_id = ${userId} LIMIT 1`)
    );
    const settings = result.rows?.[0];
    if (!settings) return undefined;
    return {
      ...settings,
      llm_api_key: decryptSecret(settings.llm_api_key as string | null | undefined),
      llmApiKey: decryptSecret(settings.llmApiKey as string | null | undefined),
    };
  }

  async upsertUserSettings(userId: string, updates: Record<string, any>) {
    const existing = await this.getUserSettings(userId);
    const encryptedApiKey =
      updates.llmApiKey !== undefined ? encryptSecret(updates.llmApiKey) : undefined;

    if (existing) {
      await this.withActor((tx) =>
        tx.execute(
        sql`UPDATE user_settings SET
          llm_provider = COALESCE(${updates.llmProvider ?? null}, llm_provider),
          llm_api_key = ${encryptedApiKey !== undefined ? encryptedApiKey : sql`llm_api_key`},
          llm_model = COALESCE(${updates.llmModel ?? null}, llm_model),
          updated_at = NOW()
        WHERE user_id = ${userId}`
        )
      );
      return this.getUserSettings(userId);
    } else {
      await this.withActor((tx) =>
        tx.execute(
        sql`INSERT INTO user_settings (id, user_id, llm_provider, llm_api_key, llm_model)
        VALUES (gen_random_uuid(), ${userId}, ${updates.llmProvider || 'groq'}, ${encryptedApiKey ?? null}, ${updates.llmModel || 'llama-3.3-70b-versatile'})`
        )
      );
      return this.getUserSettings(userId);
    }
  }

  // LLM Telemetry - PostgresStorage implementation
  async createLlmCall(call: InsertLlmCall): Promise<void> {
    await this.db.insert(llmCalls).values(call);
  }

  // Admin observability: list LLM calls with filters + pagination.
  // Reads are admin-only (no actor-scoped RLS needed; admin endpoint gates access).
  // Uses raw SQL to avoid pulling drizzle-orm's where-builder chain into this read.
  async listLlmCalls(filters: LlmCallListFilters): Promise<{ rows: LlmCall[]; total: number }> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const clauses: any[] = [];
    if (filters.userId) clauses.push(sql`user_id = ${filters.userId}`);
    if (filters.guestOwnerId) clauses.push(sql`guest_owner_id = ${filters.guestOwnerId}`);
    if (filters.projectId) clauses.push(sql`project_id = ${filters.projectId}`);
    if (filters.stageId) clauses.push(sql`stage_id = ${filters.stageId}`);
    if (filters.provider) clauses.push(sql`provider = ${filters.provider}`);
    if (filters.model) clauses.push(sql`model = ${filters.model}`);
    if (filters.task) clauses.push(sql`task = ${filters.task}`);
    if (filters.status) clauses.push(sql`status = ${filters.status}`);

    const whereSql = clauses.length
      ? sql`WHERE ${sql.join(clauses, sql` AND `)}`
      : sql``;

    const rowsResult = await this.db.execute(
      sql`SELECT * FROM llm_calls ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const totalResult = await this.db.execute(
      sql`SELECT COUNT(*)::int AS count FROM llm_calls ${whereSql}`
    );
    const rows = (rowsResult.rows as any[]).map(mapLlmCallRow);
    const total = Number((totalResult.rows as any[])[0]?.count ?? 0);
    return { rows, total };
  }

  async getLlmCall(id: string): Promise<LlmCall | undefined> {
    const result = await this.db.execute(sql`SELECT * FROM llm_calls WHERE id = ${id} LIMIT 1`);
    const row = (result.rows as any[])[0];
    return row ? mapLlmCallRow(row) : undefined;
  }

  // Audit log - PostgresStorage implementation
  async createAuditEvent(event: InsertAuditEvent): Promise<void> {
    await this.db.insert(auditEvents).values(event);
  }

  async listAuditEvents(filters: AuditEventListFilters): Promise<{ rows: AuditEvent[]; total: number }> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const clauses: any[] = [];
    if (filters.actorType) clauses.push(sql`actor_type = ${filters.actorType}`);
    if (filters.actorId) clauses.push(sql`actor_id = ${filters.actorId}`);
    if (filters.action) clauses.push(sql`action = ${filters.action}`);
    if (filters.resourceType) clauses.push(sql`resource_type = ${filters.resourceType}`);
    if (filters.resourceId) clauses.push(sql`resource_id = ${filters.resourceId}`);

    const whereSql = clauses.length
      ? sql`WHERE ${sql.join(clauses, sql` AND `)}`
      : sql``;

    const rowsResult = await this.db.execute(
      sql`SELECT * FROM audit_events ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const totalResult = await this.db.execute(
      sql`SELECT COUNT(*)::int AS count FROM audit_events ${whereSql}`
    );
    const rows = (rowsResult.rows as any[]).map(mapAuditEventRow);
    const total = Number((totalResult.rows as any[])[0]?.count ?? 0);
    return { rows, total };
  }

  async getAuditEvent(id: string): Promise<AuditEvent | undefined> {
    const result = await this.db.execute(sql`SELECT * FROM audit_events WHERE id = ${id} LIMIT 1`);
    const row = (result.rows as any[])[0];
    return row ? mapAuditEventRow(row) : undefined;
  }

  // Intake questions — Phase 2. RLS on intake_questions inherits from projects via
  // the policy in migration 0003; withActor() sets the GUCs that policy reads.
  async createIntakeQuestion(row: InsertIntakeQuestion): Promise<IntakeQuestion> {
    const [inserted] = await this.withActor((tx: typeof this.db) =>
      tx.insert(intakeQuestions).values(row).returning(),
    );
    return inserted as IntakeQuestion;
  }

  async updateIntakeQuestionAnswer(id: string, answerText: string): Promise<IntakeQuestion | undefined> {
    const [updated] = await this.withActor((tx: typeof this.db) =>
      tx.update(intakeQuestions)
        .set({ answerText, answeredAt: new Date() })
        .where(eq(intakeQuestions.id, id))
        .returning(),
    );
    return updated as IntakeQuestion | undefined;
  }

  async getIntakeQuestionsByProject(projectId: string): Promise<IntakeQuestion[]> {
    return await this.withActor((tx: typeof this.db) =>
      tx.select().from(intakeQuestions)
        .where(eq(intakeQuestions.projectId, projectId))
        .orderBy(asc(intakeQuestions.step)),
    );
  }
}

// Row mappers — pg returns snake_case; our types are camelCase.
function mapLlmCallRow(row: any): LlmCall {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    guestOwnerId: row.guest_owner_id ?? null,
    projectId: row.project_id ?? null,
    stageId: row.stage_id ?? null,
    provider: row.provider,
    model: row.model,
    task: row.task,
    inputTokens: row.input_tokens ?? 0,
    outputTokens: row.output_tokens ?? 0,
    cacheReadTokens: row.cache_read_tokens ?? null,
    cacheWriteTokens: row.cache_write_tokens ?? null,
    costUsd: row.cost_usd != null ? String(row.cost_usd) : null,
    latencyMs: row.latency_ms ?? null,
    status: row.status,
    errorCode: row.error_code ?? null,
    streamed: Boolean(row.streamed),
    byok: Boolean(row.byok),
    requestId: row.request_id ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function mapAuditEventRow(row: any): AuditEvent {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id ?? null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? null,
    metadata: row.metadata ?? null,
    requestId: row.request_id ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

// Create the storage instance with proper fallback.
// Fail closed in production: never serve MemStorage in prod — it silently drops data on restart.
function createStorage(): IStorage {
  const hasDatabase = !!(
    process.env.DATABASE_URL ||
    (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE)
  );

  if (hasDatabase && db) {
    logger.info("Using PostgreSQL storage");
    return new PostgresStorage(db);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No database configured in production. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Refusing to fall back to in-memory storage.",
    );
  }

  logger.warn("Using in-memory storage (no database configured — dev only)");
  return new MemStorage();
}

export const storage = createStorage();
