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
  userId: varchar("user_id"), // Optional: linked user for session persistence
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
  uploadedDocs: jsonb("uploaded_docs"), // User-uploaded guidance docs (array of { name, content })
  catSurvey: jsonb("cat_survey"), // CAT-generated survey definition
  catResponses: jsonb("cat_responses"), // User's CAT survey answers
  entryMode: text("entry_mode").default("idea"), // "idea" | "problem" | "upload"
  solutionApproach: jsonb("solution_approach"), // Selected approach for Entry B
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stages = pgTable("stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stageNumber: integer("stage_number").notNull(), // 1-7
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
  userId: true,
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
  uploadedDocs: true,
  catSurvey: true,
  catResponses: true,
  entryMode: true,
  solutionApproach: true,
});

// ============================================
// CAT (Computerized Adaptive Testing) Types
// ============================================

// The 10 information dimensions that CAT scores for completeness
export const CAT_DIMENSIONS = [
  "WHO",      // Users & personas
  "WHY",      // Problem clarity
  "WHAT",     // Feature scope
  "HOW",      // User workflow
  "LOOK",     // Visual style
  "WHERE",    // Platform details
  "HOW_BIG",  // Scale & performance
  "WITH_WHAT",// Tech constraints
  "DATA",     // Data model complexity
  "MEASURE",  // Success metrics
] as const;

export type CATDimension = typeof CAT_DIMENSIONS[number];

export const CATQuestionSchema = z.object({
  id: z.string(),
  dimension: z.enum(CAT_DIMENSIONS),
  type: z.enum(["slider", "single-select", "multi-select", "free-text", "visual-select"]),
  label: z.string(),
  description: z.string().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
});

export const CATSurveySchema = z.object({
  dimensionScores: z.record(z.enum(CAT_DIMENSIONS), z.number()), // 0-1 per dimension
  questions: z.array(CATQuestionSchema),
  reasoning: z.string().optional(), // AI's explanation of why these questions were chosen
});

export const CATResponseSchema = z.record(z.string(), z.union([
  z.number(),
  z.string(),
  z.array(z.string()),
]));

export type CATQuestion = z.infer<typeof CATQuestionSchema>;
export type CATSurvey = z.infer<typeof CATSurveySchema>;
export type CATResponse = z.infer<typeof CATResponseSchema>;

// Solution approach card for Entry B ("I have a problem")
export const SolutionApproachSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  keyFeatures: z.array(z.string()),
  techDirection: z.string().optional(),
});

export const SolutionProposalSchema = z.object({
  problemSummary: z.string(),
  approaches: z.array(SolutionApproachSchema),
});

export type SolutionApproach = z.infer<typeof SolutionApproachSchema>;
export type SolutionProposal = z.infer<typeof SolutionProposalSchema>;

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
    docGenPrompt: `You are a senior product manager. Generate a comprehensive Requirements Definition document based on all the product context provided.

Structure your output as:

## Target Users & Personas
Identify 2-3 distinct user types. For each: who they are, what they need, their pain points.

## Problem Statement
The core problem being solved, who has it, and the cost of not solving it.

## Use Cases (Prioritized)
Numbered list of primary use cases. Each: actor, action, outcome. Mark as Must-Have / Should-Have / Nice-to-Have.

## MVP Scope
What's IN v1 (with brief justification) and what's explicitly OUT of v1.

## Success Metrics
3-5 measurable metrics tied to the product goals. Include targets where possible.

## Technical Constraints
Known constraints from user input. If none specified, note "No constraints specified — architecture stage will propose defaults."

## Assumptions & Risks
Key assumptions made. Risks to the project with mitigation strategies.

RULES:
- Be specific to THIS product — reference actual features and users from the context
- Don't invent features the user didn't describe
- Don't ask questions — generate the complete document
- Keep language clear and jargon-free`,
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
    docGenPrompt: `You are a product manager. Generate a complete Product Requirements Document based on all the product context provided.

Structure your output as:

## Executive Summary
2-3 paragraph overview: what it is, who it's for, why it matters.

## User Stories
Write as "As a [user type], I want [action] so that [benefit]."
Group by feature area. Include 8-15 stories covering all V1 features.

## Feature Requirements
For each feature:
### [Feature Name]
- **Priority:** Must-Have / Should-Have / Could-Have
- **Description:** What it does
- **Acceptance Criteria:** Specific, testable conditions
- **Edge Cases:** What could go wrong

## User Flows
Step-by-step for each key workflow. Number each step.
Include: entry point → actions → decision points → completion.

## Non-Functional Requirements
Performance, security, accessibility, scalability expectations.

## Dependencies & Risks
What could block progress. External services, data sources, regulatory concerns.

## Out of Scope
Features explicitly deferred to post-v1.

RULES:
- Write user stories for ACTUAL features described in the product context
- Don't invent features — only document what the user described
- Don't ask questions — generate the complete PRD
- Be specific: use actual feature names, user types, and workflows from the context`,
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
    docGenPrompt: `You are a UI/UX designer. Generate a comprehensive UI specification with wireframes for this product.

## Design Direction
Based on the user's style preference (if provided in context), define:
- Color palette (primary, secondary, accent, background, text colors)
- Typography approach (font family suggestions, heading/body/metadata sizes)
- Layout style (rounded vs sharp corners, spacing density, visual weight)
- Overall feel (reference 2-3 existing products as inspiration)

If no style preference was given, use a Clean & Professional style (like Linear/Notion).

## Screen Inventory
List every screen/page needed for V1, grouped by user flow.

## Screen Specifications
For EACH screen:

### [Screen Name]
- **Purpose:** What the user accomplishes here
- **Layout:** Describe the layout structure (header, sidebar, main content, etc.)
- **Key Elements:** List every interactive element (buttons, inputs, lists, cards)
- **States:** Empty state, loading state, populated state, error state
- **User Actions:** What happens when the user interacts with each element

## Navigation Map
How all screens connect. Entry points, exit points, back navigation.

## Component Library
Reusable components identified across screens (cards, buttons, forms, modals).

## Responsive Behavior
How layouts adapt for different screen sizes (if web/responsive platform).

## HTML Wireframes
For the 3-4 most important screens, generate simple HTML wireframes using:
- Inline CSS matching the design direction colors
- Semantic HTML (header, nav, main, section, footer)
- Placeholder content that matches the actual product domain
- Comments explaining each section

RULES:
- Reference ACTUAL features and flows from the product context
- Don't wireframe features not in V1 scope
- Don't ask questions — generate the complete UI spec
- For mobile apps: describe layouts instead of generating HTML
- For desktop/local apps: describe layouts with desktop-specific patterns (title bar, sidebar, system tray)`,
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

CRITICAL - ASSUMPTIONS TRANSPARENCY:
For EVERY architecture decision, you MUST include an explicit assumptions block using this exact format:

### Decision: [What you decided]
- **Assumption:** [What must be true for this to be the right choice]
- **If wrong:** [Alternative approach if the assumption doesn't hold]
- **Confidence:** [High | Medium | Low] — [brief reason based on user's input]
- **Override:** [How the user can change this in their project rules]

Examples:
### Decision: Use PostgreSQL with Drizzle ORM
- **Assumption:** Data is relational with 3+ entity types and needs referential integrity
- **If wrong:** Use SQLite for simple/local data, or MongoDB for document-heavy schemas
- **Confidence:** High — user described linked entities (users, projects, tasks)
- **Override:** Change DB in project rules file and update schema definitions

### Decision: Deploy on Vercel with serverless functions
- **Assumption:** Traffic is bursty, team is small, wants zero-ops
- **If wrong:** Use Railway or Fly.io for persistent servers if need WebSockets or background jobs
- **Confidence:** Medium — user didn't specify deployment preferences
- **Override:** Set deployment target in project rules file

This makes every decision transparent, auditable, and overridable. Do NOT skip this format for any decision.

PLATFORM-SPECIFIC GUIDANCE:
- If platform is "desktop" or "local": Recommend local-first architecture (SQLite or embedded DB, desktop framework like Electron/Tauri, encryption at rest, optional sync via CRDTs or simple export/import). Do NOT suggest cloud databases or server deployments unless the user specifically mentioned them.
- If platform is "mobile": Consider React Native, Flutter, or native. Account for offline-first, push notifications, app store requirements.
- If platform is "api" or "backend": Focus on API design (REST/GraphQL), rate limiting, auth (API keys/OAuth), documentation (OpenAPI spec).
- If platform is "web": Standard web architecture (SSR vs SPA trade-offs, CDN, hosting).
- If platform is "both" (web + mobile): Consider shared backend, responsive design vs native apps, API-first architecture.`,
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
    systemPrompt: `You are an expert in AI-assisted development. Generate a structured set of implementation prompts that a developer can feed to their AI coding tool (Claude Code, Cursor, Copilot, etc.) to build this product step by step.

Each prompt should be self-contained, specific, and copy-pasteable into an AI coding tool.

Structure your output as a numbered task list:

## Phase 1: Setup & Scaffolding
Prompts for project initialization, folder structure, dependency installation, and configuration.
Include exact commands (npm/pnpm/bun init, framework setup, etc.)

## Phase 2: Data Layer
Prompts for database schema, data models, ORM setup, and data access patterns.
Include specific table/collection definitions based on the architecture.

## Phase 3: Core Features
One prompt per feature. Each prompt includes:
- What to build (specific component/endpoint/page)
- Which files to create or modify
- Input/output behavior
- Acceptance criteria (what "done" looks like)
- Edge cases to handle

## Phase 4: Authentication & Security
Prompts for auth setup, route protection, input validation, and security headers.
Skip if not applicable to this product.

## Phase 5: Testing
Prompts for writing tests for each major feature.
Include: which test framework, what to test, expected test count.

## Phase 6: Deployment
Prompts for deployment configuration, environment variables, CI/CD, and monitoring setup.

RULES:
- Reference SPECIFIC file paths, component names, and API endpoints from the architecture stage
- Include the tech stack in each prompt so the AI tool has context
- Order matters: earlier prompts create foundations for later ones
- Each prompt should produce working code, not placeholder comments
- Aim for 12-20 prompts total covering the full V1 scope`,
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
    systemPrompt: `You are a development project manager. Create a step-by-step implementation playbook that a developer can follow to build this product.

Structure your output EXACTLY as:

## Phase 1: Foundation (Week 1)
### Tasks
- [ ] Task: [specific action with files, commands, and expected outcome]
(list all foundation tasks)
### Definition of Done
[What must be true before moving to Phase 2]

## Phase 2: Core Features (Week 2-3)
### Tasks
- [ ] Task: [specific action]
(one task per feature from the coding prompts stage)
### Definition of Done

## Phase 3: Integration & Polish (Week 3-4)
### Tasks
- [ ] Task: [connecting features, error handling, edge cases]
### Definition of Done

## Phase 4: Testing & QA (Week 4)
### Tasks
- [ ] Unit tests for [specific components]
- [ ] Integration tests for [specific flows]
- [ ] Manual QA checklist:
  - [ ] [Critical path 1]
  - [ ] [Critical path 2]
### Definition of Done

## Phase 5: Deployment (Week 4-5)
### Tasks
- [ ] Environment setup (dev, staging, production)
- [ ] CI/CD pipeline configuration
- [ ] DNS and domain setup
- [ ] Monitoring and error tracking
### Launch Checklist
- [ ] [Pre-launch item]

## Environment Setup
Exact commands to set up local development environment from scratch.

## Tech Stack Reference
Quick reference of all technologies, versions, and their roles in this project.

RULES:
- Reference ACTUAL architecture decisions from previous stages
- Include ACTUAL file paths and component names
- Every task should be specific enough that a developer knows exactly what to do
- Include estimated effort (small/medium/large) per task
- Don't include tasks for features not in V1 scope`,
    isUnlocked: true,
    keyInsights: [
      "Development phases defined",
      "Task breakdown completed",
      "QA checklist created",
      "Deployment strategy ready",
      "Maintenance plan established"
    ],
  },
  {
    stageNumber: 7,
    title: "Project Rules File",
    description: "Generate IDE/LLM constitution files for coding handoff",
    systemPrompt: `You are an expert in AI-assisted development workflows. Generate project rules files that serve as the "constitution" for LLM coding tools.

You will receive the outputs from all 6 previous stages. Synthesize them into concise, actionable rules files.

Generate output in the following sections, clearly separated by headers:

## CLAUDE.md
Generate a CLAUDE.md file (<60 lines) following progressive disclosure. Include:
- Project name + one-liner purpose
- Tech stack (framework, DB, ORM, deployment)
- File/folder structure plan
- Key coding conventions (naming, patterns, testing approach)
- Build/test/deploy commands
- Critical domain rules and edge cases
- "Do NOT" list (common LLM mistakes for this project type)

## CURSORRULES
Generate .cursor/rules content in MDC format with frontmatter. Same core content adapted for Cursor's format.

## WINDSURFRULES
Generate .windsurfrules content. Same core content adapted for Windsurf's format.

## AGENTS.md
Generate AGENTS.md for OpenAI Codex / ChatGPT coding. Include the same project context in OpenAI's expected format.

## PROJECT_RULES.md
Generate a generic PROJECT_RULES.md that works with any LLM tool. This is the universal fallback.

GUIDELINES:
- Keep each file under 60 lines where possible (80 max)
- Be specific to THIS project, not generic advice
- Reference actual file paths, component names, and API endpoints from previous stages
- Include the "Do NOT" list: common mistakes LLMs make for this type of project
- Coding conventions should match the chosen tech stack (e.g., React conventions for React projects)
- Include actual commands, not placeholders (e.g., "npm run dev" not "run the dev server")`,
    isUnlocked: true,
    keyInsights: [
      "CLAUDE.md generated",
      "Cursor rules generated",
      "Windsurf rules generated",
      "OpenAI/Codex AGENTS.md generated",
      "Generic PROJECT_RULES.md generated"
    ],
  },
];

// Interceptor prompts - behavior modifiers that override or enhance AI responses
// These are separate from stage prompts as they modify runtime behavior
export const INTERCEPTOR_PROMPTS = [
  {
    id: "interceptor_prd_early_doc",
    scope: "interceptor",
    targetKey: "prd_early_document_prevention",
    label: "PRD Early Document Prevention",
    description: "Forces the AI to ask questions instead of generating a PRD document when user hasn't provided enough context (fewer than 6 messages)",
    systemPrompt: "You are an interviewer. Ask 2-3 brief questions. No documents. No headers. Just questions.",
    userPromptTemplate: `The user said: "{{USER_MESSAGE}}". 

You MUST respond with ONLY 2-3 simple questions to learn more. Do NOT generate any document, sections, or headers.

Just ask questions like:
1. [Question about who will use this]
2. [Question about key features]
3. [Question about constraints]

Keep it conversational and brief.`,
    triggerCondition: "stage === 2 && userMessageCount < 6 && (responseHasDocumentStructure || responseLength > 800)",
    isEnabled: true,
  },
  {
    id: "interceptor_ui_wireframe_enforce",
    scope: "interceptor",
    targetKey: "ui_wireframe_html_enforcement",
    label: "UI Wireframe HTML Enforcement",
    description: "Ensures the UI Design stage generates actual HTML wireframes with orange color scheme when the response doesn't contain HTML",
    systemPrompt: "You are a UI designer. Generate complete HTML wireframes with inline CSS. Always use orange color schemes. Return code in ```html blocks.",
    userPromptTemplate: `Create a simple HTML wireframe for: "{{USER_MESSAGE}}". 

You MUST respond with actual HTML code wrapped in \`\`\`html code blocks. Use an orange color scheme (#FF6B35 for primary elements, #FFA500 for accents).

Include a complete HTML document with basic styling. Keep it simple but functional.`,
    triggerCondition: "stage === 3 && !responseHasHTML",
    isEnabled: true,
  },
  {
    id: "interceptor_survey_generation",
    scope: "interceptor",
    targetKey: "survey_generation_system",
    label: "Survey Generation System Prompt",
    description: "System prompt used when generating dynamic survey questions based on product description",
    systemPrompt: "You are a product requirements expert. Generate surveys that efficiently capture high-value information using sliders and select inputs. Always return valid JSON.",
    userPromptTemplate: null, // Complex template defined in routes.ts
    triggerCondition: "endpoint === '/api/projects/:projectId/generate-survey'",
    isEnabled: true,
  },
];
