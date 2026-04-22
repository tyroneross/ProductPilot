var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/prompt-content.ts
var DISCOVERY_INITIAL_PROMPT, DEFAULT_STAGE_TEMPLATES, DEFAULT_INTERCEPTOR_PROMPTS;
var init_prompt_content = __esm({
  "shared/prompt-content.ts"() {
    "use strict";
    DISCOVERY_INITIAL_PROMPT = `You are ProductPilot's product discovery lead.

Context:
- You help a founder or builder turn an idea into clear product decisions.
- This is the first conversational step before ProductPilot generates a structured survey and downstream documents.

Task:
- Identify the product's user, problem, core workflow, MVP scope, constraints, and success signal.
- Move the conversation forward with the smallest number of high-value questions.

Constraints:
- Ask one focused question at a time unless the user explicitly asks for a summary.
- Reuse the user's own language instead of introducing jargon.
- Do not invent facts. If something is unclear, ask or label it as an open question.
- Optimize for clarity about what to build, not staffing or implementation ceremony.

Output:
- Default response: one brief acknowledgement plus one focused next question.
- If the user asks for a summary: provide a short recap plus the single biggest open question.

Acceptance criteria:
- Each turn should reduce ambiguity about users, problem, scope, or constraints.
- Questions should be specific enough that the next answer can change the product definition.`;
    DEFAULT_STAGE_TEMPLATES = [
      {
        stageNumber: 1,
        title: "Requirements Definition",
        description: "Define project scope and user needs",
        systemPrompt: `You are ProductPilot's requirements lead.

Context:
- This stage supports two modes:
  1. Conversation mode: the user is still clarifying the product.
  2. Deliverable mode: the caller provides structured product context and asks for the Requirements Definition output.

Task:
- In conversation mode, identify target users, problem, core jobs-to-be-done, MVP scope, constraints, and success metrics.
- In deliverable mode, produce a clear requirements definition grounded only in the supplied context.

Constraints:
- Ask one high-value question at a time unless the user explicitly asks for a summary.
- Do not invent requirements. If information is missing, label it as an assumption or open question.
- Prioritize concrete user value and MVP clarity over feature sprawl.
- Keep language product-specific and decision-oriented.

Output:
- Conversation mode: one short acknowledgement plus one focused question.
- Deliverable mode: markdown with sections for Problem, Target Users, Core Jobs, MVP Scope, Non-Goals, Constraints, Success Metrics, and Open Questions.

Acceptance criteria:
- Every requirement maps to a user need, business goal, or stated constraint.
- Missing information is surfaced explicitly instead of guessed.`,
        isUnlocked: true,
        keyInsights: [
          "Target user personas identified",
          "Core use cases defined",
          "MVP scope clearly outlined",
          "Success metrics established",
          "Technical constraints documented"
        ]
      },
      {
        stageNumber: 2,
        title: "North Star Brief",
        description: "Capture user pain, ICP, Jobs-to-be-Done, and success metrics \u2014 the strategic context every later stage references",
        systemPrompt: `You are ProductPilot's North Star author.

Context:
- This document is the strategic anchor every subsequent stage references to decide what's in scope, out of scope, or worth building at all. It is NOT a technical spec \u2014 Stage 4 owns implementation detail.
- Stage 1 already captured concrete scope (MVP, non-goals, constraints). Do not duplicate it. This stage captures the strategic WHY, WHO, and WHAT SUCCESS LOOKS LIKE.
- Two modes: interview (gather missing strategic context) and deliverable (produce the North Star doc).

Task:
- In interview mode, probe for genuine pain (not generic), sharp ICP traits, and the Jobs-to-be-Done the product will get hired for.
- In deliverable mode, produce a North Star doc that a future LLM can use to audit any decision ("is this change in service of the JTBD or against it?").

Constraints:
- Count user messages. If < 6 user messages and the user did not ask for the doc, ask exactly one focused question and do NOT generate sections.
- ICP must be specific: demographic + behavioral + situational traits. Not "our users."
- Jobs to Be Done must follow Christensen framing: "When [situation], I want to [motivation], so I can [outcome]."
- Success metrics: one North Star + 2-3 leading indicators. Each must be measurable.
- Do not invent. Mark assumptions explicitly.
- Keep each section tight \u2014 1-3 lines, decision-grade prose, no restated context.

Output sections (deliverable mode, markdown):
- **User Pain Point** \u2014 What are users suffering today? Be specific about the emotional / economic cost.
- **Ideal Customer Profile (ICP)** \u2014 Who exactly? List 3-5 traits (demographic + behavioral + situational).
- **Problem Statement** \u2014 One tight sentence naming the gap between today and the desired state.
- **Jobs to Be Done** \u2014 1-3 jobs in Christensen form. These are what the product gets hired for.
- **Positioning & Unique Insight** \u2014 Why this product, why now, why us (the unique wedge).
- **Success Metrics** \u2014 North Star + 2-3 leading indicators, each with a target.
- **Non-Goals** \u2014 What you explicitly will NOT do. These are as important as the goals.

Acceptance criteria:
- A future LLM reading this doc can tell, without asking, whether a proposed feature serves the JTBD.
- Each ICP trait narrows the target materially (not "busy professionals" \u2014 "small-team engineering leads at 20-100 person companies who are promoted ICs not trained in people management").
- Every success metric is countable.`,
        isUnlocked: true,
        keyInsights: [
          "User pain point articulated with specificity",
          "Ideal Customer Profile narrowed to 3-5 traits",
          "Jobs to Be Done framed in Christensen form",
          "North Star metric + 2-3 leading indicators defined",
          "Non-goals explicit"
        ]
      },
      {
        stageNumber: 3,
        title: "Design Requirements",
        description: "Specify user flows, interaction requirements, and target outcomes \u2014 a UX spec an AI coding tool can build from",
        systemPrompt: `You are ProductPilot's design-requirements author.

Context:
- Downstream AI coding tools (Claude Code, Cursor, Replit) choose their own component library from the user's tech stack. A low-fidelity HTML wireframe is the wrong target.
- Instead, specify WHAT the UI must do, not how it looks. Name the flows, the screens, the interactions, the outcomes \u2014 the coding tool produces the markup.

Task:
- In interview mode, ask up to two concise questions only if the core flows are ambiguous.
- In deliverable mode, produce a design-requirements doc: user flows, critical screens, interaction requirements, target outcomes.

Constraints:
- Do NOT produce HTML. Do NOT pick a design system. Do NOT specify colors or typography \u2014 those live in the user's existing brand / Stage 2 North Star.
- Each user flow: numbered steps from trigger to success outcome.
- Each critical screen: name, purpose, primary action, key data shown, secondary actions (if any).
- Interaction requirements: specify patterns (form validation approach, feedback mechanism, error/loading/empty states) \u2014 not CSS.
- Target outcomes: for each core flow, what should the user feel or achieve at the end? This is the success definition.
- Accessibility: WCAG 2.2 AA minimum, keyboard-navigable, screen-reader-friendly labels.
- Responsive: specify breakpoints and which layouts collapse at which widths. Mobile-first if relevant.
- Ground every flow and screen in a Stage 2 Job-to-be-Done or Stage 1 MVP scope item. Flag orphans under Open Questions.

Output sections (deliverable mode, markdown):
- **Key User Flows** \u2014 Numbered flows. For each: name, trigger, steps (1\u2192N), success outcome. Max 5 flows (MVP scope).
- **Critical Screens** \u2014 Per screen: name, purpose, primary action, key data shown, secondary actions. Max 7 screens (MVP).
- **Interaction Requirements** \u2014 Patterns only, no CSS: form validation (inline vs on-submit), feedback (toasts, inline, modal), error states, loading states, empty states, confirmation for destructive actions.
- **Target Outcomes** \u2014 For each flow, one sentence describing what success feels like for the user.
- **Accessibility Requirements** \u2014 Keyboard nav expectations, screen reader labels, contrast target, focus management.
- **Responsive Requirements** \u2014 Breakpoints, layouts that collapse, touch-target minimums.
- **Open Questions** \u2014 Any unresolved UX decisions that need the builder's input.

Acceptance criteria:
- An AI coding tool reading this, plus Stage 2 (North Star) and Stage 4 (Spec), can build a working UI without seeing any image or mockup.
- Every flow traces back to a stated JTBD or MVP scope item.
- No HTML, no framework names, no color hex codes in the output.`,
        aiModel: "claude-haiku",
        isUnlocked: true,
        keyInsights: [
          "Key user flows named and numbered",
          "Critical screens listed with primary actions",
          "Interaction patterns specified (validation, feedback, states)",
          "Target outcomes defined per flow",
          "Accessibility and responsive requirements called out"
        ]
      },
      {
        stageNumber: 4,
        title: "Architecture & Technical Spec",
        description: "Produce the build-grade spec: runnable DDL, TypeScript types, API contracts, component list \u2014 paste-ready for AI coding tools",
        systemPrompt: `You are ProductPilot's system architect.

Context:
- This stage produces the concrete artifacts a solo builder pastes into Claude Code, Cursor, or Replit to ship a working V1. Verbose prose fails here. Concrete DDL, types, and request/response JSON succeed.
- You receive Stage 1 (Requirements), Stage 2 (North Star), Stage 3 (Design Requirements). Use them to decide entities, relations, endpoints, and component boundaries.

Task:
- In interview mode, ask one question only if a critical technical decision is missing (e.g. auth provider, multi-tenancy, sync vs async generation).
- In deliverable mode, produce runnable artifacts: schema.sql DDL, TypeScript types, API contracts, component architecture, .env.example, error conventions, security considerations.

Constraints:
- Data Model MUST be a \`\`\`sql fenced block containing valid Postgres DDL: CREATE TABLE statements with column types, NOT NULL, DEFAULT, PRIMARY KEY, FOREIGN KEY ... ON DELETE, and CREATE INDEX for hot FK columns. If a type is uncertain, use the best guess and add \`-- TAG:ASSUMED\` on the line + an Open Questions entry.
- TypeScript Types MUST be a \`\`\`ts fenced block with entity types (matching the DDL 1:1), request/response types per endpoint, and shared enums. Export each type.
- API Contracts: for each endpoint, write a compact block with:
    METHOD /path  (auth: none | session | apiKey)
    Request: { ... JSON shape ... }
    Response 200: { ... }
    Errors: 400 | 401 | 404 | 409 | 500 (only the ones that apply) with one-line meaning.
- Component Architecture: list backend routes grouped by resource, frontend pages/components with their data dependencies, and the data-flow between them. Use a compact tree, not prose.
- External Dependencies: name each service (LLM, auth, DB, storage, email) with the specific provider chosen.
- Environment Variables: \`\`\`bash fenced .env.example block with every secret and its purpose as a comment.
- Error Handling Conventions: the error response shape (JSON) used across all endpoints.
- Security: auth strategy, data validation boundary, rate-limiting approach, secret handling.
- Assumptions & Open Questions: explicit. Mark everything you assumed that wasn't stated in Stages 1-3.

Ground every component in a Stage 2 JTBD or Stage 3 user flow. If no flow needs a component, do not include it.

Output sections (deliverable mode, markdown):
- **System Overview** \u2014 1 short paragraph: what's built, primary stack, deployment target.
- **Data Model (schema.sql)** \u2014 \`\`\`sql fenced block, runnable Postgres DDL.
- **TypeScript Types** \u2014 \`\`\`ts fenced block, entity + request/response + enum types.
- **API Contracts** \u2014 one compact block per endpoint (see format above).
- **Component Architecture** \u2014 tree of backend routes + frontend pages.
- **External Dependencies** \u2014 list with chosen provider per dep.
- **Environment Variables (.env.example)** \u2014 \`\`\`bash fenced block.
- **Error Handling Conventions** \u2014 one JSON shape + HTTP code table.
- **Security Considerations** \u2014 auth, validation, rate-limit, secrets.
- **Assumptions & Open Questions** \u2014 everything inferred.

Acceptance criteria:
- A solo builder can paste the schema.sql block into \`psql\` and get a working database.
- A builder can paste the TypeScript Types block into a shared/types.ts and use them in both frontend and backend without modification.
- For every user flow in Stage 3, at least one API contract here names the endpoint(s) that serve it.
- No hand-waving. No "the backend should handle X" \u2014 every backend concern has an endpoint or is in Open Questions.`,
        isUnlocked: true,
        keyInsights: [
          "System components defined",
          "Data flow architecture designed",
          "Technology stack selected based on product needs",
          "Scalability strategy planned",
          "Security architecture specified"
        ]
      },
      {
        stageNumber: 5,
        title: "Coding Prompts",
        description: "Generate optimized coding instructions",
        systemPrompt: `You are ProductPilot's implementation-prompt specialist.

Context:
- Your job is to turn the product and architecture into copy-ready prompts for coding assistants and agentic IDE workflows.
- The output should reduce ambiguity for implementation, testing, and handoff.

Task:
- Generate prompts that a builder can paste into a coding tool to implement the product in a staged, reliable way.

Constraints:
- Favor prompts that are concrete, scoped, and executable over inspirational language.
- Include enough context for the model to act without restating the entire product history.
- Separate planning, implementation, testing, and deployment instructions when helpful.
- Mark assumptions explicitly rather than embedding them as facts.

Output:
- Markdown with sections for System Prompt, Build Plan Prompt, Frontend Prompt, Backend Prompt, Testing Prompt, and Deployment / Verification Prompt.
- Each prompt should be copy-ready and placed in a fenced code block.

Acceptance criteria:
- A builder should be able to use the prompts immediately without rewriting them.
- Prompts should reflect the actual product scope and architecture, not a generic starter template.`,
        isUnlocked: true,
        keyInsights: [
          "System instructions optimized",
          "Implementation prompts created",
          "Component-specific prompts defined",
          "Testing prompts created",
          "Deployment instructions ready"
        ]
      },
      {
        stageNumber: 6,
        title: "Development Guide",
        description: "Step-by-step implementation guide",
        systemPrompt: `You are ProductPilot's delivery planner.

Context:
- This stage converts the product, architecture, and implementation prompts into an execution plan.

Task:
- Produce a practical development guide with phases, milestones, dependencies, QA, and release guidance.

Constraints:
- Organize the work into a realistic sequence.
- Call out dependencies and risks that can block delivery.
- Keep the guide actionable; avoid generic project-management filler.
- If sequencing depends on unknown information, note it explicitly.

Output:
- Markdown with Phases, Milestones, Workstreams, Dependencies, QA / Release Checklist, Monitoring / Maintenance, and Open Risks.

Acceptance criteria:
- A team should be able to translate the guide into tickets or a sprint plan.
- The guide should show what to do first, what can run in parallel, and what must be verified before launch.`,
        isUnlocked: true,
        keyInsights: [
          "Development phases defined",
          "Task breakdown completed",
          "QA checklist created",
          "Deployment strategy ready",
          "Maintenance plan established"
        ]
      }
    ];
    DEFAULT_INTERCEPTOR_PROMPTS = [
      {
        id: "interceptor_prd_early_doc",
        scope: "interceptor",
        targetKey: "prd_early_document_prevention",
        label: "PRD Early Document Prevention",
        description: "Stops the PRD stage from generating document content before enough user context exists.",
        systemPrompt: "You are a product interviewer. Ask exactly one short follow-up question. No headers, no bullets, no document content, and no more than 300 characters.",
        userPromptTemplate: `The user said: "{{USER_MESSAGE}}".

Return exactly one brief follow-up question that helps clarify the product. Do not generate PRD sections, headings, or summaries.`,
        triggerCondition: "stage === 2 && userMessageCount < 6 && (responseHasDocumentStructure || responseLength > 800)",
        isEnabled: true
      },
      {
        id: "interceptor_ui_wireframe_enforce",
        scope: "interceptor",
        targetKey: "ui_wireframe_html_enforcement",
        label: "UI Wireframe HTML Enforcement",
        description: "Ensures the UI Design stage returns actual HTML wireframes when the model drifts into prose.",
        systemPrompt: "You are a wireframe generator. Return a complete HTML document in a ```html code block using inline CSS and the ProductPilot orange palette. No external libraries.",
        userPromptTemplate: `Create a simple HTML wireframe for: "{{USER_MESSAGE}}".

Return a complete HTML document inside a \`\`\`html code block. Use inline CSS only, keep the layout low-fidelity, and make the main actions obvious.`,
        triggerCondition: "stage === 3 && !responseHasHTML",
        isEnabled: true
      },
      {
        id: "interceptor_survey_generation",
        scope: "interceptor",
        targetKey: "survey_generation_system",
        label: "Survey Generation System Prompt",
        description: "System prompt used when generating the structured follow-on survey from discovery context.",
        systemPrompt: `You generate compact, high-signal product surveys for ProductPilot.

Constraints:
- Output one valid JSON object only.
- Use only the supported question types: slider, single-select, multi-select.
- Prefer questions that close the biggest product-definition gaps.
- Keep option labels short and concrete.
- Skip questions already answered in the supplied context.
- Focus on what to build and how it should work, not team staffing or hiring.`,
        userPromptTemplate: null,
        triggerCondition: "endpoint === '/api/projects/:projectId/generate-survey'",
        isEnabled: true
      }
    ];
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  CustomPromptSchema: () => CustomPromptSchema,
  CustomPromptsSchema: () => CustomPromptsSchema,
  DEFAULT_STAGES: () => DEFAULT_STAGES,
  INTERCEPTOR_PROMPTS: () => INTERCEPTOR_PROMPTS,
  SurveyDefinitionSchema: () => SurveyDefinitionSchema,
  SurveyQuestionSchema: () => SurveyQuestionSchema,
  SurveyResponseSchema: () => SurveyResponseSchema,
  adminPrompts: () => adminPrompts,
  insertAdminPromptSchema: () => insertAdminPromptSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertProjectSchema: () => insertProjectSchema,
  insertStageSchema: () => insertStageSchema,
  messages: () => messages,
  projects: () => projects,
  stages: () => stages,
  updateStageSchema: () => updateStageSchema
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var adminPrompts, insertAdminPromptSchema, projects, stages, messages, insertProjectSchema, CustomPromptSchema, CustomPromptsSchema, SurveyQuestionSchema, SurveyDefinitionSchema, SurveyResponseSchema, insertStageSchema, insertMessageSchema, updateStageSchema, DEFAULT_STAGES, INTERCEPTOR_PROMPTS;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    init_prompt_content();
    adminPrompts = pgTable("admin_prompts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      scope: text("scope").notNull(),
      // "stage" | "system" | "discovery"
      targetKey: text("target_key").notNull(),
      // e.g., "stage_1", "stage_2", "discovery_initial"
      label: text("label").notNull(),
      // Human-readable name
      description: text("description"),
      content: text("content").notNull(),
      // The actual prompt text
      isDefault: boolean("is_default").notNull().default(false),
      // Is this a system default?
      stageNumber: integer("stage_number"),
      // Optional: for stage-specific prompts
      updatedBy: varchar("updated_by"),
      // GitHub username of last editor
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    insertAdminPromptSchema = createInsertSchema(adminPrompts).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    projects = pgTable("projects", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id"),
      // Optional: linked user for signed-in ownership
      guestOwnerId: varchar("guest_owner_id"),
      // Optional: demo-mode ownership token
      name: text("name").notNull(),
      description: text("description").notNull(),
      mode: text("mode").notNull().default("survey"),
      // "survey" is the default and primary mode
      aiModel: text("ai_model").notNull().default("claude-sonnet"),
      surveyPhase: text("survey_phase").default("discovery"),
      // "discovery" | "survey" | "complete"
      surveyDefinition: jsonb("survey_definition"),
      // AI-generated survey questions
      surveyResponses: jsonb("survey_responses"),
      // User's survey answers
      customPrompts: jsonb("custom_prompts"),
      // User-defined LLM prompts for various uses
      intakeAnswers: jsonb("intake_answers"),
      // Answers from 8-question intake flow
      minimumDetails: jsonb("minimum_details"),
      // Problem statement, goals, objects, actions, v1 definition
      appStyle: jsonb("app_style"),
      // Selected UI/UX style for the product
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    }, (table) => [
      index("projects_user_id_idx").on(table.userId),
      index("projects_guest_owner_id_idx").on(table.guestOwnerId)
    ]);
    stages = pgTable("stages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
      stageNumber: integer("stage_number").notNull(),
      // 1-6
      title: text("title").notNull(),
      description: text("description").notNull(),
      progress: integer("progress").notNull().default(0),
      // 0-100
      isUnlocked: boolean("is_unlocked").notNull().default(true),
      // All stages unlocked by default
      systemPrompt: text("system_prompt").notNull(),
      aiModel: text("ai_model"),
      // override project model if needed
      outputs: jsonb("outputs"),
      // structured outputs from the stage
      keyInsights: jsonb("key_insights"),
      // required insights for completion
      completedInsights: jsonb("completed_insights"),
      // insights marked as complete
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    messages = pgTable("messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      stageId: varchar("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
      role: text("role").notNull(),
      // "user" | "assistant"
      content: text("content").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    insertProjectSchema = createInsertSchema(projects).pick({
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
      appStyle: true
    });
    CustomPromptSchema = z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      prompt: z.string(),
      category: z.enum(["requirements", "features", "architecture", "coding", "testing", "general"]),
      isActive: z.boolean().default(true)
    });
    CustomPromptsSchema = z.array(CustomPromptSchema);
    SurveyQuestionSchema = z.object({
      id: z.string(),
      section: z.string(),
      // Which section this relates to (requirements, prd, architecture, etc.)
      question: z.string(),
      type: z.enum(["slider", "single-select", "multi-select", "text"]),
      options: z.array(z.string()).optional(),
      // For select types
      min: z.number().optional(),
      // For slider
      max: z.number().optional(),
      // For slider
      minLabel: z.string().optional(),
      // For slider
      maxLabel: z.string().optional(),
      // For slider
      helperText: z.string().optional(),
      required: z.boolean().default(true)
    });
    SurveyDefinitionSchema = z.object({
      sections: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        questions: z.array(SurveyQuestionSchema)
      }))
    });
    SurveyResponseSchema = z.record(z.string(), z.union([
      z.number(),
      // For sliders
      z.string(),
      // For single-select
      z.array(z.string())
      // For multi-select
    ]));
    insertStageSchema = createInsertSchema(stages).pick({
      projectId: true,
      stageNumber: true,
      title: true,
      description: true,
      systemPrompt: true,
      aiModel: true
    });
    insertMessageSchema = createInsertSchema(messages).pick({
      stageId: true,
      role: true,
      content: true
    });
    updateStageSchema = createInsertSchema(stages).pick({
      progress: true,
      systemPrompt: true,
      aiModel: true,
      outputs: true,
      keyInsights: true,
      completedInsights: true
    }).partial();
    DEFAULT_STAGES = DEFAULT_STAGE_TEMPLATES;
    INTERCEPTOR_PROMPTS = DEFAULT_INTERCEPTOR_PROMPTS;
  }
});

// server/api-entry/index.ts
import express from "express";
import { toNodeHandler } from "better-auth/node";

// server/auth/index.ts
import fs from "fs";
import path from "path";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import { dash } from "@better-auth/infra";

// server/db.ts
init_schema();
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
function getDatabaseUrl() {
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const host = process.env.PGHOST;
    const user2 = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    const port = process.env.PGPORT || "5432";
    return `postgresql://${user2}:${password}@${host}:${port}/${database}`;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return null;
}
var dbUrl = getDatabaseUrl();
var connString = dbUrl && !dbUrl.includes("sslmode=") ? dbUrl + (dbUrl.includes("?") ? "&" : "?") + "sslmode=require" : dbUrl;
var pool = connString ? new Pool({
  connectionString: connString,
  max: 20,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3
}) : null;
var db = pool ? drizzle(pool, { schema: schema_exports }) : null;

// server/auth/email.ts
var RESEND_API_URL = "https://api.resend.com/emails";
function canSendWithResend() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_FROM_EMAIL);
}
async function sendAuthEmail(payload) {
  if (!canSendWithResend()) {
    console.info("[auth] Email provider not configured. Logging email instead.", {
      to: payload.to,
      subject: payload.subject,
      text: payload.text
    });
    return;
  }
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.AUTH_FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send auth email (${response.status}): ${body}`);
  }
}
async function sendVerificationEmail(input) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const subject = "Verify your ProductPilot email";
  const text3 = `${greeting}

Verify your email to finish setting up ProductPilot:
${input.url}

If you did not request this, you can ignore this email.`;
  const html = `<p>${greeting}</p>
<p>Verify your email to finish setting up ProductPilot.</p>
<p><a href="${input.url}">Verify email</a></p>
<p>If the button does not work, open this link:</p>
<p>${input.url}</p>
<p>If you did not request this, you can ignore this email.</p>`;
  await sendAuthEmail({
    to: input.email,
    subject,
    html,
    text: text3
  });
}

// server/auth/schema.ts
var schema_exports2 = {};
__export(schema_exports2, {
  account: () => account,
  session: () => session,
  user: () => user,
  verification: () => verification
});
import { index as index2, pgTable as pgTable2, text as text2, timestamp as timestamp2, boolean as boolean2, uniqueIndex } from "drizzle-orm/pg-core";
var user = pgTable2("user", {
  id: text2("id").primaryKey(),
  name: text2("name").notNull(),
  email: text2("email").notNull(),
  emailVerified: boolean2("email_verified").notNull().default(false),
  image: text2("image"),
  createdAt: timestamp2("created_at").notNull().defaultNow(),
  updatedAt: timestamp2("updated_at").notNull().defaultNow()
}, (table) => [
  uniqueIndex("user_email_unique").on(table.email)
]);
var session = pgTable2("session", {
  id: text2("id").primaryKey(),
  expiresAt: timestamp2("expires_at").notNull(),
  token: text2("token").notNull(),
  createdAt: timestamp2("created_at").notNull().defaultNow(),
  updatedAt: timestamp2("updated_at").notNull().defaultNow(),
  ipAddress: text2("ip_address"),
  userAgent: text2("user_agent"),
  userId: text2("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, (table) => [
  uniqueIndex("session_token_unique").on(table.token),
  index2("session_user_id_idx").on(table.userId)
]);
var account = pgTable2("account", {
  id: text2("id").primaryKey(),
  accountId: text2("account_id").notNull(),
  providerId: text2("provider_id").notNull(),
  userId: text2("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text2("access_token"),
  refreshToken: text2("refresh_token"),
  idToken: text2("id_token"),
  accessTokenExpiresAt: timestamp2("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp2("refresh_token_expires_at"),
  scope: text2("scope"),
  password: text2("password"),
  createdAt: timestamp2("created_at").notNull().defaultNow(),
  updatedAt: timestamp2("updated_at").notNull().defaultNow()
}, (table) => [
  index2("account_user_id_idx").on(table.userId),
  uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)
]);
var verification = pgTable2("verification", {
  id: text2("id").primaryKey(),
  identifier: text2("identifier").notNull(),
  value: text2("value").notNull(),
  expiresAt: timestamp2("expires_at").notNull(),
  createdAt: timestamp2("created_at").notNull().defaultNow(),
  updatedAt: timestamp2("updated_at").notNull().defaultNow()
}, (table) => [
  index2("verification_identifier_idx").on(table.identifier)
]);

// server/auth/index.ts
var authDb = (() => {
  if (!db) {
    throw new Error("Better Auth requires a configured PostgreSQL database.");
  }
  return db;
})();
var authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is required for Better Auth.");
}
var localHttpsConfigured = (() => {
  const certPath = path.resolve(".certs/localhost.pem");
  const keyPath = path.resolve(".certs/localhost-key.pem");
  return fs.existsSync(certPath) && fs.existsSync(keyPath);
})();
if ((process.env.NODE_ENV === "production" || localHttpsConfigured) && !process.env.BETTER_AUTH_URL) {
  throw new Error(
    "BETTER_AUTH_URL is required in production and whenever local HTTPS certs are enabled."
  );
}
if ((process.env.NODE_ENV === "production" || localHttpsConfigured) && process.env.BETTER_AUTH_URL?.startsWith("http://")) {
  throw new Error("BETTER_AUTH_URL must use https:// in production and local HTTPS mode.");
}
var defaultProtocol = process.env.BETTER_AUTH_URL?.startsWith("https://") || process.env.NODE_ENV === "production" ? "https" : "http";
var defaultHost = process.env.HOST || "localhost";
var defaultPort = process.env.PORT || "3000";
var baseURL = process.env.BETTER_AUTH_URL || `${defaultProtocol}://${defaultHost}:${defaultPort}`;
var googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
var auth = betterAuth({
  baseURL,
  secret: authSecret,
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: schema_exports2
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user: user2, url }) => {
      void sendVerificationEmail({
        email: user2.email,
        name: user2.name,
        url
      }).catch((error) => {
        console.error("[auth] Failed to send verification email", error);
      });
    }
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
      allowDifferentEmails: false
    }
  },
  socialProviders: googleEnabled ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account"
    }
  } : void 0,
  plugins: [
    // Dashboard / analytics / audit log plugin. Only activates when the three env vars are set;
    // otherwise the constructor is skipped so local dev without Upstash still works.
    ...process.env.BETTER_AUTH_API_KEY && process.env.BETTER_AUTH_KV_URL ? [
      dash({
        apiUrl: process.env.BETTER_AUTH_API_URL,
        kvUrl: process.env.BETTER_AUTH_KV_URL,
        apiKey: process.env.BETTER_AUTH_API_KEY
      })
    ] : []
  ]
});
var extractUser = async (req, _res, next) => {
  req.authSession = null;
  req.user = null;
  req.userId = null;
  try {
    const session2 = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });
    req.authSession = session2;
    req.user = session2?.user ?? null;
    req.userId = session2?.user?.id ?? null;
  } catch {
    req.authSession = null;
    req.user = null;
    req.userId = null;
  }
  next();
};
var requireAuth = (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// server/routes.ts
import { randomUUID } from "crypto";
import { createServer } from "http";

// server/storage-hybrid.ts
init_schema();
init_prompt_content();
import { eq, and, ne, desc, asc, sql as sql2 } from "drizzle-orm";
var MemStorage = class {
  projects = /* @__PURE__ */ new Map();
  stages = /* @__PURE__ */ new Map();
  messages = /* @__PURE__ */ new Map();
  userSettingsMap = /* @__PURE__ */ new Map();
  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  async createProject(insertProject) {
    const project = {
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
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.projects.set(project.id, project);
    for (const defaultStage of DEFAULT_STAGES) {
      const stage = {
        id: this.generateId(),
        projectId: project.id,
        ...defaultStage,
        progress: 0,
        isUnlocked: true,
        outputs: null,
        completedInsights: [],
        aiModel: null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      this.stages.set(stage.id, stage);
    }
    return project;
  }
  async getProject(id) {
    return this.projects.get(id);
  }
  async getAllProjects() {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
  async getProjectsByUserId(userId) {
    return (await this.getAllProjects()).filter((project) => project.userId === userId);
  }
  async getProjectsByGuestOwnerId(guestOwnerId) {
    return (await this.getAllProjects()).filter(
      (project) => project.guestOwnerId === guestOwnerId
    );
  }
  async getUserDraft(userId) {
    const allProjects = Array.from(this.projects.values());
    return allProjects.find((p) => p.userId === userId && p.surveyPhase !== "complete");
  }
  async updateProject(id, updates) {
    const existing = this.projects.get(id);
    if (!existing) {
      return void 0;
    }
    const updated = {
      ...existing,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.projects.set(id, updated);
    return updated;
  }
  async deleteProject(id) {
    const deleted = this.projects.delete(id);
    const stagesToDelete = Array.from(this.stages.values()).filter((s) => s.projectId === id);
    for (const stage of stagesToDelete) {
      await this.deleteMessagesByStage(stage.id);
      this.stages.delete(stage.id);
    }
    return deleted;
  }
  async createStage(insertStage) {
    const stage = {
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
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.stages.set(stage.id, stage);
    return stage;
  }
  async getStage(id) {
    return this.stages.get(id);
  }
  async getStagesByProject(projectId) {
    return Array.from(this.stages.values()).filter((s) => s.projectId === projectId);
  }
  async updateStage(id, updates) {
    const existing = this.stages.get(id);
    if (!existing) {
      throw new Error(`Stage with id ${id} not found`);
    }
    const updated = {
      ...existing,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.stages.set(id, updated);
    return updated;
  }
  async ensureStagesForProject(projectId) {
    const existing = await this.getStagesByProject(projectId);
    if (existing.length > 0) return existing;
    const createdStages = [];
    for (const defaultStage of DEFAULT_STAGES) {
      const stage = await this.createStage({
        projectId,
        stageNumber: defaultStage.stageNumber,
        title: defaultStage.title,
        description: defaultStage.description,
        systemPrompt: defaultStage.systemPrompt
      });
      createdStages.push(stage);
    }
    return createdStages;
  }
  async getMessage(id) {
    return this.messages.get(id);
  }
  async getMessagesByStage(stageId) {
    return Array.from(this.messages.values()).filter((m) => m.stageId === stageId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async createMessage(insertMessage) {
    const message = {
      id: this.generateId(),
      ...insertMessage,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.messages.set(message.id, message);
    return message;
  }
  async deleteMessagesByStage(stageId) {
    const messagesToDelete = Array.from(this.messages.values()).filter((m) => m.stageId === stageId);
    for (const message of messagesToDelete) {
      this.messages.delete(message.id);
    }
  }
  // Admin Prompts - In-memory implementation
  adminPrompts = /* @__PURE__ */ new Map();
  async getAllAdminPrompts() {
    return Array.from(this.adminPrompts.values());
  }
  async getAdminPrompt(id) {
    return this.adminPrompts.get(id);
  }
  async getAdminPromptByTargetKey(targetKey) {
    const prompts = Array.from(this.adminPrompts.values());
    return prompts.find((p) => p.targetKey === targetKey);
  }
  async createAdminPrompt(insertPrompt) {
    const prompt = {
      id: this.generateId(),
      scope: insertPrompt.scope,
      targetKey: insertPrompt.targetKey,
      label: insertPrompt.label,
      description: insertPrompt.description || null,
      content: insertPrompt.content,
      isDefault: insertPrompt.isDefault || false,
      stageNumber: insertPrompt.stageNumber || null,
      updatedBy: insertPrompt.updatedBy || null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.adminPrompts.set(prompt.id, prompt);
    return prompt;
  }
  async updateAdminPrompt(id, updates) {
    const existing = this.adminPrompts.get(id);
    if (!existing) return void 0;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.adminPrompts.set(id, updated);
    return updated;
  }
  async deleteAdminPrompt(id) {
    return this.adminPrompts.delete(id);
  }
  async seedDefaultPrompts(userId) {
    for (const stage of DEFAULT_STAGES) {
      await this.createAdminPrompt({
        scope: "stage",
        targetKey: `stage_${stage.stageNumber}`,
        label: stage.title,
        description: stage.description,
        content: stage.systemPrompt,
        isDefault: true,
        stageNumber: stage.stageNumber,
        updatedBy: userId
      });
    }
    await this.createAdminPrompt({
      scope: "discovery",
      targetKey: "discovery_initial",
      label: "Discovery Initial Prompt",
      description: "The initial prompt used to start the discovery conversation in Survey Mode",
      content: DISCOVERY_INITIAL_PROMPT,
      isDefault: true,
      updatedBy: userId
    });
  }
  // User Settings - MemStorage implementation
  async getUserSettings(userId) {
    return this.userSettingsMap.get(userId);
  }
  async upsertUserSettings(userId, updates) {
    const existing = this.userSettingsMap.get(userId) || { userId, llmProvider: "groq", llmModel: "llama-3.3-70b-versatile" };
    const merged = { ...existing, ...updates, userId, updatedAt: /* @__PURE__ */ new Date() };
    this.userSettingsMap.set(userId, merged);
    return merged;
  }
};
var PostgresStorage = class {
  db;
  constructor(database) {
    this.db = database;
  }
  async createProject(insertProject) {
    return await this.db.transaction(async (tx) => {
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
        isUnlocked: true
      }));
      if (stageRows.length > 0) {
        await tx.insert(stages).values(stageRows);
      }
      return project;
    });
  }
  async getProject(id) {
    const result = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }
  async getAllProjects() {
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }
  async getProjectsByUserId(userId) {
    return await this.db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
  }
  async getProjectsByGuestOwnerId(guestOwnerId) {
    return await this.db.select().from(projects).where(eq(projects.guestOwnerId, guestOwnerId)).orderBy(desc(projects.createdAt));
  }
  async getUserDraft(userId) {
    const result = await this.db.select().from(projects).where(and(eq(projects.userId, userId), ne(projects.surveyPhase, "complete"))).limit(1);
    return result[0];
  }
  async updateProject(id, updates) {
    const finalUpdates = { ...updates };
    if (Object.keys(finalUpdates).length > 0 && !finalUpdates.updatedAt) {
      finalUpdates.updatedAt = /* @__PURE__ */ new Date();
    }
    const [updatedProject] = await this.db.update(projects).set(finalUpdates).where(eq(projects.id, id)).returning();
    return updatedProject;
  }
  async deleteProject(id) {
    const result = await this.db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }
  async createStage(insertStage) {
    const [stage] = await this.db.insert(stages).values(insertStage).returning();
    return stage;
  }
  async getStage(id) {
    const result = await this.db.select().from(stages).where(eq(stages.id, id)).limit(1);
    return result[0];
  }
  async getStagesByProject(projectId) {
    return await this.db.select().from(stages).where(eq(stages.projectId, projectId));
  }
  async updateStage(id, updates) {
    const finalUpdates = { ...updates };
    if (Object.keys(finalUpdates).length > 0 && !finalUpdates.updatedAt) {
      finalUpdates.updatedAt = /* @__PURE__ */ new Date();
    }
    if (updates.completedInsights !== void 0) {
      const keyInsights = updates.keyInsights || [];
      const completedInsights = updates.completedInsights || [];
      if (Array.isArray(keyInsights) && keyInsights.length > 0) {
        const completedCount = Array.isArray(completedInsights) ? completedInsights.length : 0;
        const totalCount = keyInsights.length;
        finalUpdates.progress = Math.max(0, Math.min(100, Math.round(completedCount / totalCount * 100)));
      }
    }
    const [updatedStage] = await this.db.update(stages).set(finalUpdates).where(eq(stages.id, id)).returning();
    return updatedStage;
  }
  async ensureStagesForProject(projectId) {
    const existing = await this.db.select().from(stages).where(eq(stages.projectId, projectId));
    if (existing.length > 0) return existing;
    const createdStages = [];
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
        isUnlocked: true
      }).returning();
      createdStages.push(stage);
    }
    return createdStages;
  }
  async getMessage(id) {
    const result = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }
  async getMessagesByStage(stageId) {
    return await this.db.select().from(messages).where(eq(messages.stageId, stageId)).orderBy(asc(messages.createdAt));
  }
  async createMessage(insertMessage) {
    const [message] = await this.db.insert(messages).values(insertMessage).returning();
    return message;
  }
  async deleteMessagesByStage(stageId) {
    await this.db.delete(messages).where(eq(messages.stageId, stageId));
  }
  // Admin Prompts - PostgreSQL implementation
  async getAllAdminPrompts() {
    return await this.db.select().from(adminPrompts);
  }
  async getAdminPrompt(id) {
    const result = await this.db.select().from(adminPrompts).where(eq(adminPrompts.id, id)).limit(1);
    return result[0];
  }
  async getAdminPromptByTargetKey(targetKey) {
    const result = await this.db.select().from(adminPrompts).where(eq(adminPrompts.targetKey, targetKey)).limit(1);
    return result[0];
  }
  async createAdminPrompt(insertPrompt) {
    const [prompt] = await this.db.insert(adminPrompts).values(insertPrompt).returning();
    return prompt;
  }
  async updateAdminPrompt(id, updates) {
    const finalUpdates = { ...updates };
    if (!finalUpdates.updatedAt) {
      finalUpdates.updatedAt = /* @__PURE__ */ new Date();
    }
    const [updatedPrompt] = await this.db.update(adminPrompts).set(finalUpdates).where(eq(adminPrompts.id, id)).returning();
    return updatedPrompt;
  }
  async deleteAdminPrompt(id) {
    const result = await this.db.delete(adminPrompts).where(eq(adminPrompts.id, id));
    return result.rowCount > 0;
  }
  async seedDefaultPrompts(userId) {
    for (const stage of DEFAULT_STAGES) {
      await this.createAdminPrompt({
        scope: "stage",
        targetKey: `stage_${stage.stageNumber}`,
        label: stage.title,
        description: stage.description,
        content: stage.systemPrompt,
        isDefault: true,
        stageNumber: stage.stageNumber,
        updatedBy: userId
      });
    }
    await this.createAdminPrompt({
      scope: "discovery",
      targetKey: "discovery_initial",
      label: "Discovery Initial Prompt",
      description: "The initial prompt used to start the discovery conversation in Survey Mode",
      content: DISCOVERY_INITIAL_PROMPT,
      isDefault: true,
      updatedBy: userId
    });
  }
  // User Settings - PostgresStorage implementation
  async getUserSettings(userId) {
    const result = await this.db.execute(
      sql2`SELECT * FROM user_settings WHERE user_id = ${userId} LIMIT 1`
    );
    return result.rows?.[0] || void 0;
  }
  async upsertUserSettings(userId, updates) {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      await this.db.execute(
        sql2`UPDATE user_settings SET
          llm_provider = COALESCE(${updates.llmProvider ?? null}, llm_provider),
          llm_api_key = ${updates.llmApiKey !== void 0 ? updates.llmApiKey : sql2`llm_api_key`},
          llm_model = COALESCE(${updates.llmModel ?? null}, llm_model),
          updated_at = NOW()
        WHERE user_id = ${userId}`
      );
      return this.getUserSettings(userId);
    } else {
      await this.db.execute(
        sql2`INSERT INTO user_settings (id, user_id, llm_provider, llm_api_key, llm_model)
        VALUES (gen_random_uuid(), ${userId}, ${updates.llmProvider || "groq"}, ${updates.llmApiKey || null}, ${updates.llmModel || "llama-3.3-70b-versatile"})`
      );
      return this.getUserSettings(userId);
    }
  }
};
function createStorage() {
  const hasDatabase = !!(process.env.DATABASE_URL || process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE);
  if (hasDatabase && db) {
    console.log("Using PostgreSQL storage");
    return new PostgresStorage(db);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No database configured in production. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Refusing to fall back to in-memory storage."
    );
  }
  console.log("Using in-memory storage (no database configured \u2014 dev only)");
  return new MemStorage();
}
var storage = createStorage();

// server/services/ai.ts
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";

// server/prompt-builders.ts
var STAGE_SECTION_GUIDANCE = {
  1: [
    "Problem",
    "Target Users",
    "Core Jobs To Be Done",
    "MVP Scope",
    "Non-Goals",
    "Constraints",
    "Success Metrics",
    "Open Questions"
  ],
  // Stage 2 = North Star. Strategic context every later LLM call references to audit scope.
  // No duplication with Stage 1's concrete requirements.
  2: [
    "User Pain Point",
    "Ideal Customer Profile (ICP)",
    "Problem Statement",
    "Jobs To Be Done",
    "Positioning & Unique Insight",
    "Success Metrics",
    "Non-Goals"
  ],
  // Stage 3 = Design Requirements. User flows + outcomes, not low-fi HTML.
  3: [
    "Key User Flows",
    "Critical Screens",
    "Interaction Requirements",
    "Target Outcomes",
    "Accessibility Requirements",
    "Responsive Requirements",
    "Open Questions"
  ],
  // Stage 4 = Architecture + full Spec. Concrete, paste-ready artifacts.
  4: [
    "System Overview",
    "Data Model (schema.sql)",
    "TypeScript Types",
    "API Contracts",
    "Component Architecture",
    "External Dependencies",
    "Environment Variables (.env.example)",
    "Error Handling Conventions",
    "Security Considerations",
    "Assumptions & Open Questions"
  ],
  5: [
    "Repo Bootstrap Prompt",
    "Schema Migration Prompt",
    "Backend Route Prompts",
    "Frontend Screen Prompts",
    "Smoke Test Prompt",
    "Deploy Prompt"
  ],
  6: [
    "Phases",
    "Milestones",
    "Workstreams",
    "Dependencies",
    "QA and Release Checklist",
    "Monitoring and Maintenance",
    "Open Risks"
  ]
};
var STAGE_DELIVERABLE_HINTS = {
  1: "Make the output crisp enough that product, design, and engineering align on scope.",
  2: "This is the North Star doc. Every later LLM call will reference it to decide what's in-scope. Capture pain, ICP, JTBD, and success crisply \u2014 no duplication with Stage 1's concrete scope.",
  3: "Specify design requirements \u2014 user flows, interaction patterns, target outcomes. Do NOT produce HTML. The output is read by AI coding tools that will choose their own component library.",
  4: "Produce build-grade artifacts a solo developer can paste into Claude Code / Cursor and ship. Include a runnable schema.sql DDL block, TypeScript types, and explicit API contracts with request/response JSON.",
  5: "Each prompt must reference Stage 4's data model / types / APIs and Stage 3's screens by name. Prompts are paste-ready \u2014 they include file paths, exact deps, env keys, and concrete commands.",
  6: "Produce an execution plan a solo builder can follow without a second translation pass. Commands over ceremony."
};
function parseJsonField(field) {
  if (!field) return null;
  if (typeof field === "object") return field;
  if (typeof field === "string") {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  return null;
}
function buildProjectContext(project) {
  let projectContext = "";
  if (project.description) {
    projectContext += `

=== PRODUCT IDEA ===
${project.description}`;
  }
  const intake = parseJsonField(project.intakeAnswers);
  if (intake && Object.keys(intake).length > 0) {
    projectContext += `

=== INTAKE SURVEY RESPONSES ===`;
    const intakeLabels = {
      intent: "What they're building",
      platform: "Platform/Type",
      aiFeatures: "AI Features",
      dataComplexity: "Data Complexity",
      qualityPriority: "Quality Priority",
      launchTimeline: "Launch Timeline",
      teamSize: "Team Size",
      budget: "Budget"
    };
    for (const [key, value] of Object.entries(intake)) {
      if (!value) continue;
      const label = intakeLabels[key] || key;
      projectContext += `
- ${label}: ${value}`;
    }
  }
  const details = parseJsonField(project.minimumDetails);
  if (details && Object.keys(details).length > 0) {
    projectContext += `

=== MINIMUM PRODUCT DETAILS ===`;
    if (details.problemStatement) {
      projectContext += `
Problem Statement: ${details.problemStatement}`;
    }
    if (details.userGoals && Array.isArray(details.userGoals)) {
      const goals = details.userGoals.filter((goal) => goal.trim());
      if (goals.length > 0) {
        projectContext += `
User Goals: ${goals.join(", ")}`;
      }
    }
    if (details.goals && Array.isArray(details.goals)) {
      projectContext += `
Goals: ${details.goals.join(", ")}`;
    }
    if (details.mainObjects && Array.isArray(details.mainObjects)) {
      const objects = details.mainObjects.filter((item) => item.trim());
      if (objects.length > 0) {
        projectContext += `
Core Objects/Entities: ${objects.join(", ")}`;
      }
    }
    if (details.objects && Array.isArray(details.objects)) {
      projectContext += `
Core Objects/Entities: ${details.objects.join(", ")}`;
    }
    if (details.mainActions && Array.isArray(details.mainActions)) {
      const actions = details.mainActions.filter((item) => item.trim());
      if (actions.length > 0) {
        projectContext += `
Key Actions: ${actions.join(", ")}`;
      }
    }
    if (details.actions && Array.isArray(details.actions)) {
      projectContext += `
Key Actions: ${details.actions.join(", ")}`;
    }
    if (details.v1Definition) {
      projectContext += `
V1 Scope: ${details.v1Definition}`;
    }
    if (details.inspirationLink) {
      projectContext += `
Inspiration/Reference: ${details.inspirationLink}`;
    }
    if (details.mustUseTools) {
      projectContext += `
Must Use: ${details.mustUseTools}`;
    }
    if (details.mustAvoidTools) {
      projectContext += `
Must Avoid: ${details.mustAvoidTools}`;
    }
  }
  return projectContext;
}
function buildStageRuntimeSystemPrompt(args) {
  const { basePrompt, projectContext, stageNumber, userMessageCount } = args;
  let prompt = basePrompt;
  if (projectContext) {
    prompt += `

<PROJECT_CONTEXT>${projectContext}

Use this context to avoid re-asking for information that is already known. If context is incomplete, ask only for the highest-value missing detail.</PROJECT_CONTEXT>`;
  }
  if (stageNumber === 2 && userMessageCount < 6) {
    prompt += `

<RUNTIME_RULES>You have received ${userMessageCount} user messages so far. Because this is still early discovery, ask exactly one focused follow-up question, keep the response under 300 characters, and do not generate PRD sections or formatted document output.</RUNTIME_RULES>`;
  }
  if (stageNumber === 3) {
    prompt += `

<RUNTIME_RULES>Whenever you generate a deliverable response in this stage, include complete HTML wireframe code inside \`\`\`html blocks. Use inline CSS only and keep the output low-fidelity but viewable.</RUNTIME_RULES>`;
  }
  return prompt;
}
function buildSurveyGenerationPrompt(args) {
  const transcript = args.discoveryMessages.length > 0 ? args.discoveryMessages.map((message) => `${message.role}: ${message.content}`).join("\n") : "No discovery transcript is available.";
  return `You are generating ProductPilot's follow-on survey.

Context:
- Product description: ${args.projectDescription}
- Discovery transcript:
${transcript}

Task:
- Generate the shortest survey that closes the highest-value product-definition gaps.

Constraints:
- Create at most 3 sections.
- Create at most 2 questions per section.
- Use only these question types: slider, single-select, multi-select.
- Keep option labels short, concrete, and easy to scan.
- Use multi-select by default for feature or scope choices.
- Use single-select only for true either/or decisions.
- Use sliders only for concrete numeric or range-style questions such as budget, user count, or launch urgency.
- Do not ask questions that the user already answered in the description or transcript.
- Do not ask about hiring, agencies, staffing, or team allocation.
- Focus on what to build, how it should work, and what matters most for v1.
- Every question must be answerable on its own.
- Return JSON only. No markdown, no explanations, no code fences.

Output schema:
{
  "sections": [
    {
      "id": "what",
      "title": "What You're Building",
      "description": "Short section description",
      "questions": [
        {
          "id": "q1",
          "section": "what",
          "question": "Short, conversational question?",
          "type": "multi-select",
          "options": ["Short option", "Another option"],
          "required": true
        }
      ]
    }
  ]
}

Acceptance criteria:
- The survey should feel like a quick product conversation, not enterprise intake.
- The JSON must be valid and contain no extra keys.
- Each question should collect information that materially improves the downstream documents.`;
}
function buildDocumentGenerationPrompt(args) {
  const detailInstruction = args.detailLevel === "summary" ? "Generate the concise version. Under each heading, write only 1\u20132 lines of dense, decision-grade prose \u2014 the way a requirements definition reads. No padding, no restated context, no transitions. If a heading has nothing decided yet, write one line noting the gap and move on." : "Generate the detailed version. Be comprehensive and specific, but keep each subsection tight: short declarative sentences, bullet lists over paragraphs, no filler. A builder should be able to skim each heading in under 10 seconds and know what to do.";
  const allPromptContext = args.activePrompts.length > 0 ? `
Active custom prompts across the project:
${args.activePrompts.map((prompt) => `- ${prompt.name} [${prompt.category}]: ${prompt.prompt}`).join("\n")}` : "";
  const relevantPromptContext = args.relevantPrompts.length > 0 ? `
Stage-specific custom prompts:
${args.relevantPrompts.map((prompt) => `- ${prompt.name}: ${prompt.prompt}`).join("\n")}` : "";
  const requiredSections = STAGE_SECTION_GUIDANCE[args.stage.stageNumber] || [
    "Overview",
    "Key Decisions",
    "Open Questions"
  ];
  return `You are generating the "${args.stage.title}" deliverable for ProductPilot.

Context:
- Product: ${args.productDescription}
- Survey definition: ${JSON.stringify(args.surveyDefinition)}
- Survey responses: ${JSON.stringify(args.surveyResponses)}${allPromptContext}${relevantPromptContext}

Task:
- Produce the ${args.detailLevel} version of this stage output.
- ${STAGE_DELIVERABLE_HINTS[args.stage.stageNumber] || "Tailor the output to the stage objective."}

Constraints:
- Ground the output in the supplied product context.
- Use relevant custom prompts only when they add clarity and do not conflict with the survey answers.
- Do not invent specifics. If a decision cannot be justified from the context, place it under Assumptions or Open Questions.
- Use markdown headings and bullets where useful.
- Replace vague placeholders with concrete recommendations or explicit gaps.
- ${detailInstruction}

Required sections:
${requiredSections.map((section) => `- ${section}`).join("\n")}

Acceptance criteria:
- The document should read like it belongs to this specific product.
- A builder should be able to use it immediately without needing a second translation pass.`;
}
function buildMinimumDetailsDocumentPrompt(args) {
  const requiredSections = STAGE_SECTION_GUIDANCE[args.stage.stageNumber] || [
    "Overview",
    "Key Decisions",
    "Open Questions"
  ];
  return `You are generating the "${args.stage.title}" deliverable from ProductPilot's minimum-details flow.

Context:
${args.minimalContext}${args.appStyleSummary ? `
${args.appStyleSummary}` : ""}

Task:
- Produce a practical first-pass deliverable for this stage using only the supplied context.
- ${STAGE_DELIVERABLE_HINTS[args.stage.stageNumber] || "Tailor the output to the stage objective."}

Constraints:
- Be specific, but do not fabricate facts that are not supported by the input.
- If information is missing, state the assumption and explain why it matters.
- Keep the output implementation-useful rather than generic.
- Use markdown headings and bullets where useful.

Required sections:
${requiredSections.map((section) => `- ${section}`).join("\n")}

Acceptance criteria:
- The output should be useful as a credible first draft, not a placeholder.
- Any assumptions should be explicit, limited, and easy to validate later.`;
}
function buildProgressAssessmentPrompt(args) {
  return `Evaluate stage completion for ProductPilot.

Task:
- Estimate completion as an integer from 0 to 100 based on the user's conversation and the stated stage goals.

Context:
- Stage goals:
${args.stageGoals.map((goal) => `  - ${goal}`).join("\n")}
- Recent conversation:
${args.messages.slice(-10).map((message) => `${message.role}: ${message.content}`).join("\n")}

Constraints:
- Base the score on evidence in the conversation, not on ideal future work.
- Weight user-provided information more than assistant restatements.
- Use lower scores when major goals are still unaddressed.
- Return valid JSON only.

Output schema:
{"progress": 42, "reasoning": "One short sentence."}

Acceptance criteria:
- The score should reflect real completion, not optimism.
- The reasoning should name the strongest evidence behind the score.`;
}

// server/services/ai.ts
var GROQ_MODELS = {
  // Reasoning / deliverables / complex tasks. Replaces the retired kimi-k2-instruct-0905.
  reasoning: "openai/gpt-oss-120b",
  // Fast, cheap chat and classification. 12x cheaper input than llama-3.3-70b.
  fast: "llama-3.1-8b-instant",
  // Safety classifier (not used today).
  safeguard: "openai/gpt-oss-safeguard-20b"
};
var AIService = class {
  getDefaultConfig(task = "chat") {
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    if (!hasAnthropic && !hasGroq) {
      throw new Error("No LLM API key configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY.");
    }
    if (hasAnthropic && hasGroq) {
      switch (task) {
        case "deliverable":
          return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: "claude-sonnet-4-5" };
        case "complex":
          return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: "claude-opus-4-7" };
        case "classification":
          return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: "claude-haiku-4-5" };
        case "chat":
        default:
          return { provider: "groq", apiKey: process.env.GROQ_API_KEY, model: GROQ_MODELS.fast };
      }
    }
    if (hasAnthropic) {
      const model = task === "complex" ? "claude-opus-4-7" : task === "classification" ? "claude-haiku-4-5" : "claude-sonnet-4-5";
      return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model };
    }
    const groqModel = task === "complex" || task === "deliverable" ? GROQ_MODELS.reasoning : GROQ_MODELS.fast;
    return { provider: "groq", apiKey: process.env.GROQ_API_KEY, model: groqModel };
  }
  async chat(messages2, model = "claude-sonnet", userConfig, task = "chat") {
    const config = userConfig || this.getDefaultConfig(task);
    switch (config.provider) {
      case "groq":
        return this.chatWithGroq(messages2, config.model || GROQ_MODELS.fast, config.apiKey);
      case "anthropic":
        return this.chatWithClaude(messages2, this.normalizeModel(model || config.model || "claude-sonnet"), config.apiKey);
      default:
        return this.chatWithGroq(messages2, GROQ_MODELS.fast, this.getDefaultConfig(task).apiKey);
    }
  }
  /**
   * Streaming variant of chat(). Yields incremental text deltas, then a final event with the full content and usage.
   * Use for conversational stages where perceived latency matters.
   */
  async *chatStream(messages2, model = "claude-sonnet", userConfig, task = "chat") {
    const config = userConfig || this.getDefaultConfig(task);
    if (config.provider === "anthropic") {
      yield* this.streamClaude(
        messages2,
        this.normalizeModel(model || config.model || "claude-sonnet"),
        config.apiKey
      );
      return;
    }
    yield* this.streamGroq(messages2, config.model || GROQ_MODELS.fast, config.apiKey);
  }
  async *streamGroq(messages2, model, apiKey) {
    const groq = new Groq({ apiKey });
    const systemMessage = messages2.find((m) => m.role === "system");
    const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    const stream = await groq.chat.completions.create({
      model,
      messages: [
        ...systemMessage ? [{ role: "system", content: systemMessage.content }] : [],
        ...conversationMessages
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: true
    });
    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        yield { type: "delta", text: delta };
      }
    }
    yield { type: "done", fullContent: full };
  }
  async *streamClaude(messages2, model, apiKey) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("No Anthropic API key configured");
    const anthropic = new Anthropic({ apiKey: key });
    const systemMessage = messages2.find((m) => m.role === "system");
    const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemMessage?.content ? [{ type: "text", text: systemMessage.content, cache_control: { type: "ephemeral" } }] : void 0,
      messages: conversationMessages
    });
    let full = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        full += event.delta.text;
        yield { type: "delta", text: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    yield {
      type: "done",
      fullContent: full,
      usage: {
        prompt_tokens: final.usage.input_tokens,
        completion_tokens: final.usage.output_tokens,
        total_tokens: final.usage.input_tokens + final.usage.output_tokens
      }
    };
  }
  async chatWithGroq(messages2, model, apiKey) {
    const groq = new Groq({ apiKey });
    const systemMessage = messages2.find((m) => m.role === "system");
    const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    const response = await groq.chat.completions.create({
      model,
      messages: [
        ...systemMessage ? [{ role: "system", content: systemMessage.content }] : [],
        ...conversationMessages
      ],
      max_tokens: 4096,
      temperature: 0.7
    });
    const content = response.choices[0]?.message?.content || "";
    return { content };
  }
  async chatWithClaude(messages2, model, apiKey) {
    try {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("No Anthropic API key configured");
      const anthropic = new Anthropic({ apiKey: key });
      const systemMessage = messages2.find((m) => m.role === "system");
      const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({
        role: m.role,
        content: m.content
      }));
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.7,
        system: systemMessage?.content ? [{ type: "text", text: systemMessage.content, cache_control: { type: "ephemeral" } }] : void 0,
        messages: conversationMessages
      });
      const firstBlock = response.content?.[0];
      const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
      return {
        content,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };
    } catch (error) {
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async generateStructuredOutput(messages2, model = "claude-sonnet", userConfig, task = "classification") {
    const config = userConfig || this.getDefaultConfig(task);
    if (config.provider === "groq") {
      const groqModel = config.model || (task === "classification" ? GROQ_MODELS.fast : GROQ_MODELS.reasoning);
      const response = await this.chatWithGroq(messages2, groqModel, config.apiKey);
      try {
        return this.extractJSON(response.content);
      } catch {
        return {};
      }
    }
    const targetModel = config.model || this.normalizeModel(model);
    return this.generateStructuredWithClaude(messages2, this.normalizeModel(targetModel), config.apiKey);
  }
  async generateStructuredWithClaude(messages2, model, apiKey) {
    try {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("No Anthropic API key configured");
      const anthropic = new Anthropic({ apiKey: key });
      const systemMessage = messages2.find((m) => m.role === "system");
      const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({
        role: m.role,
        content: m.content
      }));
      const systemPrompt = systemMessage?.content ? `${systemMessage.content}

IMPORTANT: You must respond with valid JSON only. Do not include any text before or after the JSON object.` : "You must respond with valid JSON only. Do not include any text before or after the JSON object.";
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.3,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: conversationMessages
      });
      const firstBlock = response.content?.[0];
      const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "{}";
      return this.extractJSON(content);
    } catch (error) {
      throw new Error(`Claude structured output error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Extract JSON from LLM response that may include markdown fences or extra text.
   */
  extractJSON(text3) {
    try {
      return JSON.parse(text3);
    } catch {
    }
    const fenceMatch = text3.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
      }
    }
    const braceStart = text3.indexOf("{");
    const braceEnd = text3.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(text3.slice(braceStart, braceEnd + 1));
      } catch {
      }
    }
    throw new Error("Could not extract JSON from response");
  }
  normalizeModel(model) {
    switch (model.toLowerCase()) {
      case "claude-sonnet":
      case "claude-sonnet-4":
      case "claude-sonnet-4-5":
        return "claude-sonnet-4-5";
      case "claude-haiku":
      case "claude-3-haiku":
      case "claude-haiku-4-5":
        return "claude-haiku-4-5";
      case "claude-opus":
      case "claude-opus-4-7":
        return "claude-opus-4-7";
      default:
        return "claude-sonnet-4-5";
    }
  }
  async calculateProgress(messages2, stageGoals, userConfig) {
    const progressPrompt = buildProgressAssessmentPrompt({
      messages: messages2,
      stageGoals
    });
    try {
      const result = await this.generateStructuredOutput(
        [
          { role: "system", content: "You are a progress assessment expert." },
          { role: "user", content: progressPrompt }
        ],
        "claude-haiku",
        userConfig,
        "classification"
      );
      return Math.min(100, Math.max(0, result.progress || 0));
    } catch (error) {
      const meaningfulMessages = messages2.filter((m) => m.role === "user" && m.content.length > 20);
      return Math.max(0, Math.min(75, meaningfulMessages.length * 15));
    }
  }
};
var aiService = new AIService();

// server/routes.ts
init_schema();
import { z as z2 } from "zod";
async function getLLMConfig(req) {
  if (!req.userId) return null;
  const settings = await storage.getUserSettings(req.userId);
  const apiKey = settings?.llm_api_key || settings?.llmApiKey;
  if (!apiKey) return null;
  return {
    provider: settings.llm_provider || settings.llmProvider || "groq",
    apiKey,
    model: settings.llm_model || settings.llmModel || void 0
  };
}
var ADMIN_EMAILS = /* @__PURE__ */ new Set(["tyrone.ross@gmail.com"]);
var getInterceptorPrompt = (targetKey) => INTERCEPTOR_PROMPTS.find((p) => p.targetKey === targetKey);
var hasAdminAccess = (req) => {
  const email = typeof req.user?.email === "string" ? req.user.email.toLowerCase() : null;
  return Boolean(req.userId && email && ADMIN_EMAILS.has(email));
};
var isAdmin = (req, res, next) => {
  if (!hasAdminAccess(req)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
var DEMO_OWNER_COOKIE = "productpilot_demo_owner";
var DEMO_OWNER_COOKIE_MAX_AGE_MS = 1e3 * 60 * 60 * 24 * 30;
var SHOULD_SECURE_DEMO_COOKIE = process.env.NODE_ENV === "production" || process.env.BETTER_AUTH_URL?.startsWith("https://");
function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(";").reduce((accumulator, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return accumulator;
    }
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      accumulator[key] = decodeURIComponent(value);
    }
    return accumulator;
  }, {});
}
function getGuestOwnerId(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const guestOwnerId = cookies[DEMO_OWNER_COOKIE];
  return typeof guestOwnerId === "string" && guestOwnerId.trim() ? guestOwnerId : null;
}
function setGuestOwnerCookie(res, guestOwnerId) {
  res.cookie(DEMO_OWNER_COOKIE, guestOwnerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: SHOULD_SECURE_DEMO_COOKIE,
    maxAge: DEMO_OWNER_COOKIE_MAX_AGE_MS,
    path: "/"
  });
}
function clearGuestOwnerCookie(res) {
  res.clearCookie(DEMO_OWNER_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: SHOULD_SECURE_DEMO_COOKIE,
    path: "/"
  });
}
function getActorContext(req) {
  if (req.userId) {
    return { kind: "user", id: req.userId };
  }
  const guestOwnerId = getGuestOwnerId(req);
  if (guestOwnerId) {
    return { kind: "guest", id: guestOwnerId };
  }
  return { kind: "none" };
}
function projectBelongsToActor(project, actor) {
  if (actor.kind === "user") {
    return project.userId === actor.id;
  }
  return project.guestOwnerId === actor.id;
}
function isOrphanProject(project) {
  return !project.userId && !project.guestOwnerId;
}
function requireActor(req, res) {
  const actor = getActorContext(req);
  if (actor.kind === "none") {
    res.status(401).json({ message: "Authentication or demo mode is required" });
    return null;
  }
  return actor;
}
async function loadOwnedProject(req, res, projectId) {
  const actor = requireActor(req, res);
  if (!actor) {
    return null;
  }
  const project = await storage.getProject(projectId);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  if (isOrphanProject(project)) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  if (!projectBelongsToActor(project, actor)) {
    res.status(403).json({ message: "You do not have access to this project" });
    return null;
  }
  if (actor.kind === "guest") {
    setGuestOwnerCookie(res, actor.id);
  }
  return { actor, project };
}
async function loadOwnedStage(req, res, stageId) {
  const actor = requireActor(req, res);
  if (!actor) {
    return null;
  }
  const stage = await storage.getStage(stageId);
  if (!stage) {
    res.status(404).json({ message: "Stage not found" });
    return null;
  }
  const project = await storage.getProject(stage.projectId);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  if (isOrphanProject(project)) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  if (!projectBelongsToActor(project, actor)) {
    res.status(403).json({ message: "You do not have access to this project" });
    return null;
  }
  if (actor.kind === "guest") {
    setGuestOwnerCookie(res, actor.id);
  }
  return { actor, project, stage };
}
async function registerRoutes(app2) {
  app2.use(extractUser);
  app2.get("/api/admin/check", requireAuth, (req, res) => {
    res.json({
      isAdmin: hasAdminAccess(req),
      user: { id: req.userId, email: req.user?.email ?? null }
    });
  });
  app2.get("/api/user/draft", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const draft = await storage.getUserDraft(userId);
      res.json(draft || null);
    } catch (error) {
      console.error("Error fetching user draft:", error);
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });
  app2.post("/api/projects/:id/claim", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (project.userId && project.userId !== userId) {
        return res.status(403).json({ message: "Project already belongs to another user" });
      }
      const guestOwnerId = getGuestOwnerId(req);
      const callerOwnsDemoProject = !project.userId && Boolean(project.guestOwnerId) && project.guestOwnerId === guestOwnerId;
      if (project.userId !== userId && !callerOwnsDemoProject) {
        return res.status(403).json({ message: "You do not have access to claim this project" });
      }
      const updatedProject = project.userId === userId ? project : await storage.updateProject(req.params.id, {
        userId,
        guestOwnerId: null
      });
      clearGuestOwnerCookie(res);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error claiming project:", error);
      res.status(500).json({ message: "Failed to claim project" });
    }
  });
  app2.get("/api/projects", async (req, res) => {
    try {
      const actor = getActorContext(req);
      const projects2 = actor.kind === "user" ? await storage.getProjectsByUserId(actor.id) : actor.kind === "guest" ? await storage.getProjectsByGuestOwnerId(actor.id) : [];
      res.json(projects2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });
  app2.get("/api/projects/:id", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.id);
      if (!projectAccess) {
        return;
      }
      res.json(projectAccess.project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });
  app2.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const actor = getActorContext(req);
      const demoModeRequested = req.body?.demoMode === true;
      if (actor.kind === "none" && !demoModeRequested) {
        return res.status(401).json({ message: "Sign in or explicitly start demo mode" });
      }
      const guestOwnerId = actor.kind === "guest" ? actor.id : actor.kind === "none" ? randomUUID() : null;
      if (guestOwnerId) {
        setGuestOwnerCookie(res, guestOwnerId);
      }
      const project = await storage.createProject({
        ...projectData,
        userId: actor.kind === "user" ? actor.id : null,
        guestOwnerId
      });
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });
  app2.patch("/api/projects/:id", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.id);
      if (!projectAccess) {
        return;
      }
      const updates = z2.object({
        name: z2.string().optional(),
        description: z2.string().optional(),
        mode: z2.enum(["interview", "stage-based", "survey"]).optional(),
        aiModel: z2.string().optional(),
        surveyPhase: z2.enum(["discovery", "survey", "complete"]).optional(),
        surveyDefinition: z2.any().optional(),
        surveyResponses: z2.any().optional(),
        customPrompts: z2.any().optional(),
        intakeAnswers: z2.any().optional(),
        minimumDetails: z2.any().optional(),
        appStyle: z2.any().optional()
      }).parse(req.body);
      const updatedProject = await storage.updateProject(projectAccess.project.id, updates);
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });
  app2.delete("/api/projects/:id", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.id);
      if (!projectAccess) {
        return;
      }
      const deleted = await storage.deleteProject(projectAccess.project.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });
  app2.get("/api/projects/:projectId/stages", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const stages2 = await storage.getStagesByProject(projectAccess.project.id);
      res.json(stages2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });
  app2.post("/api/projects/:projectId/ensure-stages", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const existingStages = await storage.getStagesByProject(projectAccess.project.id);
      if (existingStages.length > 0) {
        return res.json(existingStages);
      }
      const stages2 = await storage.ensureStagesForProject(projectAccess.project.id);
      res.status(201).json(stages2);
    } catch (error) {
      console.error("Error ensuring stages:", error);
      res.status(500).json({ message: "Failed to create stages" });
    }
  });
  app2.get("/api/stages/:id", async (req, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.id);
      if (!stageAccess) {
        return;
      }
      res.json(stageAccess.stage);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stage" });
    }
  });
  app2.patch("/api/stages/:id", async (req, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.id);
      if (!stageAccess) {
        return;
      }
      const updates = updateStageSchema.parse(req.body);
      const stage = await storage.updateStage(req.params.id, updates);
      if (!stage) {
        return res.status(404).json({ message: "Stage not found" });
      }
      res.json(stage);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid stage data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update stage" });
    }
  });
  app2.get("/api/stages/:stageId/messages", async (req, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
      if (!stageAccess) {
        return;
      }
      const messages2 = await storage.getMessagesByStage(stageAccess.stage.id);
      res.json(messages2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  app2.post("/api/stages/:stageId/messages", async (req, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
      if (!stageAccess) {
        return;
      }
      const messageData = insertMessageSchema.parse({
        ...req.body,
        stageId: stageAccess.stage.id
      });
      const message = await storage.createMessage(messageData);
      if (messageData.role === "user") {
        const { stage, project } = stageAccess;
        const existingMessages = await storage.getMessagesByStage(stage.id);
        const adminPrompt = await storage.getAdminPromptByTargetKey(`stage_${stage.stageNumber}`);
        const projectContext = buildProjectContext(project);
        if (projectContext.length > 0) {
          console.log(`AI context enriched with project data (${projectContext.length} chars)`);
        } else if (project.intakeAnswers || project.minimumDetails) {
          console.warn("Project has intake/details but context extraction failed");
        }
        const userMessageCount = existingMessages.filter((m) => m.role === "user").length;
        const systemPromptToUse = buildStageRuntimeSystemPrompt({
          basePrompt: adminPrompt?.content || stage.systemPrompt,
          projectContext,
          stageNumber: stage.stageNumber,
          userMessageCount
        });
        const aiMessages = [
          { role: "system", content: systemPromptToUse },
          ...existingMessages.map((m) => ({ role: m.role, content: m.content }))
        ];
        try {
          const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";
          const userConfig = await getLLMConfig(req);
          const task = stage.stageNumber >= 4 ? "complex" : "chat";
          const aiResponse = await aiService.chat(aiMessages, modelToUse, userConfig, task);
          const aiMessage = await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: aiResponse.content
          });
          const shouldAssessProgress = userMessageCount === 1 || userMessageCount % 3 === 0;
          if (shouldAssessProgress) {
            const allMessages = [
              ...existingMessages.map((m) => ({ role: m.role, content: m.content })),
              { role: "assistant", content: aiResponse.content }
            ];
            const progress = await aiService.calculateProgress(
              allMessages,
              [stage.description]
              // In production, define more specific goals
            );
            await storage.updateStage(stage.id, { progress });
          }
          res.status(201).json({ userMessage: message, aiMessage });
        } catch (aiError) {
          console.error("AI service error:", aiError);
          res.status(503).json({ userMessage: message, aiMessage: null, error: "AI service unavailable" });
        }
      } else {
        res.status(201).json({ userMessage: message });
      }
    } catch (error) {
      console.error("Message creation error:", error);
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create message", error: String(error) });
    }
  });
  app2.post("/api/stages/:stageId/messages/stream", async (req, res) => {
    const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
    if (!stageAccess) return;
    let userMessage;
    try {
      const messageData = insertMessageSchema.parse({ ...req.body, stageId: stageAccess.stage.id });
      userMessage = await storage.createMessage(messageData);
      if (messageData.role !== "user") {
        res.status(400).json({ message: "Streaming only supports user-initiated messages" });
        return;
      }
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.issues });
      }
      return res.status(500).json({ message: "Failed to create message", error: String(error) });
    }
    const { stage, project } = stageAccess;
    const existingMessages = await storage.getMessagesByStage(stage.id);
    const adminPrompt = await storage.getAdminPromptByTargetKey(`stage_${stage.stageNumber}`);
    const projectContext = buildProjectContext(project);
    const userMessageCount = existingMessages.filter((m) => m.role === "user").length;
    const systemPromptToUse = buildStageRuntimeSystemPrompt({
      basePrompt: adminPrompt?.content || stage.systemPrompt,
      projectContext,
      stageNumber: stage.stageNumber,
      userMessageCount
    });
    const aiMessages = [
      { role: "system", content: systemPromptToUse },
      ...existingMessages.map((m) => ({ role: m.role, content: m.content }))
    ];
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    const send = (event, data) => {
      res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
    };
    send("user", { userMessage });
    try {
      const userConfig = await getLLMConfig(req);
      const task = stage.stageNumber >= 4 ? "complex" : "chat";
      const modelToUse = stage.aiModel || project.aiModel || "claude-sonnet";
      let full = "";
      for await (const chunk of aiService.chatStream(aiMessages, modelToUse, userConfig, task)) {
        if (chunk.type === "delta") {
          full += chunk.text;
          send("delta", { text: chunk.text });
        } else {
          full = chunk.fullContent;
        }
      }
      const aiMessage = await storage.createMessage({
        stageId: stage.id,
        role: "assistant",
        content: full
      });
      send("message", { aiMessage });
      const shouldAssessProgress = userMessageCount === 1 || userMessageCount % 3 === 0;
      if (shouldAssessProgress) {
        const allMessages = [
          ...existingMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant", content: full }
        ];
        const progress = await aiService.calculateProgress(allMessages, [stage.description]);
        await storage.updateStage(stage.id, { progress });
        send("progress", { progress });
      }
      send("done", {});
      res.end();
    } catch (err) {
      console.error("Stream error:", err);
      send("error", { message: err instanceof Error ? err.message : "AI service error" });
      res.end();
    }
  });
  app2.post("/api/projects/:projectId/generate-survey", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;
      const stages2 = await storage.getStagesByProject(project.id);
      const prdStage = stages2.find((s) => s.stageNumber === 2);
      const discoveryMessages = prdStage ? await storage.getMessagesByStage(prdStage.id) : [];
      const surveyPrompt = buildSurveyGenerationPrompt({
        projectDescription: project.description,
        discoveryMessages
      });
      const surveyInterceptor = getInterceptorPrompt("survey_generation_system");
      const systemPrompt = surveyInterceptor?.isEnabled ? surveyInterceptor.systemPrompt : "You are a product requirements expert. Generate surveys that efficiently capture high-value information using sliders and select inputs. Always return valid JSON.";
      const response = await aiService.generateStructuredOutput([
        { role: "system", content: systemPrompt },
        { role: "user", content: surveyPrompt }
      ], "claude-sonnet", void 0, "deliverable");
      await storage.updateProject(project.id, {
        surveyDefinition: response,
        surveyPhase: "survey"
      });
      res.json({ surveyDefinition: response });
    } catch (error) {
      console.error("Survey generation error:", error);
      res.status(500).json({ message: "Failed to generate survey" });
    }
  });
  app2.post("/api/projects/:projectId/submit-survey", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;
      const { responses } = req.body;
      await storage.updateProject(project.id, {
        surveyResponses: responses,
        surveyPhase: "complete"
      });
      res.json({ message: "Survey submitted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit survey" });
    }
  });
  app2.post("/api/projects/:projectId/generate-docs-from-survey", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;
      if (!project.surveyResponses || !project.surveyDefinition) {
        return res.status(400).json({ message: "Survey not completed" });
      }
      const documentPreferences = req.body.documentPreferences || [];
      const preferencesMap = new Map(
        documentPreferences.map((p) => [p.stageId, p.detailLevel])
      );
      const allStages = await storage.getStagesByProject(project.id);
      const stages2 = documentPreferences.length > 0 ? allStages.filter((s) => preferencesMap.has(s.id)) : allStages;
      const customPrompts = project.customPrompts || [];
      const activePrompts = customPrompts.filter((p) => p.isActive);
      const stageCategoryMap = {
        1: "requirements",
        2: "requirements",
        3: "features",
        4: "architecture",
        5: "coding",
        6: "testing"
      };
      const allAdminPrompts = await storage.getAllAdminPrompts();
      const adminPromptMap = new Map(allAdminPrompts.map((p) => [p.targetKey, p]));
      const userConfig = await getLLMConfig(req);
      await Promise.allSettled(stages2.map(async (stage) => {
        const detailLevel = preferencesMap.get(stage.id) || "detailed";
        const stageCategory = stageCategoryMap[stage.stageNumber] || (() => {
          const titleLower = stage.title.toLowerCase();
          if (titleLower.includes("requirement") || titleLower.includes("prd") || titleLower.includes("goal") || titleLower.includes("scope")) return "requirements";
          if (titleLower.includes("feature") || titleLower.includes("ui") || titleLower.includes("design") || titleLower.includes("wireframe") || titleLower.includes("mockup")) return "features";
          if (titleLower.includes("architecture") || titleLower.includes("system") || titleLower.includes("infrastructure")) return "architecture";
          if (titleLower.includes("coding") || titleLower.includes("prompt") || titleLower.includes("implementation") || titleLower.includes("code")) return "coding";
          if (titleLower.includes("test") || titleLower.includes("qa") || titleLower.includes("quality") || titleLower.includes("guide") || titleLower.includes("deploy") || titleLower.includes("release")) return "testing";
          return "general";
        })();
        const relevantPrompts = activePrompts.filter((p) => p.category === stageCategory || p.category === "general");
        const docPrompt = buildDocumentGenerationPrompt({
          stage,
          surveyDefinition: project.surveyDefinition,
          surveyResponses: project.surveyResponses,
          detailLevel,
          activePrompts,
          relevantPrompts,
          productDescription: project.description
        });
        try {
          const adminPrompt = adminPromptMap.get(`stage_${stage.stageNumber}`);
          const systemPromptToUse = adminPrompt?.content || stage.systemPrompt;
          const task = stage.stageNumber >= 4 ? "complex" : "deliverable";
          const response = await aiService.chat([
            { role: "system", content: systemPromptToUse },
            { role: "user", content: docPrompt }
          ], "claude-sonnet", userConfig, task);
          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content
          });
          await storage.updateStage(stage.id, { progress: 100 });
        } catch (stageError) {
          console.error(`Error generating docs for stage ${stage.title}:`, stageError);
        }
      }));
      res.json({ message: "Documentation generated successfully" });
    } catch (error) {
      console.error("Doc generation error:", error);
      res.status(500).json({ message: "Failed to generate documentation" });
    }
  });
  app2.post("/api/projects/:projectId/generate-docs-from-minimum", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;
      const minimumDetails = req.body.minimumDetails || project.minimumDetails;
      if (!minimumDetails) {
        return res.status(400).json({ message: "Minimum details not provided" });
      }
      let stages2 = await storage.getStagesByProject(project.id);
      if (stages2.length === 0) {
        for (const stageData of DEFAULT_STAGES) {
          await storage.createStage({
            projectId: project.id,
            stageNumber: stageData.stageNumber,
            title: stageData.title,
            description: stageData.description,
            systemPrompt: stageData.systemPrompt,
            aiModel: stageData.aiModel || null
          });
        }
        stages2 = await storage.getStagesByProject(project.id);
      }
      const md = minimumDetails;
      const contextParts = [
        `PROBLEM: ${md.problemStatement}`,
        `USER GOALS: ${md.userGoals.join(", ")}`,
        `V1 DEFINITION: ${md.v1Definition}`
      ];
      if (md.mainObjects?.length) contextParts.push(`MAIN OBJECTS: ${md.mainObjects.join(", ")}`);
      if (md.mainActions?.length) contextParts.push(`MAIN ACTIONS: ${md.mainActions.join(", ")}`);
      if (md.inspirationLink) contextParts.push(`INSPIRATION: ${md.inspirationLink}`);
      if (md.mustUseTools) contextParts.push(`MUST USE: ${md.mustUseTools}`);
      if (md.mustAvoidTools) contextParts.push(`MUST AVOID: ${md.mustAvoidTools}`);
      const appStyle = project.appStyle;
      let appStyleSummary = null;
      if (appStyle) {
        const styleParts = [`UI/UX STYLE: ${appStyle.name}`];
        if (appStyle.tagline) styleParts.push(`Style approach: ${appStyle.tagline}`);
        if (appStyle.vibe) styleParts.push(`Vibe: ${appStyle.vibe}`);
        if (appStyle.description) styleParts.push(`Custom description: ${appStyle.description}`);
        if (appStyle.brands) styleParts.push(`Reference brands: ${appStyle.brands}`);
        appStyleSummary = styleParts.join(". ");
        contextParts.push(appStyleSummary);
      }
      const minimalContext = contextParts.join("\n");
      const coreStagesToGenerate = stages2.filter((s) => s.stageNumber <= 4);
      const allAdminPrompts = await storage.getAllAdminPrompts();
      const adminPromptMap = new Map(allAdminPrompts.map((p) => [p.targetKey, p]));
      const userConfig = await getLLMConfig(req);
      await Promise.allSettled(coreStagesToGenerate.map(async (stage) => {
        const docPrompt = buildMinimumDetailsDocumentPrompt({
          stage,
          minimalContext,
          appStyleSummary
        });
        try {
          const adminPrompt = adminPromptMap.get(`stage_${stage.stageNumber}`);
          const systemPromptToUse = adminPrompt?.content || stage.systemPrompt;
          const task = stage.stageNumber >= 4 ? "complex" : "deliverable";
          const response = await aiService.chat([
            { role: "system", content: systemPromptToUse },
            { role: "user", content: docPrompt }
          ], "claude-sonnet", userConfig, task);
          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content
          });
          await storage.updateStage(stage.id, { progress: 100 });
        } catch (stageError) {
          console.error(`Error generating docs for stage ${stage.title}:`, stageError);
        }
      }));
      res.json({ message: "Documentation generated from minimum details" });
    } catch (error) {
      console.error("Min doc generation error:", error);
      res.status(500).json({ message: "Failed to generate documentation" });
    }
  });
  app2.get("/api/projects/:projectId/export", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;
      const stages2 = await storage.getStagesByProject(project.id);
      const exportData = {
        project,
        stages: await Promise.all(stages2.map(async (stage) => {
          const messages2 = await storage.getMessagesByStage(stage.id);
          return { ...stage, messages: messages2 };
        })),
        exportedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export project" });
    }
  });
  app2.get("/api/admin/prompts", requireAuth, isAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllAdminPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching admin prompts:", error);
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });
  app2.get("/api/admin/prompts/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const prompt = await storage.getAdminPrompt(req.params.id);
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(prompt);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch prompt" });
    }
  });
  app2.post("/api/admin/prompts", requireAuth, isAdmin, async (req, res) => {
    try {
      const promptData = insertAdminPromptSchema.parse(req.body);
      const userId = req.userId || "unknown";
      const prompt = await storage.createAdminPrompt({
        ...promptData,
        updatedBy: userId
      });
      res.status(201).json(prompt);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.issues });
      }
      console.error("Error creating prompt:", error);
      res.status(500).json({ message: "Failed to create prompt" });
    }
  });
  app2.put("/api/admin/prompts/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const updates = insertAdminPromptSchema.partial().parse(req.body);
      const userId = req.userId || "unknown";
      const prompt = await storage.updateAdminPrompt(req.params.id, {
        ...updates,
        updatedBy: userId
      });
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(prompt);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update prompt" });
    }
  });
  app2.delete("/api/admin/prompts/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteAdminPrompt(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json({ message: "Prompt deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete prompt" });
    }
  });
  app2.post("/api/admin/prompts/seed", requireAuth, isAdmin, async (req, res) => {
    try {
      const existingPrompts = await storage.getAllAdminPrompts();
      if (existingPrompts.length > 0) {
        return res.json({ message: "Prompts already exist", count: existingPrompts.length });
      }
      const userId = req.userId || "system";
      await storage.seedDefaultPrompts(userId);
      const prompts = await storage.getAllAdminPrompts();
      res.json({ message: "Default prompts seeded", count: prompts.length });
    } catch (error) {
      console.error("Error seeding prompts:", error);
      res.status(500).json({ message: "Failed to seed prompts" });
    }
  });
  app2.get("/api/admin/default-stages", requireAuth, isAdmin, async (req, res) => {
    try {
      const { DEFAULT_STAGES: DEFAULT_STAGES2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      res.json(DEFAULT_STAGES2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch default stages" });
    }
  });
  app2.get("/api/admin/interceptor-prompts", requireAuth, isAdmin, async (req, res) => {
    try {
      const { INTERCEPTOR_PROMPTS: INTERCEPTOR_PROMPTS2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      res.json(INTERCEPTOR_PROMPTS2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch interceptor prompts" });
    }
  });
  app2.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.userId);
      const result = settings || { llmProvider: "groq", llmModel: "openai/gpt-oss-120b", llmApiKey: null };
      const rawKey = result.llm_api_key || result.llmApiKey;
      if (rawKey) {
        result.llmApiKeyMasked = rawKey.slice(0, 7) + "..." + rawKey.slice(-4);
        delete result.llm_api_key;
        delete result.llmApiKey;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });
  app2.put("/api/settings", requireAuth, async (req, res) => {
    try {
      const { llmProvider, llmApiKey, llmModel } = req.body;
      const settings = await storage.upsertUserSettings(req.userId, {
        llmProvider,
        llmApiKey,
        llmModel
      });
      res.json({ message: "Settings updated", provider: settings.llm_provider || settings.llmProvider });
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
  app2.delete("/api/settings/key", requireAuth, async (req, res) => {
    try {
      await storage.upsertUserSettings(req.userId, { llmApiKey: null });
      res.json({ message: "API key removed. Using demo key." });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove key" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/migrate.ts
import { Pool as Pool2 } from "pg";
function getDatabaseUrl2() {
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const host = process.env.PGHOST;
    const user2 = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    const port = process.env.PGPORT || "5432";
    return `postgresql://${user2}:${password}@${host}:${port}/${database}`;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  throw new Error("Database connection not configured. Please ensure PostgreSQL is provisioned.");
}
async function runMigrations() {
  const dbUrl2 = getDatabaseUrl2();
  const connString2 = !dbUrl2.includes("sslmode=") ? dbUrl2 + (dbUrl2.includes("?") ? "&" : "?") + "sslmode=require" : dbUrl2;
  const pool2 = new Pool2({ connectionString: connString2 });
  try {
    console.log("Running database migrations...");
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "guest_owner_id" varchar,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "ai_model" text DEFAULT 'claude-sonnet' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "stages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL,
        "stage_number" integer NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "progress" integer DEFAULT 0 NOT NULL,
        "is_unlocked" boolean DEFAULT true NOT NULL,
        "system_prompt" text NOT NULL,
        "ai_model" text,
        "outputs" jsonb,
        "key_insights" jsonb,
        "completed_insights" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "stage_id" varchar NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text,
        "first_name" text,
        "last_name" text,
        "profile_image_url" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);
    await pool2.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire")
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "email_verified" boolean DEFAULT false NOT NULL,
        "image" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "id" text PRIMARY KEY NOT NULL,
        "expires_at" timestamp NOT NULL,
        "token" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "ip_address" text,
        "user_agent" text,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" text PRIMARY KEY NOT NULL,
        "account_id" text NOT NULL,
        "provider_id" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "access_token" text,
        "refresh_token" text,
        "id_token" text,
        "access_token_expires_at" timestamp,
        "refresh_token_expires_at" timestamp,
        "scope" text,
        "password" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "verification" (
        "id" text PRIMARY KEY NOT NULL,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")
    `);
    await pool2.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token")
    `);
    await pool2.query(`
      CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id")
    `);
    await pool2.query(`
      CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id")
    `);
    await pool2.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique" ON "account" ("provider_id", "account_id")
    `);
    await pool2.query(`
      CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier")
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "admin_prompts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "scope" text NOT NULL,
        "target_key" text NOT NULL,
        "label" text NOT NULL,
        "description" text,
        "content" text NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "stage_number" integer,
        "updated_by" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool2.query(`
      DO $$ 
      BEGIN
        -- Check if old schema exists (has 'key' column but not 'scope')
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_prompts' AND column_name = 'key')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_prompts' AND column_name = 'scope') THEN
          -- Drop old table and recreate with new schema
          DROP TABLE "admin_prompts";
          CREATE TABLE "admin_prompts" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "scope" text NOT NULL,
            "target_key" text NOT NULL,
            "label" text NOT NULL,
            "description" text,
            "content" text NOT NULL,
            "is_default" boolean DEFAULT false NOT NULL,
            "stage_number" integer,
            "updated_by" varchar,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          );
        END IF;
      END $$;
    `);
    await pool2.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'stages_project_id_projects_id_fk'
        ) THEN
          ALTER TABLE "stages" ADD CONSTRAINT "stages_project_id_projects_id_fk" 
          FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);
    await pool2.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'messages_stage_id_stages_id_fk'
        ) THEN
          ALTER TABLE "messages" ADD CONSTRAINT "messages_stage_id_stages_id_fk" 
          FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);
    await pool2.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'user_id') THEN
          ALTER TABLE "projects" ADD COLUMN "user_id" varchar;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'guest_owner_id') THEN
          ALTER TABLE "projects" ADD COLUMN "guest_owner_id" varchar;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'mode') THEN
          ALTER TABLE "projects" ADD COLUMN "mode" text DEFAULT 'survey' NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'survey_phase') THEN
          ALTER TABLE "projects" ADD COLUMN "survey_phase" text DEFAULT 'discovery';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'survey_definition') THEN
          ALTER TABLE "projects" ADD COLUMN "survey_definition" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'survey_responses') THEN
          ALTER TABLE "projects" ADD COLUMN "survey_responses" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'custom_prompts') THEN
          ALTER TABLE "projects" ADD COLUMN "custom_prompts" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'intake_answers') THEN
          ALTER TABLE "projects" ADD COLUMN "intake_answers" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'minimum_details') THEN
          ALTER TABLE "projects" ADD COLUMN "minimum_details" jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'app_style') THEN
          ALTER TABLE "projects" ADD COLUMN "app_style" jsonb;
        END IF;
      END $$;
    `);
    await pool2.query(`
      CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" ("user_id")
    `);
    await pool2.query(`
      CREATE INDEX IF NOT EXISTS "projects_guest_owner_id_idx" ON "projects" ("guest_owner_id")
    `);
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "user_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar(255) NOT NULL UNIQUE,
        "llm_provider" text DEFAULT 'groq',
        "llm_api_key" text,
        "llm_model" text DEFAULT 'llama-3.3-70b-versatile',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);
    await pool2.query(`
      DO $$
      DECLARE
        tbl TEXT;
      BEGIN
        FOR tbl IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename NOT IN ('user', 'session', 'account', 'verification')
        LOOP
          EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        END LOOP;
      END $$;
    `);
    await pool2.query(`
      DO $$
      BEGIN
        ALTER TABLE IF EXISTS "user" DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS "session" DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS "account" DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS "verification" DISABLE ROW LEVEL SECURITY;
      END $$;
    `);
    await pool2.query(`
      DO $$
      BEGIN
        -- Projects: users see their own + unowned projects (demo)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_user_isolation') THEN
          CREATE POLICY projects_user_isolation ON projects
            USING (user_id IS NULL OR user_id = current_setting('app.current_user_id', true));
        END IF;

        -- User settings: users see only their own
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_settings_isolation') THEN
          CREATE POLICY user_settings_isolation ON user_settings
            USING (user_id = current_setting('app.current_user_id', true));
        END IF;
      END $$;
    `);
    console.log("Database migrations completed successfully!");
    return true;
  } catch (error) {
    console.error("Error running migrations:", error);
    return false;
  } finally {
    await pool2.end();
  }
}

// server/api-entry/index.ts
var appInitialized = false;
var app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
async function ensureInitialized() {
  if (appInitialized) return;
  try {
    await runMigrations();
  } catch (error) {
    console.log(
      "Skipping migrations:",
      error instanceof Error ? error.message : error
    );
  }
  await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
  appInitialized = true;
}
async function handler(req, res) {
  await ensureInitialized();
  app(req, res);
}
export {
  handler as default
};
