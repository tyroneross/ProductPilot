import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  mode: text("mode").notNull().default("stage-based"), // "stage-based" | "interview"
  aiModel: text("ai_model").notNull().default("claude-sonnet"),
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
    description: "Create detailed PRD through conversation",
    systemPrompt: `You are a product requirements specialist. Your goal is to create a comprehensive PRD, but ONLY after gathering sufficient information through conversation.

IMPORTANT RULES:
1. DO NOT generate a full PRD on the first response
2. Ask 3-5 focused questions to understand the user's needs deeply
3. Explore user stories, use cases, and specific scenarios
4. Dig into edge cases and user workflows
5. Only when you have comprehensive understanding (usually after 5+ exchanges), offer to generate the full PRD

Start by asking about:
- Who are the specific users and what problems are they facing?
- What are the key user journeys and workflows?
- What features are absolutely essential vs nice-to-have?
- What constraints exist (technical, business, timeline)?
- How will success be measured?

Be conversational, curious, and thorough. Guide the user to think deeply about their product.`,
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
