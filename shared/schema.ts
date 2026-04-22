import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { DEFAULT_INTERCEPTOR_PROMPTS, DEFAULT_STAGE_TEMPLATES } from "./prompt-content";

// Admin prompts table for managing all app prompts
export const adminPrompts = pgTable("admin_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(), // "stage" | "system" | "discovery"
  targetKey: text("target_key").notNull(), // e.g., "stage_1", "stage_2", "discovery_initial"
  label: text("label").notNull(), // Human-readable name
  description: text("description"),
  content: text("content").notNull(), // The actual prompt text
  isDefault: boolean("is_default").notNull().default(false), // Is this a system default?
  stageNumber: integer("stage_number"), // Optional: for stage-specific prompts
  updatedBy: varchar("updated_by"), // GitHub username of last editor
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdminPromptSchema = createInsertSchema(adminPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdminPrompt = z.infer<typeof insertAdminPromptSchema>;
export type AdminPrompt = typeof adminPrompts.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Optional: linked user for signed-in ownership
  guestOwnerId: varchar("guest_owner_id"), // Optional: demo-mode ownership token
  name: text("name").notNull(),
  description: text("description").notNull(),
  mode: text("mode").notNull().default("survey"), // "survey" is the default and primary mode
  aiModel: text("ai_model").notNull().default("claude-sonnet"),
  surveyPhase: text("survey_phase").default("discovery"), // "discovery" | "survey" | "complete"
  surveyDefinition: jsonb("survey_definition"), // AI-generated survey questions
  surveyResponses: jsonb("survey_responses"), // User's survey answers
  customPrompts: jsonb("custom_prompts"), // User-defined LLM prompts for various uses
  intakeAnswers: jsonb("intake_answers"), // Answers from 8-question intake flow
  minimumDetails: jsonb("minimum_details"), // Problem statement, goals, objects, actions, v1 definition
  appStyle: jsonb("app_style"), // Selected UI/UX style for the product
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
  index("projects_guest_owner_id_idx").on(table.guestOwnerId),
]);

export const stages = pgTable("stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stageNumber: integer("stage_number").notNull(), // 1-6
  title: text("title").notNull(),
  description: text("description").notNull(),
  progress: integer("progress").notNull().default(0), // 0-100
  isUnlocked: boolean("is_unlocked").notNull().default(true), // All stages unlocked by default
  systemPrompt: text("system_prompt").notNull(),
  aiModel: text("ai_model"), // override project model if needed
  outputs: jsonb("outputs"), // structured outputs from the stage
  keyInsights: jsonb("key_insights"), // required insights for completion
  completedInsights: jsonb("completed_insights"), // insights marked as complete
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageId: varchar("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  // kind: 'chat' = conversational turn, 'deliverable' = final generated document (PRD, spec, etc.)
  // 'system_note' reserved for future automated annotations
  kind: text("kind").notNull().default("chat"),
  // version bumps on regenerate; older versions are retained for history
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// LLM call telemetry. Written by AIService at call boundary. Used for cost
// attribution, latency/error tracking, and BYOK spend caps.
export const llmCalls = pgTable("llm_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),              // nullable — guest calls won't have it
  guestOwnerId: varchar("guest_owner_id"), // nullable — authed calls won't have it
  projectId: varchar("project_id"),        // nullable — some calls (survey gen) don't have a project at call time
  stageId: varchar("stage_id"),
  provider: text("provider").notNull(),    // 'anthropic' | 'groq' | 'openai'
  model: text("model").notNull(),
  task: text("task").notNull(),            // matches LLMTask union in ai.ts
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens"),
  cacheWriteTokens: integer("cache_write_tokens"),
  costUsd: varchar("cost_usd"),            // decimal-as-string to avoid float loss; numeric(12,6) in DB
  latencyMs: integer("latency_ms"),
  status: text("status").notNull(),        // 'ok' | 'error'
  errorCode: text("error_code"),
  streamed: boolean("streamed").notNull().default(false),
  byok: boolean("byok").notNull().default(false),
  requestId: varchar("request_id"),        // correlate with audit + logs
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("llm_calls_user_id_created_at_idx").on(table.userId, table.createdAt),
  index("llm_calls_project_id_idx").on(table.projectId),
]);

export type LlmCall = typeof llmCalls.$inferSelect;
export type InsertLlmCall = typeof llmCalls.$inferInsert;

// Audit events. Write-only business-level log. Actions: project.create,
// project.delete, stage.regenerate, admin.prompt.edit, settings.byok.change, etc.
export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorType: text("actor_type").notNull(),  // 'user' | 'guest' | 'admin' | 'system'
  actorId: varchar("actor_id"),
  action: text("action").notNull(),          // 'project.create' | 'project.delete' | ...
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  metadata: jsonb("metadata"),
  requestId: varchar("request_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_events_actor_id_created_at_idx").on(table.actorId, table.createdAt),
  index("audit_events_resource_idx").on(table.resourceType, table.resourceId),
]);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;

// NOTE: userId and guestOwnerId are intentionally NOT in this pick list —
// they are assigned server-side from the request actor. Accepting them from
// the client would let a caller forge ownership.
export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  mode: true,
  aiModel: true,
  surveyPhase: true,
  surveyDefinition: true,
  surveyResponses: true,
  customPrompts: true,
  intakeAnswers: true,
  minimumDetails: true,
  appStyle: true,
});

// Server-side shape used when storage.createProject is called.
// Augments the client-validated input with ownership fields that only the server may set.
export type InsertProjectWithOwner = z.infer<typeof insertProjectSchema> & {
  userId: string | null;
  guestOwnerId: string | null;
};

// Custom prompt types for user-defined LLM prompts
export const CustomPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  category: z.enum(["requirements", "features", "architecture", "coding", "testing", "general"]),
  isActive: z.boolean().default(true),
});

export const CustomPromptsSchema = z.array(CustomPromptSchema);

export type CustomPrompt = z.infer<typeof CustomPromptSchema>;
export type CustomPrompts = z.infer<typeof CustomPromptsSchema>;

// Survey question types for the dynamic form
export const SurveyQuestionSchema = z.object({
  id: z.string(),
  section: z.string(), // Which section this relates to (requirements, prd, architecture, etc.)
  question: z.string(),
  type: z.enum(["slider", "single-select", "multi-select", "text"]),
  options: z.array(z.string()).optional(), // For select types
  min: z.number().optional(), // For slider
  max: z.number().optional(), // For slider
  minLabel: z.string().optional(), // For slider
  maxLabel: z.string().optional(), // For slider
  helperText: z.string().optional(),
  required: z.boolean().default(true),
});

export const SurveyDefinitionSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    questions: z.array(SurveyQuestionSchema),
  })),
});

export const SurveyResponseSchema = z.record(z.string(), z.union([
  z.number(), // For sliders
  z.string(), // For single-select
  z.array(z.string()), // For multi-select
]));

export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>;
export type SurveyDefinition = z.infer<typeof SurveyDefinitionSchema>;
export type SurveyResponse = z.infer<typeof SurveyResponseSchema>;

export const insertStageSchema = createInsertSchema(stages).pick({
  projectId: true,
  stageNumber: true,
  title: true,
  description: true,
  systemPrompt: true,
  aiModel: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  stageId: true,
  role: true,
  content: true,
  kind: true,
  version: true,
});

export const updateStageSchema = createInsertSchema(stages).pick({
  progress: true,
  systemPrompt: true,
  aiModel: true,
  outputs: true,
  keyInsights: true,
  completedInsights: true,
}).partial();

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertStage = z.infer<typeof insertStageSchema>;
export type Stage = typeof stages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type UpdateStage = z.infer<typeof updateStageSchema>;

// Default stage configurations
export const DEFAULT_STAGES = DEFAULT_STAGE_TEMPLATES;

// Interceptor prompts - behavior modifiers that override or enhance AI responses
// These are separate from stage prompts as they modify runtime behavior
export const INTERCEPTOR_PROMPTS = DEFAULT_INTERCEPTOR_PROMPTS;
