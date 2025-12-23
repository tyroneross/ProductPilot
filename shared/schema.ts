import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models for Replit Auth integration
export * from "./models/auth";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

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
  type: z.enum(["slider", "single-select", "multi-select"]),
  options: z.array(z.string()).optional(), // For select types
  min: z.number().optional(), // For slider
  max: z.number().optional(), // For slider
  minLabel: z.string().optional(), // For slider
  maxLabel: z.string().optional(), // For slider
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
export const DEFAULT_STAGES = [
  {
    stageNumber: 1,
    title: "Requirements Definition",
    description: "Define project scope and user needs",
    systemPrompt: `You are a senior product manager helping to define comprehensive requirements. Guide users through:

1. User personas and use cases
2. Core functionality mapping
3. Technical constraints
4. Success metrics
5. MVP scope definition

Ask clarifying questions and ensure all critical aspects are covered before moving to PRD stage.`,
    isUnlocked: true,
    keyInsights: [
      "Target user personas identified",
      "Core use cases defined",
      "MVP scope clearly outlined",
      "Success metrics established",
      "Technical constraints documented"
    ],
  },
  {
    stageNumber: 2,
    title: "Product Requirements",
    description: "Create detailed PRD through conversation",
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
    isUnlocked: true,
    keyInsights: [
      "User stories and personas explored in depth",
      "Key workflows and journeys mapped",
      "Feature prioritization discussed",
      "Success metrics and KPIs defined",
      "Full PRD document generated"
    ],
  },
  {
    stageNumber: 3,
    title: "UI Design & Wireframes",
    description: "Generate simple wireframe mockups",
    systemPrompt: `You are a UI/UX designer specializing in creating simple, functional wireframes. Your task is to generate HTML wireframes based on the product requirements.

WIREFRAME GENERATION RULES:
1. Create simple, clean HTML wireframes using basic tags
2. Use inline styles with an orange color scheme (#FF6B35 for primary, #FFA500 for accents)
3. Focus on layout, navigation, and key UI elements
4. Include placeholders for text, images, and interactive elements
5. Keep it simple - this is a wireframe, not a full design
6. Use semantic HTML (header, nav, main, section, footer)
7. Add comments to explain sections

Ask the user about:
- Which pages/screens should be wireframed?
- What are the key user interactions?
- Are there specific UI patterns they prefer?
- What devices should be considered?

Generate clean, viewable HTML that demonstrates the UI structure.`,
    aiModel: "claude-haiku",
    isUnlocked: true,
    keyInsights: [
      "Key screens and pages identified",
      "Navigation structure defined",
      "User interaction flows mapped",
      "Wireframes generated for main views",
      "UI dependencies documented for architecture"
    ],
  },
  {
    stageNumber: 4,
    title: "System Architecture",
    description: "Design technical architecture",
    systemPrompt: `You are a senior software architect. Design comprehensive system architecture including:

1. System components and services
2. Data flow and architecture diagrams
3. Technology stack recommendations
4. Scalability considerations
5. Security architecture

IMPORTANT: Reference the UI wireframes from the previous stage to inform your architecture decisions:
- If there's a search bar, determine what type of search is needed (semantic, keyword, full-text)
- If there's real-time features, plan for WebSockets or polling
- If there's user-generated content, plan storage and moderation
- If there's complex forms, plan validation and data processing

Provide detailed technical specifications and architectural decisions.`,
    isUnlocked: true,
    keyInsights: [
      "System components defined",
      "Data flow architecture designed",
      "Technology stack selected based on UI needs",
      "Scalability strategy planned",
      "Security architecture specified"
    ],
  },
  {
    stageNumber: 5,
    title: "Coding Prompts",
    description: "Generate optimized coding instructions",
    systemPrompt: `You are an expert in agentic IDE tools and prompt engineering. Generate optimized prompts for:

1. Model-specific system instructions
2. Step-by-step implementation guidance
3. Code generation prompts for different components
4. Testing and validation prompts
5. Deployment instructions

Optimize for the selected AI model and agentic IDE workflow.`,
    isUnlocked: true,
    keyInsights: [
      "System instructions optimized",
      "Implementation prompts created",
      "Component-specific prompts",
      "Testing validation prompts",
      "Deployment instructions ready"
    ],
  },
  {
    stageNumber: 6,
    title: "Development Guide",
    description: "Step-by-step implementation guide",
    systemPrompt: `You are a development project manager. Create a comprehensive implementation guide with:

1. Development phases and milestones
2. Task breakdown and dependencies
3. Quality assurance checklist
4. Deployment strategy
5. Monitoring and maintenance plan

Provide actionable steps with clear success criteria.`,
    isUnlocked: true,
    keyInsights: [
      "Development phases defined",
      "Task breakdown completed",
      "QA checklist created",
      "Deployment strategy ready",
      "Maintenance plan established"
    ],
  },
];
