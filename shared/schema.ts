import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  aiModel: text("ai_model").notNull().default("claude-sonnet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stages = pgTable("stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stageNumber: integer("stage_number").notNull(), // 1-5
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
  aiModel: true,
});

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
    description: "Create detailed PRD document",
    systemPrompt: `You are a product requirements specialist. Help create a comprehensive PRD including:

1. Executive summary
2. User stories and acceptance criteria
3. Feature prioritization
4. Technical requirements
5. Success metrics and KPIs

Structure the output as a professional PRD document.`,
    isUnlocked: true,
    keyInsights: [
      "Executive summary written",
      "User stories with acceptance criteria",
      "Feature prioritization matrix",
      "Technical requirements specified",
      "KPIs and success metrics defined"
    ],
  },
  {
    stageNumber: 3,
    title: "System Architecture",
    description: "Design technical architecture",
    systemPrompt: `You are a senior software architect. Design comprehensive system architecture including:

1. System components and services
2. Data flow and architecture diagrams
3. Technology stack recommendations
4. Scalability considerations
5. Security architecture

Provide detailed technical specifications and architectural decisions.`,
    isUnlocked: true,
    keyInsights: [
      "System components defined",
      "Data flow architecture designed",
      "Technology stack selected",
      "Scalability strategy planned",
      "Security architecture specified"
    ],
  },
  {
    stageNumber: 4,
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
    stageNumber: 5,
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
