import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { DEFAULT_INTERCEPTOR_PROMPTS, DEFAULT_STAGE_TEMPLATES } from "./prompt-content";

// Admin prompts table for managing all app prompts
import { uniqueIndex } from "drizzle-orm/pg-core";

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
}, (table) => [
  // UNIQUE target_key — seedDefaultPrompts relies on this to avoid duplicates on re-run.
  uniqueIndex("admin_prompts_target_key_unique").on(table.targetKey),
]);

// Legacy express-session/connect-pg-simple store. Kept so older local data isn't
// dropped; unused by Better Auth. No FK, no dependencies.
export const legacySessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_sessions_expire").on(table.expire),
]);

// User-scoped BYOK LLM settings. userId → user.id FK is declared in a follow-up
// migration (shared/schema.ts can't import server/auth/schema.ts cleanly).
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  llmProvider: text("llm_provider").default("groq"),
  llmApiKey: text("llm_api_key"), // encrypted at rest (see server/lib/secret-crypto.ts)
  llmModel: text("llm_model").default("llama-3.3-70b-versatile"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

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
  // Adaptive intake (Phase 1, migration 0003).
  // productState — per-project working memory (tradeoff weights, pivot log, stance "because" clauses, ...).
  // traceMatrix — Need → Feature → Test/ADR backreferences populated by Phase 3 linter.
  // intakeMode — gate for adaptive vs legacy survey/minimum flows. New rows default to 'adaptive'.
  productState: jsonb("product_state"),
  traceMatrix: jsonb("trace_matrix"),
  intakeMode: text("intake_mode").notNull().default("adaptive"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
  index("projects_guest_owner_id_idx").on(table.guestOwnerId),
]);

// Per-question intake log. One row per question asked by IntakeController (Phase 2).
// `metadata` carries method (JTBD/QFD/Pugh/agent), confidence, and any inferred-vs-asked flag.
// Admin telemetry views must redact answer_text the same way `messages` already are.
export const intakeQuestions = pgTable("intake_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  step: integer("step").notNull(),
  method: text("method"), // 'jtbd' | 'qfd' | 'pugh' | 'agent' | null for free-form
  questionText: text("question_text").notNull(),
  answerText: text("answer_text"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
}, (table) => [
  index("intake_questions_project_id_step_idx").on(table.projectId, table.step),
]);

// Stage-rendered Spec object + its Markdown view. `kind` matches doc stages
// ('brief' | 'prd' | 'ux' | 'functional' | 'handoff'). Linter (Phase 3) reads payload;
// UI reads renderedMarkdown for compatibility with today's read path.
export const specArtifacts = pgTable("spec_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stageId: varchar("stage_id").references(() => stages.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  version: integer("version").notNull().default(1),
  payload: jsonb("payload").notNull(),
  renderedMarkdown: text("rendered_markdown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("spec_artifacts_project_id_kind_idx").on(table.projectId, table.kind),
  index("spec_artifacts_project_id_version_idx").on(table.projectId, table.version),
]);

export type IntakeQuestion = typeof intakeQuestions.$inferSelect;
export type InsertIntakeQuestion = typeof intakeQuestions.$inferInsert;
export type SpecArtifact = typeof specArtifacts.$inferSelect;
export type InsertSpecArtifact = typeof specArtifacts.$inferInsert;

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
}, (table) => [
  index("stages_project_id_idx").on(table.projectId),
]);

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
}, (table) => [
  // Hot-path: message reads always filter by stage_id and order by created_at.
  index("messages_stage_id_created_at_idx").on(table.stageId, table.createdAt),
  index("messages_stage_kind_idx").on(table.stageId, table.kind),
]);

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

// ───────────────────────────────────────────────────────────────────────
// Adaptive intake / structured spec — Zod schemas (Phase 1)
//
// These are the typed shapes that flow through intake, doc generation,
// the spec linter (Phase 3), and the coding-agent handoff export (Phase 5).
// They live alongside DB types so client + server share one source of truth.
//
// Conventions:
//   - Every entity carries a stable string `id`. Cross-references (e.g. Test.needIds)
//     use these ids so the trace matrix is computable without LLM help.
//   - PII handling is non-waivable (Phase 3 enforces): DataPoint.pii=true with no
//     handlingNote → linter blocker.
//   - "because" clauses on stance entries and non-goals are required by the
//     PRD-Builder methodology and become Phase 3 linter rules.
// ───────────────────────────────────────────────────────────────────────

const IdSchema = z.string().min(1);
const Priority = z.enum(["P0", "P1", "P2", "P3"]).optional();
const Severity = z.enum(["block", "warn", "info"]);
const Reversibility = z.enum(["high", "medium", "low"]);

export const NeedSchema = z.object({
  id: IdSchema,
  title: z.string(),
  description: z.string().optional(),
  priority: Priority,
  source: z.string().optional(), // intake question id or "inferred"
});

export const FeatureSchema = z.object({
  id: IdSchema,
  title: z.string(),
  description: z.string().optional(),
  priority: Priority,
  needIds: z.array(IdSchema).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
});

export const PersonaSchema = z.object({
  id: IdSchema,
  name: z.string(),
  trigger: z.string().optional(),
  exclusions: z.array(z.string()).default([]), // "Who they are NOT"
  jobs: z.array(z.string()).default([]),
});

export const ScenarioSchema = z.object({
  id: IdSchema,
  personaId: IdSchema.optional(),
  context: z.string(),
  goal: z.string(),
  successSignal: z.string().optional(),
});

export const ScreenSchema = z.object({
  id: IdSchema,
  name: z.string(),
  purpose: z.string(),
  primaryAction: z.string().optional(),
  states: z.array(z.string()).default([]),
});

export const UXFlowSchema = z.object({
  id: IdSchema,
  name: z.string(),
  steps: z.array(z.string()).default([]),
  screenIds: z.array(IdSchema).default([]),
});

export const DataPointSchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: z.string(), // free-form: "string", "uuid", "decimal(12,2)", etc.
  description: z.string().optional(),
  pii: z.boolean().default(false),
  // Required when pii=true. Linter (Phase 3) treats missing handlingNote as a
  // non-waivable block. Schema does NOT enforce here; we want the linter to
  // be the surface that explains the policy.
  handlingNote: z.string().optional(),
});

export const IntegrationSchema = z.object({
  id: IdSchema,
  name: z.string(),
  purpose: z.string(),
  authMode: z.string().optional(),
});

export const APIContractSchema = z.object({
  id: IdSchema,
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  description: z.string().optional(),
  requestSchema: z.string().optional(),
  responseSchema: z.string().optional(),
  featureIds: z.array(IdSchema).default([]),
});

export const TestSchema = z.object({
  id: IdSchema,
  description: z.string(),
  needIds: z.array(IdSchema).default([]),
  featureIds: z.array(IdSchema).default([]),
  kind: z.enum(["acceptance", "smoke", "unit", "manual"]).default("acceptance"),
  // Free-form framework name. Phase 3 linter pattern-matches per platformTarget:
  //   web|vite-spa  → /vitest|jest|playwright/i
  //   ios|macos     → /xctest|swift testing/i
  //   claude-plugin → /plugin-builder|manifest-validator|skill-validator|hook-validator|command-validator/i
  // Empty string → linter blocker (waivable).
  testFramework: z.string().default(""),
  // Optional validator references — used primarily by claude-plugin platform target where each
  // command/skill/hook artifact must point at a validator (manifest-validator, skill-validator, etc.).
  validatorRefs: z.array(z.string()).default([]),
});

export const ADRSchema = z.object({
  id: IdSchema,
  title: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.string().optional(),
  reversibility: Reversibility,
  // Cites tradeoff weights and stance "because" clauses (Phase 4).
  cites: z.array(z.string()).default([]),
});

export const AssumptionSchema = z.object({
  id: IdSchema,
  text: z.string(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const RiskSchema = z.object({
  id: IdSchema,
  text: z.string(),
  likelihood: z.enum(["high", "medium", "low"]).default("medium"),
  impact: z.enum(["high", "medium", "low"]).default("medium"),
  mitigation: z.string().optional(),
});

// Agent systems need a harness spec, not only app requirements. These schemas
// capture the Agent Builder / Prompt Builder primitives ProductPilot needs to
// ask about and hand off: autonomy, topology, tool permissions, memory,
// guardrails, research evidence, UI archetype, and eval coverage.
export const AgentArchitecturePatternSchema = z.enum([
  "single-agent",
  "sequential",
  "router",
  "orchestrator-worker",
  "evaluator-optimizer",
  "interactive",
  "multi-agent",
  "hybrid",
]);

export const AgentAutonomyLevelSchema = z.enum([
  "draft-only",
  "human-in-loop",
  "supervised",
  "autonomous",
]);

export const AgentBuilderScaleSchema = z.enum(["skill", "plugin", "agent", "human"]);

export const AgentToolPermissionTierSchema = z.enum(["T0", "T1", "T2", "T3", "T4", "T5"]);

export const AgentToolContractSchema = z.object({
  id: IdSchema,
  name: z.string(),
  purpose: z.string(),
  permissionTier: AgentToolPermissionTierSchema.default("T1"),
  allowedActions: z.array(z.string()).default([]),
  forbiddenActions: z.array(z.string()).default([]),
  dataAccess: z.string().optional(),
  sideEffects: z.array(z.string()).default([]),
  requiresHumanApproval: z.boolean().default(false),
  auditLog: z.string().optional(),
  rollbackPlan: z.string().optional(),
  failureMode: z.string().optional(),
});

export const AgentModelRouteSchema = z.object({
  id: IdSchema,
  purpose: z.string(),
  provider: z.string().optional(),
  modelTier: z.string().optional(),
  promptContract: z.string().optional(),
});

export const AgentGuardrailSchema = z.object({
  id: IdSchema,
  appliesTo: z.array(z.string()).default([]),
  trigger: z.string(),
  check: z.string(),
  action: z.string(),
  severity: Severity.default("warn"),
  escalation: z.string().optional(),
});

export const AgentEvaluationSchema = z.object({
  id: IdSchema,
  name: z.string(),
  metric: z.string(),
  coverageRefs: z.array(IdSchema).default([]),
  blocking: z.boolean().default(false),
});

export const AgentResearchProtocolSchema = z.object({
  sourcePolicy: z.string().optional(),
  evidenceStandard: z.string().optional(),
  confidencePolicy: z.string().optional(),
  citationRequired: z.boolean().default(false),
  evidenceRefs: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const AgentUiProtocolSchema = z.object({
  archetype: z.enum([
    "ai-agent-chat",
    "editor-workbench",
    "data-research-tool",
    "saas-dashboard",
    "internal-admin",
    "content-publication",
    "commerce-checkout",
  ]).optional(),
  designMode: z.string().optional(),
  userResearchQuestions: z.array(z.string()).default([]),
  highRiskFailures: z.array(z.string()).default([]),
});

export const AgentSystemSchema = z.object({
  mission: z.string().optional(),
  systemBoundary: z.object({
    inScope: z.array(z.string()).default([]),
    outOfScope: z.array(z.string()).default([]),
  }).default({ inScope: [], outOfScope: [] }),
  builderScale: AgentBuilderScaleSchema.optional(),
  architecturePattern: AgentArchitecturePatternSchema.optional(),
  autonomyLevel: AgentAutonomyLevelSchema.optional(),
  stateOwner: z.string().optional(),
  stopCondition: z.string().optional(),
  modelRoutes: z.array(AgentModelRouteSchema).default([]),
  toolContracts: z.array(AgentToolContractSchema).default([]),
  memoryPolicy: z.string().optional(),
  researchProtocol: AgentResearchProtocolSchema.optional(),
  uiProtocol: AgentUiProtocolSchema.optional(),
  guardrails: z.array(AgentGuardrailSchema).default([]),
  evaluations: z.array(AgentEvaluationSchema).default([]),
  humanCheckpoints: z.array(z.string()).default([]),
  traceabilityRefs: z.array(z.string()).default([]),
});

// Stance "because" clause from PRD-Builder Q3.
// Captures the qualitative judgment that complements numeric tradeoffWeights.
// Both feed Phase 4 architecture prompt; weights drive priority, "because" drives philosophy.
export const StanceBecauseClauseSchema = z.object({
  id: IdSchema,
  category: z.enum(["privacy_data", "complexity", "cost", "category"]),
  stance: z.string(), // "we will not store any user audio on our servers"
  because: z.string(), // "because this is healthcare-adjacent and trust is the moat"
});

// pivotLog — strategic-decision history that survives messages.version regenerations.
// Phase 2 writes here when the user answers a Q3-style question that contradicts
// an earlier answer; Phase 3 linter flags inconsistencies between latest stance
// and earlier features.
export const PivotLogEntrySchema = z.object({
  id: IdSchema,
  at: z.string(), // ISO date
  summary: z.string(),
  reason: z.string().optional(),
  affects: z.array(z.string()).default([]), // ids of needs/features the pivot touches
});

// The six tradeoff axes a Phase 4 allocation distributes 100 points across.
// Exported so UI, route handlers, and linter tests share one canonical list.
export const TRADEOFF_AXES = [
  "speed_to_alpha",
  "scalability",
  "ux_polish",
  "maintainability",
  "cost",
  "security",
] as const;
export type TradeoffAxis = typeof TRADEOFF_AXES[number];

// Phase 4 — 100-point allocation across the six axes plus one "unacceptable
// tradeoff" choice. The sum===100 invariant is enforced server-side via the
// .refine block below; UI also enforces it on submit. `unacceptable_tradeoff`
// is required so the architecture stage can cite both the priority weights AND
// the axis the user explicitly refuses to compromise on.
//
// Backwards-compat note: existing rows persisted in Phase 1 with all-zero
// weights and no `unacceptable_tradeoff` field continue to validate as long as
// the row is consumed via the OPTIONAL parent ProductState.tradeoffWeights —
// when present, the refine fires; when absent (undefined), no refine runs.
export const TradeoffWeightsSchema = z
  .object({
    speed_to_alpha: z.number().int().min(0).max(100),
    scalability: z.number().int().min(0).max(100),
    ux_polish: z.number().int().min(0).max(100),
    maintainability: z.number().int().min(0).max(100),
    cost: z.number().int().min(0).max(100),
    security: z.number().int().min(0).max(100),
    unacceptable_tradeoff: z.enum(TRADEOFF_AXES),
  })
  .refine(
    (w) =>
      w.speed_to_alpha +
        w.scalability +
        w.ux_polish +
        w.maintainability +
        w.cost +
        w.security ===
      100,
    {
      message:
        "Tradeoff weights must sum to exactly 100 across the six axes.",
      path: ["__sum"],
    },
  );

// ProductState — per-project working memory used by the intake controller and
// every doc-generation prompt. Stored on projects.product_state (jsonb).
//
// Phase 1 lays out the shape but only persists fields the renderer needs;
// Phase 2 fills in tradeoffWeights, methodLog, etc.
export const ProductStateSchema = z.object({
  version: z.number().int().default(1),
  // PRD-Builder additions (cross-cutting requirements section of the plan).
  stanceBecauseClauses: z.array(StanceBecauseClauseSchema).default([]),
  pivotLog: z.array(PivotLogEntrySchema).default([]),
  // Tradeoff weights — Phase 4 collects these explicitly. NULL on existing rows
  // is fine; default is all-zero which is a safe "uncalibrated" state.
  tradeoffWeights: TradeoffWeightsSchema.optional(),
  // Free-form working memory the controller writes during intake. Phase 2 owns
  // the schema. Marked passthrough so Phase 1 can hydrate from existing
  // intakeAnswers/minimumDetails without losing keys we don't yet model.
  workingMemory: z.record(z.string(), z.any()).default({}),
  // In-progress agent-system harness captured by adaptive intake. Final specs
  // project this into Spec.agentSystem when the product is an agent, plugin, or
  // tool-using AI workflow.
  agentProfile: AgentSystemSchema.optional(),
});

export const NonGoalSchema = z.object({
  id: IdSchema,
  text: z.string(),
  // Required by PRD-Builder: every non-goal carries a "because" clause.
  // Phase 3 linter blocks empty `because` (waivable with reason).
  because: z.string().default(""),
});

// OpenQuestion — typed contract for inline-answer affordances on generated
// docs. Defect #1. Stored in productState.workingMemory.openQuestions[] so
// no Drizzle migration is needed; LLM doc-generation prompts emit an HTML-
// comment trailer with structured questions that the server parses and
// merges; the UI renders text or chip-group inputs depending on answerKind.
// `feedsField` is a free-form dotted-path pointer (e.g. "architecture.persistence")
// so downstream regeneration can act on the answer.
export const OpenQuestionKind = z.enum(["text", "choice"]);
export const OpenQuestionSchema = z.object({
  topicId: z.string().min(1),
  prompt: z.string().min(1).max(500),
  stageId: z.string().optional(),
  stageNumber: z.number().int().optional(),
  answerKind: OpenQuestionKind.default("text"),
  answerChips: z.array(z.string().min(1).max(120)).max(8).optional(),
  feedsField: z.string().optional(),
  answeredValue: z.string().max(500).optional(),
  answeredAt: z.string().optional(),
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

// PlatformTarget — declared per-spec so the Phase 3 linter can apply
// platform-appropriate test-framework rules. Default 'web' for backward
// compatibility with specs authored before the field landed.
//   web           → server-rendered or full-stack web (Vitest/Jest/Playwright).
//   vite-spa      → static-served single-page app (Vitest preferred, Playwright OK).
//   ios           → Apple iOS native (XCTest or Swift Testing).
//   macos         → Apple macOS native (XCTest or Swift Testing).
//   claude-plugin → Claude Code plugin (plugin-builder validators reference manifest/skill/hook/command schemas).
//   agent-system  → Tool-using agent, workflow agent, or multi-agent harness.
export const PlatformTargetSchema = z.enum([
  "web",
  "vite-spa",
  "ios",
  "macos",
  "claude-plugin",
  "agent-system",
]);

// Spec — the source-of-truth structured document. Doc generation emits this
// first, the renderer produces stage-specific Markdown second.
export const SpecSchema = z.object({
  id: IdSchema,
  productName: z.string(),
  productDescription: z.string(),
  // Phase 3 (cross-platform) — drives platform-specific lint rules. Defaults
  // to 'web' so specs created before the field existed continue to validate.
  platformTarget: PlatformTargetSchema.default("web"),
  personas: z.array(PersonaSchema).default([]),
  scenarios: z.array(ScenarioSchema).default([]),
  needs: z.array(NeedSchema).default([]),
  features: z.array(FeatureSchema).default([]),
  uxFlows: z.array(UXFlowSchema).default([]),
  screens: z.array(ScreenSchema).default([]),
  dataPoints: z.array(DataPointSchema).default([]),
  integrations: z.array(IntegrationSchema).default([]),
  apiContracts: z.array(APIContractSchema).default([]),
  tests: z.array(TestSchema).default([]),
  adrs: z.array(ADRSchema).default([]),
  assumptions: z.array(AssumptionSchema).default([]),
  risks: z.array(RiskSchema).default([]),
  nonGoals: z.array(NonGoalSchema).default([]),
  agentSystem: AgentSystemSchema.optional(),
});

// LintIssue — Phase 3 emits a list of these from spec-linter.ts. Severity ladder:
// `block` halts export, `warn` is a soft nudge, `info` is observational.
export const LintIssueSchema = z.object({
  id: IdSchema,
  rule: z.string(),
  severity: Severity,
  // Non-waivable blockers (PII without handlingNote) set this to false.
  waivable: z.boolean().default(true),
  message: z.string(),
  // Pointers back into the Spec graph.
  refs: z.array(z.object({
    kind: z.enum([
      "need", "feature", "persona", "scenario", "uxflow", "screen",
      "datapoint", "integration", "api", "test", "adr", "assumption",
      "risk", "non_goal", "stance", "agent",
    ]),
    id: IdSchema,
  })).default([]),
});

// TraceMatrix — derived index. Phase 3 computes & writes to projects.trace_matrix.
// Stored materialized so the linter and handoff export don't recompute on every read.
export const TraceMatrixSchema = z.object({
  // need_id → feature_ids
  needToFeatures: z.record(z.string(), z.array(IdSchema)).default({}),
  // need_id → test_ids
  needToTests: z.record(z.string(), z.array(IdSchema)).default({}),
  // feature_id → api_ids
  featureToApis: z.record(z.string(), z.array(IdSchema)).default({}),
  // adr_id → need_ids/feature_ids it justifies
  adrToTargets: z.record(z.string(), z.array(IdSchema)).default({}),
});

export type Need = z.infer<typeof NeedSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type UXFlow = z.infer<typeof UXFlowSchema>;
export type DataPoint = z.infer<typeof DataPointSchema>;
export type Integration = z.infer<typeof IntegrationSchema>;
export type APIContract = z.infer<typeof APIContractSchema>;
export type Test = z.infer<typeof TestSchema>;
export type ADR = z.infer<typeof ADRSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type AgentArchitecturePattern = z.infer<typeof AgentArchitecturePatternSchema>;
export type AgentAutonomyLevel = z.infer<typeof AgentAutonomyLevelSchema>;
export type AgentBuilderScale = z.infer<typeof AgentBuilderScaleSchema>;
export type AgentToolPermissionTier = z.infer<typeof AgentToolPermissionTierSchema>;
export type AgentToolContract = z.infer<typeof AgentToolContractSchema>;
export type AgentModelRoute = z.infer<typeof AgentModelRouteSchema>;
export type AgentGuardrail = z.infer<typeof AgentGuardrailSchema>;
export type AgentEvaluation = z.infer<typeof AgentEvaluationSchema>;
export type AgentResearchProtocol = z.infer<typeof AgentResearchProtocolSchema>;
export type AgentUiProtocol = z.infer<typeof AgentUiProtocolSchema>;
export type AgentSystem = z.infer<typeof AgentSystemSchema>;
export type StanceBecauseClause = z.infer<typeof StanceBecauseClauseSchema>;
export type PivotLogEntry = z.infer<typeof PivotLogEntrySchema>;
export type TradeoffWeights = z.infer<typeof TradeoffWeightsSchema>;
export type ProductState = z.infer<typeof ProductStateSchema>;
export type NonGoal = z.infer<typeof NonGoalSchema>;
export type PlatformTarget = z.infer<typeof PlatformTargetSchema>;
export type Spec = z.infer<typeof SpecSchema>;
export type LintIssue = z.infer<typeof LintIssueSchema>;
export type TraceMatrix = z.infer<typeof TraceMatrixSchema>;
