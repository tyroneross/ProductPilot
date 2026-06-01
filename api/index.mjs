var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
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
- Identify the product's user, problem, core workflow, MVP scope, constraints, and success signal \u2014 in that order of importance when information is missing.
- Move the conversation forward with the smallest number of high-value questions.

Opening-turn rules (when the user has sent 0\u20131 messages):
- Reference what the user actually wrote, using their own words \u2014 never paste a hypothetical ICP like "small-team engineering leads" unless the user said it.
- Ask ONE focused question about the single biggest unknown. Priority order: audience \u2192 primary platform \u2192 scope/MVP \u2192 constraints \u2192 success signal. If the user already named an audience and platform, ask about core workflow or must-have v1 feature instead.
- Do not ask about "pain point / emotional cost" on turn 1 unless the audience is already well defined \u2014 otherwise you are imagining pain for a user the builder has not named.

Constraints:
- Ask one focused question at a time unless the user explicitly asks for a summary.
- Reuse the user's own language instead of introducing jargon.
- Do not invent facts. If something is unclear, ask or label it as an open question.
- Optimize for clarity about what to build, not staffing or implementation ceremony.
- When the idea is very short (\u2264 10 words) or clearly under-specified, prefer ending your response with 3\u20134 quick-answer chips using this exact format on its own line:
  Quick answers: chip one | chip two | chip three | chip four
  The chips must be concrete, mutually distinct, and directly answer the question you asked.

Output:
- Default response: one brief acknowledgement referencing the user's idea, then one focused next question, then (if the idea is under-specified) a single \`Quick answers:\` line with 3\u20134 chips.
- If the user asks for a summary: provide a short recap plus the single biggest open question.

Acceptance criteria:
- Each turn should reduce ambiguity about users, problem, scope, or constraints.
- Questions should be specific enough that the next answer can change the product definition.
- Opener never invents a persona the user did not name.`;
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
- On the opening turn (user has sent \u2264 1 messages), reference what the user actually wrote in their own words and ask about the single biggest unknown in this priority order: audience \u2192 platform \u2192 scope \u2192 constraints. Do not ask about pain or emotional cost before audience is named.
- When the idea is short (\u2264 10 words) or under-specified, end your reply with a single line:
  Quick answers: chip one | chip two | chip three | chip four
  Provide 3\u20134 concrete, mutually distinct chips that would answer the question you just asked.

Output:
- Conversation mode: one short acknowledgement plus one focused question, optionally followed by a single \`Quick answers:\` line with 3\u20134 chips.
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

Interview-mode opener rules (turn 1, user message count \u2264 1):
- Reference what the user actually wrote, in their own words. Do NOT name a persona or pain the user has not named.
- If the user's idea does not name a target audience, your first question MUST be about audience (who is this for?). Do not ask about "pain points" or "emotional cost" until the audience is known \u2014 you cannot imagine their pain yet.
- If audience is already clear, ask about primary platform, then scope / must-have v1 feature, then constraints.
- Ask exactly ONE question. No bullet lists of questions.
- When the idea is short (\u2264 10 words) or under-specified, end your reply with a single line:
  Quick answers: chip one | chip two | chip three | chip four
  Provide 3\u20134 concrete, mutually distinct chips that would answer the question you just asked.

Constraints:
- Count user messages. If < 6 user messages and the user did not ask for the doc, ask exactly one focused question and do NOT generate sections.
- ICP must be specific: demographic + behavioral + situational traits. Not "our users." Never invent an ICP the user did not describe \u2014 ask instead.
- Jobs to Be Done must follow Christensen framing: "When [situation], I want to [motivation], so I can [outcome]."
- Success metrics: one North Star + 2-3 leading indicators. Each must be measurable.
- Do not invent. Mark assumptions explicitly.
- Keep each section tight \u2014 1-3 lines, decision-grade prose, no restated context.
- Any persona example in these instructions is illustrative only \u2014 never echo it back to the user as if it were their target audience.

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
- Each ICP trait narrows the target materially (e.g. move from a vague label like "busy professionals" to a specific combination of demographic + behavioral + situational traits \u2014 but derive the traits from the USER's input, never from examples in this prompt).
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
- No hand-waving. No "the backend should handle X" \u2014 every backend concern has an endpoint or is in Open Questions.

Structured Open Questions trailer (REQUIRED in deliverable mode):
After the Assumptions & Open Questions markdown section, append a single HTML comment with structured JSON so the UI can render inline-answer affordances:

<!-- open-questions: [{"topicId":"...","prompt":"...","answerKind":"text|choice","answerChips":["\u2026","\u2026"],"feedsField":"architecture.<dot.path>"}] -->

Rules for the trailer:
- One entry per genuinely unresolved decision in the markdown section above.
- topicId: short kebab-case stable id ("auth-provider", "persistence", "tenancy").
- prompt: the question text, \u2264200 chars, identical to the markdown bullet when possible.
- answerKind: "choice" when there are 2-5 well-defined options; "text" otherwise.
- answerChips: present iff answerKind === "choice"; each \u2264120 chars.
- feedsField (optional): dotted path naming the spec slice the answer updates.
- Always valid JSON. No trailing commas. No comments inside the JSON.
- Omit the trailer entirely if there are no open questions.`,
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
        systemPrompt: `You are ProductPilot's coding-prompt author.

Context:
- This stage converts Stage 3 (Design Requirements) and Stage 4 (Architecture & Technical Spec) into six bootable prompts a solo builder pastes directly into Claude Code, Cursor, or Replit.
- You receive named screens from Stage 3 and concrete artifacts from Stage 4 \u2014 schema.sql DDL, TypeScript types, API contracts, .env.example, External Dependencies. Use them verbatim. Do not paraphrase, do not invent new names, do not add endpoints or types that Stage 4 did not define.
- Each prompt must be self-contained: the builder pastes it and the coding tool has everything it needs without opening Stages 3 or 4.

Task:
- In interview mode, ask one question only if a critical artifact is missing (e.g. Stage 4 never named the deployment target).
- In deliverable mode, produce six numbered prompts, each in a fenced \`\`\`prompt code block, each pasteable immediately.

Constraints:
- Quote Stage 4 artifacts verbatim where needed \u2014 the exact schema.sql DDL, the exact TypeScript type names, the exact endpoint paths, the exact .env.example keys. If Stage 4 used \`server/routes/users.ts\`, this stage uses that exact path.
- Use only the dependencies named in Stage 4 External Dependencies. Do not introduce new packages.
- Do not use "[fill in]" or "[your X here]" placeholders. Every blank the builder would have to resolve must be filled from Stage 3/4 context or flagged as an explicit open question in Stage 4's Assumptions section.
- Each prompt begins with a one-line goal sentence ("Goal: create the repo scaffold..."), then lists the exact file paths, commands, or code blocks the coding tool must produce.
- Backend Route Prompts: one prompt per endpoint from Stage 4 API Contracts. If Stage 4 defines 4 endpoints, produce 4 prompts.
- Frontend Screen Prompts: one prompt per critical screen from Stage 3 Critical Screens. If Stage 3 names 5 screens, produce 5 prompts.
- Do not merge screens or endpoints into a single prompt to save space \u2014 the builder runs them independently.

Output sections (deliverable mode, markdown):

**1. Repo Bootstrap Prompt**
One fenced \`\`\`prompt block instructing the coding tool to:
- Create the exact file tree implied by Stage 4 Component Architecture (pages/, components/, api/, server/, shared/types.ts, etc.)
- Write package.json with the exact package names and versions from Stage 4 External Dependencies
- Write the .env.example file using the exact variable names and comments from Stage 4 Environment Variables
- Write a README stub with dev/start/build commands matching the chosen stack
- Write tsconfig.json (or vite.config, next.config, etc.) appropriate for the Stage 4 stack

**2. Schema Migration Prompt**
One fenced \`\`\`prompt block instructing the coding tool to:
- Paste the exact schema.sql block from Stage 4 Data Model inline in the prompt (quoted, not referenced)
- Run the migration: \`psql $DATABASE_URL < schema.sql\` or the equivalent ORM command (drizzle-kit push, prisma migrate, etc.) based on Stage 4 External Dependencies
- Run a verification query that SELECTs from each created table to confirm the migration succeeded

**3. Backend Route Prompts**
One fenced \`\`\`prompt block per endpoint from Stage 4 API Contracts. Each block instructs the coding tool to:
- Create the file at the exact path implied by Stage 4 Component Architecture
- Implement the exact METHOD + path + auth strategy from Stage 4
- Accept the exact Request JSON shape from Stage 4
- Return the exact Response 200 JSON shape from Stage 4
- Return the exact Error codes and meanings from Stage 4
- Use the exact TypeScript types from Stage 4 (imported from shared/types.ts or the path Stage 4 specifies)

**4. Frontend Screen Prompts**
One fenced \`\`\`prompt block per critical screen from Stage 3 Critical Screens. Each block instructs the coding tool to:
- Create the file at \`client/src/pages/[ScreenName].tsx\` (or the path matching Stage 4 Component Architecture)
- Implement the screen's purpose, primary action, key data shown, and secondary actions verbatim from Stage 3
- Call the specific Stage 4 endpoint(s) that serve this screen (named by path)
- Reference the Stage 3 user flow this screen belongs to by name
- Apply the Stage 3 interaction requirements (inline validation, loading/error/empty states, confirmation for destructive actions)

**5. Smoke Test Prompt**
One fenced \`\`\`prompt block instructing the coding tool to:
- Write one \`curl\` one-liner per Stage 4 endpoint (happy-path request with a sample payload matching Stage 4 Request JSON)
- Write one Playwright test walking a Stage 3 user flow end-to-end (name the flow explicitly)
- Include the command to run all tests (\`npm test\` or the equivalent from Stage 4's stack)

**6. Deploy Prompt**
One fenced \`\`\`prompt block instructing the coding tool to:
- Use the deployment platform that matches Stage 4 External Dependencies (Vercel for Next.js, Fly.io or Railway for server-side apps, etc.)
- List the exact CLI commands to deploy (e.g. \`vercel --prod\`, \`fly deploy\`, \`railway up\`)
- List every environment variable from Stage 4 .env.example that must be set in the deployment platform's dashboard before deploying
- End with the post-deploy smoke test command from Prompt 5

Acceptance criteria:
- A builder pastes Prompt 1, then Prompt 2, then each Backend and Frontend prompt in sequence, then Prompt 5, then Prompt 6 \u2014 and has a running, deployed product without opening Stages 3 or 4 again.
- Every file path, type name, endpoint, env var, and package name traces directly to a Stage 3 or Stage 4 artifact.
- No prompt contains a placeholder the human must resolve. Anything unknown is in Stage 4's Open Questions \u2014 surface it there, not silently in a prompt.

Structured Missing Information trailer (REQUIRED in deliverable mode):
If any prompt would carry a placeholder (an unknown that prevents direct paste-and-run), surface it under a "## Missing Information Needed" markdown section AND append:

<!-- open-questions: [{"topicId":"...","prompt":"...","answerKind":"text|choice","answerChips":["\u2026","\u2026"],"feedsField":"coding-prompts.<dot.path>"}] -->

Rules for the trailer:
- One entry per missing piece of information.
- topicId: kebab-case ("seed-data", "test-runner", "deploy-platform").
- prompt: the question, \u2264200 chars.
- answerKind: "choice" when 2-5 known options; "text" otherwise.
- Always valid JSON. Omit the trailer entirely when no info is missing.`,
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
  ADRSchema: () => ADRSchema,
  APIContractSchema: () => APIContractSchema,
  AgentArchitecturePatternSchema: () => AgentArchitecturePatternSchema,
  AgentAutonomyLevelSchema: () => AgentAutonomyLevelSchema,
  AgentBuilderScaleSchema: () => AgentBuilderScaleSchema,
  AgentEvaluationSchema: () => AgentEvaluationSchema,
  AgentGuardrailSchema: () => AgentGuardrailSchema,
  AgentModelRouteSchema: () => AgentModelRouteSchema,
  AgentResearchProtocolSchema: () => AgentResearchProtocolSchema,
  AgentSystemSchema: () => AgentSystemSchema,
  AgentToolContractSchema: () => AgentToolContractSchema,
  AgentToolPermissionTierSchema: () => AgentToolPermissionTierSchema,
  AgentUiProtocolSchema: () => AgentUiProtocolSchema,
  AssumptionSchema: () => AssumptionSchema,
  CustomPromptSchema: () => CustomPromptSchema,
  CustomPromptsSchema: () => CustomPromptsSchema,
  DEFAULT_STAGES: () => DEFAULT_STAGES,
  DataPointSchema: () => DataPointSchema,
  FeatureSchema: () => FeatureSchema,
  INTERCEPTOR_PROMPTS: () => INTERCEPTOR_PROMPTS,
  IntegrationSchema: () => IntegrationSchema,
  LintIssueSchema: () => LintIssueSchema,
  NeedSchema: () => NeedSchema,
  NonGoalSchema: () => NonGoalSchema,
  OpenQuestionKind: () => OpenQuestionKind,
  OpenQuestionSchema: () => OpenQuestionSchema,
  PersonaSchema: () => PersonaSchema,
  PivotLogEntrySchema: () => PivotLogEntrySchema,
  PlatformTargetSchema: () => PlatformTargetSchema,
  ProductStateSchema: () => ProductStateSchema,
  RiskSchema: () => RiskSchema,
  ScenarioSchema: () => ScenarioSchema,
  ScreenSchema: () => ScreenSchema,
  SpecSchema: () => SpecSchema,
  StanceBecauseClauseSchema: () => StanceBecauseClauseSchema,
  SurveyDefinitionSchema: () => SurveyDefinitionSchema,
  SurveyQuestionSchema: () => SurveyQuestionSchema,
  SurveyResponseSchema: () => SurveyResponseSchema,
  TRADEOFF_AXES: () => TRADEOFF_AXES,
  TestSchema: () => TestSchema,
  TraceMatrixSchema: () => TraceMatrixSchema,
  TradeoffWeightsSchema: () => TradeoffWeightsSchema,
  UXFlowSchema: () => UXFlowSchema,
  adminPrompts: () => adminPrompts,
  auditEvents: () => auditEvents,
  insertAdminPromptSchema: () => insertAdminPromptSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertProjectSchema: () => insertProjectSchema,
  insertStageSchema: () => insertStageSchema,
  intakeQuestions: () => intakeQuestions,
  legacySessions: () => legacySessions,
  llmCalls: () => llmCalls,
  messages: () => messages,
  projects: () => projects,
  specArtifacts: () => specArtifacts,
  stages: () => stages,
  updateStageSchema: () => updateStageSchema,
  userSettings: () => userSettings
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { uniqueIndex } from "drizzle-orm/pg-core";
var adminPrompts, legacySessions, userSettings, insertAdminPromptSchema, projects, intakeQuestions, specArtifacts, stages, messages, llmCalls, auditEvents, insertProjectSchema, CustomPromptSchema, CustomPromptsSchema, SurveyQuestionSchema, SurveyDefinitionSchema, SurveyResponseSchema, insertStageSchema, insertMessageSchema, updateStageSchema, DEFAULT_STAGES, INTERCEPTOR_PROMPTS, IdSchema, Priority, Severity, Reversibility, NeedSchema, FeatureSchema, PersonaSchema, ScenarioSchema, ScreenSchema, UXFlowSchema, DataPointSchema, IntegrationSchema, APIContractSchema, TestSchema, ADRSchema, AssumptionSchema, RiskSchema, AgentArchitecturePatternSchema, AgentAutonomyLevelSchema, AgentBuilderScaleSchema, AgentToolPermissionTierSchema, AgentToolContractSchema, AgentModelRouteSchema, AgentGuardrailSchema, AgentEvaluationSchema, AgentResearchProtocolSchema, AgentUiProtocolSchema, AgentSystemSchema, StanceBecauseClauseSchema, PivotLogEntrySchema, TRADEOFF_AXES, TradeoffWeightsSchema, ProductStateSchema, NonGoalSchema, OpenQuestionKind, OpenQuestionSchema, PlatformTargetSchema, SpecSchema, LintIssueSchema, TraceMatrixSchema;
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
    }, (table) => [
      // UNIQUE target_key — seedDefaultPrompts relies on this to avoid duplicates on re-run.
      uniqueIndex("admin_prompts_target_key_unique").on(table.targetKey)
    ]);
    legacySessions = pgTable("sessions", {
      sid: varchar("sid").primaryKey(),
      sess: jsonb("sess").notNull(),
      expire: timestamp("expire", { precision: 6 }).notNull()
    }, (table) => [
      index("IDX_sessions_expire").on(table.expire)
    ]);
    userSettings = pgTable("user_settings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      llmProvider: text("llm_provider").default("groq"),
      llmApiKey: text("llm_api_key"),
      // encrypted at rest (see server/lib/secret-crypto.ts)
      llmModel: text("llm_model").default("llama-3.3-70b-versatile"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
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
      // Adaptive intake (Phase 1, migration 0003).
      // productState — per-project working memory (tradeoff weights, pivot log, stance "because" clauses, ...).
      // traceMatrix — Need → Feature → Test/ADR backreferences populated by Phase 3 linter.
      // intakeMode — gate for adaptive vs legacy survey/minimum flows. New rows default to 'adaptive'.
      productState: jsonb("product_state"),
      traceMatrix: jsonb("trace_matrix"),
      intakeMode: text("intake_mode").notNull().default("adaptive"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    }, (table) => [
      index("projects_user_id_idx").on(table.userId),
      index("projects_guest_owner_id_idx").on(table.guestOwnerId)
    ]);
    intakeQuestions = pgTable("intake_questions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
      step: integer("step").notNull(),
      method: text("method"),
      // 'jtbd' | 'qfd' | 'pugh' | 'agent' | null for free-form
      questionText: text("question_text").notNull(),
      answerText: text("answer_text"),
      metadata: jsonb("metadata"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      answeredAt: timestamp("answered_at")
    }, (table) => [
      index("intake_questions_project_id_step_idx").on(table.projectId, table.step)
    ]);
    specArtifacts = pgTable("spec_artifacts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
      stageId: varchar("stage_id").references(() => stages.id, { onDelete: "set null" }),
      kind: text("kind").notNull(),
      version: integer("version").notNull().default(1),
      payload: jsonb("payload").notNull(),
      renderedMarkdown: text("rendered_markdown"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    }, (table) => [
      index("spec_artifacts_project_id_kind_idx").on(table.projectId, table.kind),
      index("spec_artifacts_project_id_version_idx").on(table.projectId, table.version)
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
    }, (table) => [
      index("stages_project_id_idx").on(table.projectId)
    ]);
    messages = pgTable("messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      stageId: varchar("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
      role: text("role").notNull(),
      // "user" | "assistant"
      content: text("content").notNull(),
      // kind: 'chat' = conversational turn, 'deliverable' = final generated document (PRD, spec, etc.)
      // 'system_note' reserved for future automated annotations
      kind: text("kind").notNull().default("chat"),
      // version bumps on regenerate; older versions are retained for history
      version: integer("version").notNull().default(1),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => [
      // Hot-path: message reads always filter by stage_id and order by created_at.
      index("messages_stage_id_created_at_idx").on(table.stageId, table.createdAt),
      index("messages_stage_kind_idx").on(table.stageId, table.kind)
    ]);
    llmCalls = pgTable("llm_calls", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id"),
      // nullable — guest calls won't have it
      guestOwnerId: varchar("guest_owner_id"),
      // nullable — authed calls won't have it
      projectId: varchar("project_id"),
      // nullable — some calls (survey gen) don't have a project at call time
      stageId: varchar("stage_id"),
      provider: text("provider").notNull(),
      // 'anthropic' | 'groq' | 'openai'
      model: text("model").notNull(),
      task: text("task").notNull(),
      // matches LLMTask union in ai.ts
      inputTokens: integer("input_tokens").notNull().default(0),
      outputTokens: integer("output_tokens").notNull().default(0),
      cacheReadTokens: integer("cache_read_tokens"),
      cacheWriteTokens: integer("cache_write_tokens"),
      costUsd: varchar("cost_usd"),
      // decimal-as-string to avoid float loss; numeric(12,6) in DB
      latencyMs: integer("latency_ms"),
      status: text("status").notNull(),
      // 'ok' | 'error'
      errorCode: text("error_code"),
      streamed: boolean("streamed").notNull().default(false),
      byok: boolean("byok").notNull().default(false),
      requestId: varchar("request_id"),
      // correlate with audit + logs
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => [
      index("llm_calls_user_id_created_at_idx").on(table.userId, table.createdAt),
      index("llm_calls_project_id_idx").on(table.projectId)
    ]);
    auditEvents = pgTable("audit_events", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      actorType: text("actor_type").notNull(),
      // 'user' | 'guest' | 'admin' | 'system'
      actorId: varchar("actor_id"),
      action: text("action").notNull(),
      // 'project.create' | 'project.delete' | ...
      resourceType: text("resource_type").notNull(),
      resourceId: varchar("resource_id"),
      metadata: jsonb("metadata"),
      requestId: varchar("request_id"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => [
      index("audit_events_actor_id_created_at_idx").on(table.actorId, table.createdAt),
      index("audit_events_resource_idx").on(table.resourceType, table.resourceId)
    ]);
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
      content: true,
      kind: true,
      version: true
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
    IdSchema = z.string().min(1);
    Priority = z.enum(["P0", "P1", "P2", "P3"]).optional();
    Severity = z.enum(["block", "warn", "info"]);
    Reversibility = z.enum(["high", "medium", "low"]);
    NeedSchema = z.object({
      id: IdSchema,
      title: z.string(),
      description: z.string().optional(),
      priority: Priority,
      source: z.string().optional()
      // intake question id or "inferred"
    });
    FeatureSchema = z.object({
      id: IdSchema,
      title: z.string(),
      description: z.string().optional(),
      priority: Priority,
      needIds: z.array(IdSchema).default([]),
      acceptanceCriteria: z.array(z.string()).default([])
    });
    PersonaSchema = z.object({
      id: IdSchema,
      name: z.string(),
      trigger: z.string().optional(),
      exclusions: z.array(z.string()).default([]),
      // "Who they are NOT"
      jobs: z.array(z.string()).default([])
    });
    ScenarioSchema = z.object({
      id: IdSchema,
      personaId: IdSchema.optional(),
      context: z.string(),
      goal: z.string(),
      successSignal: z.string().optional()
    });
    ScreenSchema = z.object({
      id: IdSchema,
      name: z.string(),
      purpose: z.string(),
      primaryAction: z.string().optional(),
      states: z.array(z.string()).default([])
    });
    UXFlowSchema = z.object({
      id: IdSchema,
      name: z.string(),
      steps: z.array(z.string()).default([]),
      screenIds: z.array(IdSchema).default([])
    });
    DataPointSchema = z.object({
      id: IdSchema,
      name: z.string(),
      type: z.string(),
      // free-form: "string", "uuid", "decimal(12,2)", etc.
      description: z.string().optional(),
      pii: z.boolean().default(false),
      // Required when pii=true. Linter (Phase 3) treats missing handlingNote as a
      // non-waivable block. Schema does NOT enforce here; we want the linter to
      // be the surface that explains the policy.
      handlingNote: z.string().optional()
    });
    IntegrationSchema = z.object({
      id: IdSchema,
      name: z.string(),
      purpose: z.string(),
      authMode: z.string().optional()
    });
    APIContractSchema = z.object({
      id: IdSchema,
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      path: z.string(),
      description: z.string().optional(),
      requestSchema: z.string().optional(),
      responseSchema: z.string().optional(),
      featureIds: z.array(IdSchema).default([])
    });
    TestSchema = z.object({
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
      validatorRefs: z.array(z.string()).default([])
    });
    ADRSchema = z.object({
      id: IdSchema,
      title: z.string(),
      context: z.string(),
      decision: z.string(),
      consequences: z.string().optional(),
      reversibility: Reversibility,
      // Cites tradeoff weights and stance "because" clauses (Phase 4).
      cites: z.array(z.string()).default([])
    });
    AssumptionSchema = z.object({
      id: IdSchema,
      text: z.string(),
      confidence: z.enum(["high", "medium", "low"]).default("medium")
    });
    RiskSchema = z.object({
      id: IdSchema,
      text: z.string(),
      likelihood: z.enum(["high", "medium", "low"]).default("medium"),
      impact: z.enum(["high", "medium", "low"]).default("medium"),
      mitigation: z.string().optional()
    });
    AgentArchitecturePatternSchema = z.enum([
      "single-agent",
      "sequential",
      "router",
      "orchestrator-worker",
      "evaluator-optimizer",
      "interactive",
      "multi-agent",
      "hybrid"
    ]);
    AgentAutonomyLevelSchema = z.enum([
      "draft-only",
      "human-in-loop",
      "supervised",
      "autonomous"
    ]);
    AgentBuilderScaleSchema = z.enum(["skill", "plugin", "agent", "human"]);
    AgentToolPermissionTierSchema = z.enum(["T0", "T1", "T2", "T3", "T4", "T5"]);
    AgentToolContractSchema = z.object({
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
      failureMode: z.string().optional()
    });
    AgentModelRouteSchema = z.object({
      id: IdSchema,
      purpose: z.string(),
      provider: z.string().optional(),
      modelTier: z.string().optional(),
      promptContract: z.string().optional()
    });
    AgentGuardrailSchema = z.object({
      id: IdSchema,
      appliesTo: z.array(z.string()).default([]),
      trigger: z.string(),
      check: z.string(),
      action: z.string(),
      severity: Severity.default("warn"),
      escalation: z.string().optional()
    });
    AgentEvaluationSchema = z.object({
      id: IdSchema,
      name: z.string(),
      metric: z.string(),
      coverageRefs: z.array(IdSchema).default([]),
      blocking: z.boolean().default(false)
    });
    AgentResearchProtocolSchema = z.object({
      sourcePolicy: z.string().optional(),
      evidenceStandard: z.string().optional(),
      confidencePolicy: z.string().optional(),
      citationRequired: z.boolean().default(false),
      evidenceRefs: z.array(z.string()).default([]),
      openQuestions: z.array(z.string()).default([])
    });
    AgentUiProtocolSchema = z.object({
      archetype: z.enum([
        "ai-agent-chat",
        "editor-workbench",
        "data-research-tool",
        "saas-dashboard",
        "internal-admin",
        "content-publication",
        "commerce-checkout"
      ]).optional(),
      designMode: z.string().optional(),
      userResearchQuestions: z.array(z.string()).default([]),
      highRiskFailures: z.array(z.string()).default([])
    });
    AgentSystemSchema = z.object({
      mission: z.string().optional(),
      systemBoundary: z.object({
        inScope: z.array(z.string()).default([]),
        outOfScope: z.array(z.string()).default([])
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
      traceabilityRefs: z.array(z.string()).default([])
    });
    StanceBecauseClauseSchema = z.object({
      id: IdSchema,
      category: z.enum(["privacy_data", "complexity", "cost", "category"]),
      stance: z.string(),
      // "we will not store any user audio on our servers"
      because: z.string()
      // "because this is healthcare-adjacent and trust is the moat"
    });
    PivotLogEntrySchema = z.object({
      id: IdSchema,
      at: z.string(),
      // ISO date
      summary: z.string(),
      reason: z.string().optional(),
      affects: z.array(z.string()).default([])
      // ids of needs/features the pivot touches
    });
    TRADEOFF_AXES = [
      "speed_to_alpha",
      "scalability",
      "ux_polish",
      "maintainability",
      "cost",
      "security"
    ];
    TradeoffWeightsSchema = z.object({
      speed_to_alpha: z.number().int().min(0).max(100),
      scalability: z.number().int().min(0).max(100),
      ux_polish: z.number().int().min(0).max(100),
      maintainability: z.number().int().min(0).max(100),
      cost: z.number().int().min(0).max(100),
      security: z.number().int().min(0).max(100),
      unacceptable_tradeoff: z.enum(TRADEOFF_AXES)
    }).refine(
      (w) => w.speed_to_alpha + w.scalability + w.ux_polish + w.maintainability + w.cost + w.security === 100,
      {
        message: "Tradeoff weights must sum to exactly 100 across the six axes.",
        path: ["__sum"]
      }
    );
    ProductStateSchema = z.object({
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
      agentProfile: AgentSystemSchema.optional()
    });
    NonGoalSchema = z.object({
      id: IdSchema,
      text: z.string(),
      // Required by PRD-Builder: every non-goal carries a "because" clause.
      // Phase 3 linter blocks empty `because` (waivable with reason).
      because: z.string().default("")
    });
    OpenQuestionKind = z.enum(["text", "choice"]);
    OpenQuestionSchema = z.object({
      topicId: z.string().min(1),
      prompt: z.string().min(1).max(500),
      stageId: z.string().optional(),
      stageNumber: z.number().int().optional(),
      answerKind: OpenQuestionKind.default("text"),
      answerChips: z.array(z.string().min(1).max(120)).max(8).optional(),
      feedsField: z.string().optional(),
      answeredValue: z.string().max(500).optional(),
      answeredAt: z.string().optional()
    });
    PlatformTargetSchema = z.enum([
      "web",
      "vite-spa",
      "ios",
      "macos",
      "claude-plugin",
      "agent-system"
    ]);
    SpecSchema = z.object({
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
      agentSystem: AgentSystemSchema.optional()
    });
    LintIssueSchema = z.object({
      id: IdSchema,
      rule: z.string(),
      severity: Severity,
      // Non-waivable blockers (PII without handlingNote) set this to false.
      waivable: z.boolean().default(true),
      message: z.string(),
      // Pointers back into the Spec graph.
      refs: z.array(z.object({
        kind: z.enum([
          "need",
          "feature",
          "persona",
          "scenario",
          "uxflow",
          "screen",
          "datapoint",
          "integration",
          "api",
          "test",
          "adr",
          "assumption",
          "risk",
          "non_goal",
          "stance",
          "agent"
        ]),
        id: IdSchema
      })).default([])
    });
    TraceMatrixSchema = z.object({
      // need_id → feature_ids
      needToFeatures: z.record(z.string(), z.array(IdSchema)).default({}),
      // need_id → test_ids
      needToTests: z.record(z.string(), z.array(IdSchema)).default({}),
      // feature_id → api_ids
      featureToApis: z.record(z.string(), z.array(IdSchema)).default({}),
      // adr_id → need_ids/feature_ids it justifies
      adrToTargets: z.record(z.string(), z.array(IdSchema)).default({})
    });
  }
});

// server/db.ts
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
var dbUrl, connString, pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    dbUrl = getDatabaseUrl();
    connString = dbUrl && !dbUrl.includes("sslmode=") ? dbUrl + (dbUrl.includes("?") ? "&" : "?") + "sslmode=require" : dbUrl;
    pool = connString ? new Pool({
      connectionString: connString,
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    }) : null;
    db = pool ? drizzle(pool, { schema: schema_exports }) : null;
  }
});

// server/lib/logger.ts
import pino from "pino";
var logger;
var init_logger = __esm({
  "server/lib/logger.ts"() {
    "use strict";
    logger = pino({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
      // Serverless-friendly: no transports, JSON to stdout — Vercel/Axiom/BetterStack pipe from there.
      // In dev, pretty-print for readability.
      ...process.env.NODE_ENV !== "production" && {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" }
        }
      },
      base: {
        service: "productpilot",
        env: process.env.NODE_ENV || "development"
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.password",
          "*.apiKey",
          "*.api_key",
          "*.secret"
        ],
        censor: "[REDACTED]"
      }
    });
  }
});

// server/lib/secret-crypto.ts
var secret_crypto_exports = {};
__export(secret_crypto_exports, {
  decryptSecret: () => decryptSecret,
  encryptSecret: () => encryptSecret,
  isEncryptedSecret: () => isEncryptedSecret,
  scrubSecretsDeep: () => scrubSecretsDeep,
  scrubString: () => scrubString
});
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
function getEncryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("DATA_ENCRYPTION_KEY or BETTER_AUTH_SECRET is required for secret encryption.");
  }
  return createHash("sha256").update(secret).digest();
}
function toBase64Url(value) {
  return value.toString("base64url");
}
function fromBase64Url(value) {
  return Buffer.from(value, "base64url");
}
function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(`${SECRET_PREFIX}:`);
}
function encryptSecret(value) {
  if (value == null || value === "") {
    return value ?? null;
  }
  if (isEncryptedSecret(value)) {
    return value;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [SECRET_PREFIX, toBase64Url(iv), toBase64Url(tag), toBase64Url(encrypted)].join(":");
}
function scrubSecretsDeep(value) {
  if (value === null || value === void 0) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrubSecretsDeep(item));
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = scrubSecretsDeep(v);
  }
  return out;
}
function scrubString(input) {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern.regex, pattern.replace);
  }
  return out;
}
function decryptSecret(value) {
  if (value == null || value === "") {
    return value ?? null;
  }
  if (!isEncryptedSecret(value)) {
    return value;
  }
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Encrypted secret has an unsupported format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), fromBase64Url(parts[2]));
  decipher.setAuthTag(fromBase64Url(parts[3]));
  return Buffer.concat([decipher.update(fromBase64Url(parts[4])), decipher.final()]).toString("utf8");
}
var SECRET_PREFIX, SECRET_PATTERNS;
var init_secret_crypto = __esm({
  "server/lib/secret-crypto.ts"() {
    "use strict";
    SECRET_PREFIX = "enc:v1";
    SECRET_PATTERNS = [
      // Our own encrypted-secret marker.
      { name: "encrypted-marker", regex: /enc:v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+/g, replace: "[REDACTED:enc]" },
      // Anthropic API key.
      { name: "anthropic-key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/g, replace: "[REDACTED:anthropic-key]" },
      // OpenAI API key (project + classic).
      { name: "openai-key", regex: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, replace: "[REDACTED:openai-key]" },
      // Groq API key (gsk_ prefix).
      { name: "groq-key", regex: /gsk_[A-Za-z0-9]{20,}/g, replace: "[REDACTED:groq-key]" },
      // GitHub personal access token (ghp_) and fine-grained (github_pat_).
      { name: "github-token", regex: /(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g, replace: "[REDACTED:github-token]" },
      // AWS access key id (AKIA-prefixed).
      { name: "aws-key", regex: /AKIA[A-Z0-9]{16}/g, replace: "[REDACTED:aws-key]" },
      // KEY_NAME=value style — captures things like "ANTHROPIC_API_KEY=sk-...".
      // We replace the whole match so the variable name is also stripped from logs.
      { name: "kv-pair", regex: /[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*\S+/g, replace: "[REDACTED:kv-pair]" }
    ];
  }
});

// server/storage-hybrid.ts
var storage_hybrid_exports = {};
__export(storage_hybrid_exports, {
  MemStorage: () => MemStorage,
  runWithDbActorContext: () => runWithDbActorContext,
  storage: () => storage,
  updateDbActorContext: () => updateDbActorContext
});
import { AsyncLocalStorage } from "async_hooks";
import { eq, and, ne, desc, asc, sql as sql2 } from "drizzle-orm";
function runWithDbActorContext(context, callback) {
  return dbActorContext.run(context, callback);
}
function updateDbActorContext(updates) {
  const context = dbActorContext.getStore();
  if (context) {
    Object.assign(context, updates);
  }
}
function mapLlmCallRow(row) {
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
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  };
}
function mapAuditEventRow(row) {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id ?? null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? null,
    metadata: row.metadata ?? null,
    requestId: row.request_id ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  };
}
function createStorage() {
  const hasDatabase = !!(process.env.DATABASE_URL || process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE);
  if (hasDatabase && db) {
    logger.info("Using PostgreSQL storage");
    return new PostgresStorage(db);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No database configured in production. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Refusing to fall back to in-memory storage."
    );
  }
  logger.warn("Using in-memory storage (no database configured \u2014 dev only)");
  return new MemStorage();
}
var dbActorContext, MemStorage, PostgresStorage, storage;
var init_storage_hybrid = __esm({
  "server/storage-hybrid.ts"() {
    "use strict";
    init_logger();
    init_secret_crypto();
    init_schema();
    init_prompt_content();
    init_db();
    dbActorContext = new AsyncLocalStorage();
    MemStorage = class {
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
          // Phase 1 (migration 0003): adaptive intake state.
          productState: null,
          traceMatrix: null,
          intakeMode: "adaptive",
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
      async getDeliverablesByStage(stageId) {
        return Array.from(this.messages.values()).filter((m) => m.stageId === stageId && m.kind === "deliverable").sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
      }
      async createMessage(insertMessage) {
        const message = {
          id: this.generateId(),
          kind: insertMessage.kind ?? "chat",
          version: insertMessage.version ?? 1,
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
        const settings = this.userSettingsMap.get(userId);
        if (!settings) return void 0;
        return {
          ...settings,
          llmApiKey: decryptSecret(settings.llmApiKey),
          llm_api_key: decryptSecret(settings.llm_api_key)
        };
      }
      async upsertUserSettings(userId, updates) {
        const existing = this.userSettingsMap.get(userId) || { userId, llmProvider: "groq", llmModel: "llama-3.3-70b-versatile" };
        const encryptedUpdates = { ...updates };
        if (Object.prototype.hasOwnProperty.call(encryptedUpdates, "llmApiKey")) {
          encryptedUpdates.llmApiKey = encryptSecret(encryptedUpdates.llmApiKey);
        }
        if (Object.prototype.hasOwnProperty.call(encryptedUpdates, "llm_api_key")) {
          encryptedUpdates.llm_api_key = encryptSecret(encryptedUpdates.llm_api_key);
        }
        const merged = { ...existing, ...encryptedUpdates, userId, updatedAt: /* @__PURE__ */ new Date() };
        this.userSettingsMap.set(userId, merged);
        return this.getUserSettings(userId);
      }
      // LLM Telemetry - MemStorage implementation (dev fallback, in-memory only)
      llmCallLog = [];
      async createLlmCall(call) {
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
          createdAt: /* @__PURE__ */ new Date()
        });
      }
      async listLlmCalls(filters) {
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
      async getLlmCall(id) {
        return this.llmCallLog.find((row) => row.id === id);
      }
      // Audit log - MemStorage implementation (dev fallback, in-memory only)
      auditEventLog = [];
      async createAuditEvent(event) {
        this.auditEventLog.push({
          id: this.generateId(),
          actorType: event.actorType,
          actorId: event.actorId ?? null,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId ?? null,
          metadata: event.metadata ?? null,
          requestId: event.requestId ?? null,
          createdAt: /* @__PURE__ */ new Date()
        });
      }
      async listAuditEvents(filters) {
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
      async getAuditEvent(id) {
        return this.auditEventLog.find((row) => row.id === id);
      }
      // Intake questions — MemStorage implementation (dev fallback, in-memory)
      intakeQuestionLog = [];
      async createIntakeQuestion(row) {
        const stamp = {
          id: this.generateId(),
          projectId: row.projectId,
          step: row.step,
          method: row.method ?? null,
          questionText: row.questionText,
          answerText: row.answerText ?? null,
          metadata: row.metadata ?? null,
          createdAt: /* @__PURE__ */ new Date(),
          answeredAt: row.answeredAt ?? null
        };
        this.intakeQuestionLog.push(stamp);
        return stamp;
      }
      async updateIntakeQuestionAnswer(id, answerText) {
        const row = this.intakeQuestionLog.find((r) => r.id === id);
        if (!row) return void 0;
        row.answerText = answerText;
        row.answeredAt = /* @__PURE__ */ new Date();
        return row;
      }
      async getIntakeQuestionsByProject(projectId) {
        return this.intakeQuestionLog.filter((row) => row.projectId === projectId).sort((a, b) => a.step - b.step);
      }
    };
    PostgresStorage = class {
      db;
      constructor(database) {
        this.db = database;
      }
      async withActor(operation) {
        const actor = dbActorContext.getStore();
        return await this.db.transaction(async (tx) => {
          await tx.execute(sql2`
        SELECT
          set_config('app.current_user_id', ${actor?.userId ?? ""}, true),
          set_config('app.current_guest_owner_id', ${actor?.guestOwnerId ?? ""}, true)
      `);
          return operation(tx);
        });
      }
      async createProject(insertProject) {
        return await this.withActor(async (tx) => {
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
        const result = await this.withActor(
          (tx) => tx.select().from(projects).where(eq(projects.id, id)).limit(1)
        );
        return result[0];
      }
      async getAllProjects() {
        return await this.withActor(
          (tx) => tx.select().from(projects).orderBy(desc(projects.createdAt))
        );
      }
      async getProjectsByUserId(userId) {
        return await this.withActor(
          (tx) => tx.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt))
        );
      }
      async getProjectsByGuestOwnerId(guestOwnerId) {
        return await this.withActor(
          (tx) => tx.select().from(projects).where(eq(projects.guestOwnerId, guestOwnerId)).orderBy(desc(projects.createdAt))
        );
      }
      async getUserDraft(userId) {
        const result = await this.withActor(
          (tx) => tx.select().from(projects).where(and(eq(projects.userId, userId), ne(projects.surveyPhase, "complete"))).limit(1)
        );
        return result[0];
      }
      async updateProject(id, updates) {
        const finalUpdates = { ...updates };
        if (Object.keys(finalUpdates).length > 0 && !finalUpdates.updatedAt) {
          finalUpdates.updatedAt = /* @__PURE__ */ new Date();
        }
        const [updatedProject] = await this.withActor(
          (tx) => tx.update(projects).set(finalUpdates).where(eq(projects.id, id)).returning()
        );
        return updatedProject;
      }
      async deleteProject(id) {
        const result = await this.withActor((tx) => tx.delete(projects).where(eq(projects.id, id)));
        return result.rowCount > 0;
      }
      async createStage(insertStage) {
        const [stage] = await this.withActor((tx) => tx.insert(stages).values(insertStage).returning());
        return stage;
      }
      async getStage(id) {
        const result = await this.withActor(
          (tx) => tx.select().from(stages).where(eq(stages.id, id)).limit(1)
        );
        return result[0];
      }
      async getStagesByProject(projectId) {
        return await this.withActor(
          (tx) => tx.select().from(stages).where(eq(stages.projectId, projectId))
        );
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
        const [updatedStage] = await this.withActor(
          (tx) => tx.update(stages).set(finalUpdates).where(eq(stages.id, id)).returning()
        );
        return updatedStage;
      }
      async ensureStagesForProject(projectId) {
        const existing = await this.withActor(
          (tx) => tx.select().from(stages).where(eq(stages.projectId, projectId))
        );
        if (existing.length > 0) return existing;
        const createdStages = [];
        for (const defaultStage of DEFAULT_STAGES) {
          const [stage] = await this.withActor(
            (tx) => tx.insert(stages).values({
              projectId,
              stageNumber: defaultStage.stageNumber,
              title: defaultStage.title,
              description: defaultStage.description,
              systemPrompt: defaultStage.systemPrompt,
              keyInsights: defaultStage.keyInsights || [],
              completedInsights: [],
              progress: 0,
              isUnlocked: true
            }).returning()
          );
          createdStages.push(stage);
        }
        return createdStages;
      }
      async getMessage(id) {
        const result = await this.withActor(
          (tx) => tx.select().from(messages).where(eq(messages.id, id)).limit(1)
        );
        return result[0];
      }
      async getMessagesByStage(stageId) {
        return await this.withActor(
          (tx) => tx.select().from(messages).where(eq(messages.stageId, stageId)).orderBy(asc(messages.createdAt))
        );
      }
      async getDeliverablesByStage(stageId) {
        return await this.withActor(
          (tx) => tx.select().from(messages).where(and(eq(messages.stageId, stageId), eq(messages.kind, "deliverable"))).orderBy(asc(messages.version), asc(messages.createdAt))
        );
      }
      async createMessage(insertMessage) {
        const [message] = await this.withActor(
          (tx) => tx.insert(messages).values(insertMessage).returning()
        );
        return message;
      }
      async deleteMessagesByStage(stageId) {
        await this.withActor((tx) => tx.delete(messages).where(eq(messages.stageId, stageId)));
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
        const result = await this.withActor(
          (tx) => tx.execute(sql2`SELECT * FROM user_settings WHERE user_id = ${userId} LIMIT 1`)
        );
        const settings = result.rows?.[0];
        if (!settings) return void 0;
        return {
          ...settings,
          llm_api_key: decryptSecret(settings.llm_api_key),
          llmApiKey: decryptSecret(settings.llmApiKey)
        };
      }
      async upsertUserSettings(userId, updates) {
        const existing = await this.getUserSettings(userId);
        const encryptedApiKey = updates.llmApiKey !== void 0 ? encryptSecret(updates.llmApiKey) : void 0;
        if (existing) {
          await this.withActor(
            (tx) => tx.execute(
              sql2`UPDATE user_settings SET
          llm_provider = COALESCE(${updates.llmProvider ?? null}, llm_provider),
          llm_api_key = ${encryptedApiKey !== void 0 ? encryptedApiKey : sql2`llm_api_key`},
          llm_model = COALESCE(${updates.llmModel ?? null}, llm_model),
          updated_at = NOW()
        WHERE user_id = ${userId}`
            )
          );
          return this.getUserSettings(userId);
        } else {
          await this.withActor(
            (tx) => tx.execute(
              sql2`INSERT INTO user_settings (id, user_id, llm_provider, llm_api_key, llm_model)
        VALUES (gen_random_uuid(), ${userId}, ${updates.llmProvider || "groq"}, ${encryptedApiKey ?? null}, ${updates.llmModel || "llama-3.3-70b-versatile"})`
            )
          );
          return this.getUserSettings(userId);
        }
      }
      // LLM Telemetry - PostgresStorage implementation
      async createLlmCall(call) {
        await this.db.insert(llmCalls).values(call);
      }
      // Admin observability: list LLM calls with filters + pagination.
      // Reads are admin-only (no actor-scoped RLS needed; admin endpoint gates access).
      // Uses raw SQL to avoid pulling drizzle-orm's where-builder chain into this read.
      async listLlmCalls(filters) {
        const limit = Math.min(filters.limit ?? 50, 200);
        const offset = filters.offset ?? 0;
        const clauses = [];
        if (filters.userId) clauses.push(sql2`user_id = ${filters.userId}`);
        if (filters.guestOwnerId) clauses.push(sql2`guest_owner_id = ${filters.guestOwnerId}`);
        if (filters.projectId) clauses.push(sql2`project_id = ${filters.projectId}`);
        if (filters.stageId) clauses.push(sql2`stage_id = ${filters.stageId}`);
        if (filters.provider) clauses.push(sql2`provider = ${filters.provider}`);
        if (filters.model) clauses.push(sql2`model = ${filters.model}`);
        if (filters.task) clauses.push(sql2`task = ${filters.task}`);
        if (filters.status) clauses.push(sql2`status = ${filters.status}`);
        const whereSql = clauses.length ? sql2`WHERE ${sql2.join(clauses, sql2` AND `)}` : sql2``;
        const rowsResult = await this.db.execute(
          sql2`SELECT * FROM llm_calls ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
        );
        const totalResult = await this.db.execute(
          sql2`SELECT COUNT(*)::int AS count FROM llm_calls ${whereSql}`
        );
        const rows = rowsResult.rows.map(mapLlmCallRow);
        const total = Number(totalResult.rows[0]?.count ?? 0);
        return { rows, total };
      }
      async getLlmCall(id) {
        const result = await this.db.execute(sql2`SELECT * FROM llm_calls WHERE id = ${id} LIMIT 1`);
        const row = result.rows[0];
        return row ? mapLlmCallRow(row) : void 0;
      }
      // Audit log - PostgresStorage implementation
      async createAuditEvent(event) {
        await this.db.insert(auditEvents).values(event);
      }
      async listAuditEvents(filters) {
        const limit = Math.min(filters.limit ?? 50, 200);
        const offset = filters.offset ?? 0;
        const clauses = [];
        if (filters.actorType) clauses.push(sql2`actor_type = ${filters.actorType}`);
        if (filters.actorId) clauses.push(sql2`actor_id = ${filters.actorId}`);
        if (filters.action) clauses.push(sql2`action = ${filters.action}`);
        if (filters.resourceType) clauses.push(sql2`resource_type = ${filters.resourceType}`);
        if (filters.resourceId) clauses.push(sql2`resource_id = ${filters.resourceId}`);
        const whereSql = clauses.length ? sql2`WHERE ${sql2.join(clauses, sql2` AND `)}` : sql2``;
        const rowsResult = await this.db.execute(
          sql2`SELECT * FROM audit_events ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
        );
        const totalResult = await this.db.execute(
          sql2`SELECT COUNT(*)::int AS count FROM audit_events ${whereSql}`
        );
        const rows = rowsResult.rows.map(mapAuditEventRow);
        const total = Number(totalResult.rows[0]?.count ?? 0);
        return { rows, total };
      }
      async getAuditEvent(id) {
        const result = await this.db.execute(sql2`SELECT * FROM audit_events WHERE id = ${id} LIMIT 1`);
        const row = result.rows[0];
        return row ? mapAuditEventRow(row) : void 0;
      }
      // Intake questions — Phase 2. RLS on intake_questions inherits from projects via
      // the policy in migration 0003; withActor() sets the GUCs that policy reads.
      async createIntakeQuestion(row) {
        const [inserted] = await this.withActor(
          (tx) => tx.insert(intakeQuestions).values(row).returning()
        );
        return inserted;
      }
      async updateIntakeQuestionAnswer(id, answerText) {
        const [updated] = await this.withActor(
          (tx) => tx.update(intakeQuestions).set({ answerText, answeredAt: /* @__PURE__ */ new Date() }).where(eq(intakeQuestions.id, id)).returning()
        );
        return updated;
      }
      async getIntakeQuestionsByProject(projectId) {
        return await this.withActor(
          (tx) => tx.select().from(intakeQuestions).where(eq(intakeQuestions.projectId, projectId)).orderBy(asc(intakeQuestions.step))
        );
      }
    };
    storage = createStorage();
  }
});

// shared/prompts/docs/brief.ts
var init_brief = __esm({
  "shared/prompts/docs/brief.ts"() {
    "use strict";
  }
});

// shared/prompts/docs/prd.ts
var init_prd = __esm({
  "shared/prompts/docs/prd.ts"() {
    "use strict";
  }
});

// shared/prompts/docs/ux.ts
var init_ux = __esm({
  "shared/prompts/docs/ux.ts"() {
    "use strict";
  }
});

// shared/prompts/docs/functional.ts
var init_functional = __esm({
  "shared/prompts/docs/functional.ts"() {
    "use strict";
  }
});

// shared/prompts/docs/handoff.ts
var init_handoff = __esm({
  "shared/prompts/docs/handoff.ts"() {
    "use strict";
  }
});

// shared/prompts/intake/method-router.ts
var METHOD_ROUTER_PROMPT_CONTENT, promptModule, method_router_default;
var init_method_router = __esm({
  "shared/prompts/intake/method-router.ts"() {
    "use strict";
    METHOD_ROUTER_PROMPT_CONTENT = `You are ProductPilot's intake method router. Pick exactly ONE of four analytical methods to drive the next intake question.

THE FOUR METHODS

jtbd \u2014 Jobs To Be Done
  Use when: persona, trigger, or core "job" is still vague. Output of this step: a "When [trigger], I want to [job], so I can [outcome]" framing.
  Signals to pick this: user description names a vague audience ("people who want to be more productive"), no observable trigger, multiple competing personas mashed together.

qfd \u2014 lightweight Quality Function Deployment
  Use when: persona is locked but feature priorities are unclear. Output of this step: which need has highest weight given the personas you already have.
  Signals to pick this: features list exists, persona/trigger is concrete, but the user has not said which feature MOST advances which job. NOT the full House of Quality \u2014 you only weight persona \xD7 need \xD7 feature triplets.
  Skip qfd if features[] is empty; route to jtbd to populate need-discovery first.

pugh \u2014 Pugh concept selection matrix
  Use when: two or more candidate approaches/architectures/UX flows exist and the choice is unresolved. Output of this step: which alternative wins on the user's tradeoff weights.
  Signals to pick this: user has named \u22652 distinct ways to solve the same need ("we could do X or Y"), or the spec contains ADRs marked "decision pending", or there are \u22652 features serving the same need with different stances.

agent \u2014 agent-system contract
  Use when: the product is an agent, copilot, plugin, workflow automator, research assistant, tool-using AI system, or multi-agent system and the missing requirement is about mission boundary, autonomy, tools, permissions, memory, state, topology, guardrails, evals, evidence policy, or UI control surface.
  Signals to pick this: platformTarget is agent-system; spec.agentSystem exists but is incomplete; productState.agentProfile exists but is incomplete; blockingTopUnknowns[0].topic starts with "agent_"; product description or answers mention agents/tool use/autonomy/plugins/MCP/research assistant.

INPUT
You receive a JSON object with:
  - productState: current working memory (intake answers so far, stance, tradeoff weights, pivots).
  - spec: current Spec graph \u2014 needs, features, personas, scenarios, ADRs (read-only).
  - lastQuestion: the question just answered, if any (to detect direct follow-up signal).
  - blockingTopUnknowns: array of {topic, evidence_score, reversibility_score, risk_score} from the blocking-scorer \u2014 already-prioritized unknowns the controller wants to address next.

DECISION RULE (in priority order \u2014 first match wins)

  1. If the highest-weighted blocking unknown topic starts with "agent_" OR platformTarget is "agent-system" and agentSystem is incomplete \u2192 agent.
  2. If personas is empty OR every persona lacks a concrete trigger \u2192 jtbd.
  3. If \u22652 ADRs are marked "decision pending" OR \u22652 features serve the same need \u2192 pugh.
  4. If features[] is non-empty AND tradeoffWeights are populated AND no need has a primary feature \u2192 qfd.
  5. Otherwise: pick the method that the highest-weighted blocking unknown most naturally calls for. Prefer jtbd when in doubt \u2014 it is the cheapest correction.

OUTPUT
Respond with ONLY a single valid JSON object \u2014 no markdown fences, no preamble:

{"method": "jtbd" | "qfd" | "pugh" | "agent", "reason": "<one sentence \u2014 name the rule that fired and the field that triggered it>"}

CONSTRAINTS
- Exactly one method. Never an array, never null, never two.
- The "reason" must reference a concrete signal from the input (a field, a count, an empty array). Vague reasons ("seems like jtbd") fail the determinism gate.
- If you cannot pick confidently, default to jtbd and say so in reason: "low confidence \u2014 defaulting to jtbd per Rule 4 fallback."
- Do not invent state that is not in the input. If personas is missing, treat it as empty.

ACCEPTANCE
- The decision is reproducible \u2014 same input \u2192 same method.
- The reason cites a field or count from the input.
- The output parses with JSON.parse and exactly matches the shape above.`;
    promptModule = {
      key: "intake.method_router",
      version: "0.1.0",
      content: METHOD_ROUTER_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 22/25 [Accuracy:5 Clarity:5 Constraints:4 Determinism:4 Completeness:4].
      prompt_builder_score: 22,
      prompt_builder_revision: 2,
      prompt_builder_run_at: "2026-05-02",
      prompt_builder_notes: "22/25. T2 classification. Haiku-tier (now Groq llama-3.1-8b-instant \u2014 see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot example, no-fit escape hatch, tie-break documentation."
    };
    method_router_default = promptModule;
  }
});

// shared/prompts/intake/blocking-scorer.ts
var BLOCKING_SCORER_PROMPT_CONTENT, promptModule2, blocking_scorer_default;
var init_blocking_scorer = __esm({
  "shared/prompts/intake/blocking-scorer.ts"() {
    "use strict";
    BLOCKING_SCORER_PROMPT_CONTENT = `You are ProductPilot's blocking-question scorer. Each candidate unknown gets three numeric scores so the IntakeController can decide which to ASK and which to INFER with safe defaults.

THE THREE AXES (each 0\u20135, integer only)

evidence \u2014 How much signal do we already have from the user about this unknown?
  0  No signal. Nothing in productState, intake answers, or supplied context speaks to it.
  1  Adjacent signal only \u2014 user mentioned something nearby but not this.
  2  Indirect inference possible \u2014 could be guessed from one stated fact.
  3  Partial direct signal \u2014 user touched on it but left it ambiguous.
  4  Strong direct signal \u2014 user has stated a stance but not the specific value.
  5  Direct quote on file \u2014 verbatim user statement settles the question.

reversibility \u2014 If we lock in the WRONG default and discover the mistake later, how cheaply can we change it?
  0  Irreversible. Public commitment, regulatory, schema migration that loses data, third-party contract.
  1  Very expensive. Multi-stage refactor, customer notification, multi-week rebuild.
  2  Costly. Cross-team coordination needed; multiple files; possible breakage.
  3  Modest. One PR, well-scoped tests; no user-visible disruption.
  4  Cheap. Single-file edit; no migration; no comms needed.
  5  Trivial. Toggle a config; revert the line; no observable effect.

risk \u2014 If we infer wrong on this and proceed, how severe is the downstream failure?
  0  Cosmetic. Mismatched copy, low-stakes UI choice.
  1  Annoying. Minor user friction; recoverable with a hint.
  2  Functional. A flow takes more steps than ideal; users complete it but complain.
  3  Loss-bearing. Specific user segment loses access or has to redo work.
  4  Trust-bearing. Privacy/data confusion, billing surprise, dropped data.
  5  Catastrophic. Compliance violation, security breach, brand event, data loss.

INPUT
You receive a JSON object with:
  - productState: working memory so far.
  - spec: current Spec graph (read-only).
  - candidates: array of {topic, why_it_matters} unknowns the controller wants ranked.

For EACH candidate, score the three axes against the supplied state.

OUTPUT
Respond with ONLY a single valid JSON array of objects in the SAME ORDER as candidates:

[
  {
    "topic": "<verbatim from candidate>",
    "evidence": <0..5 integer>,
    "reversibility": <0..5 integer>,
    "risk": <0..5 integer>,
    "blocking": <evidence and reversibility transformed; computed as (5 - evidence) + (5 - reversibility) + risk>,
    "decision": "ask" | "infer",
    "reason": "<one sentence \u2014 what evidence you used; what makes it ask-worthy or infer-safe>"
  },
  ...
]

DECISION RULE
  - blocking >= 6  \u2192 "ask"   (high cost of being wrong, low signal yet)
  - blocking <  6  \u2192 "infer" (the controller will use safe-defaults-inferer for this topic)

CONSTRAINTS
- All three axis scores are integers 0\u20135 inclusive. No floats. No negative numbers.
- The "blocking" field is the deterministic formula \u2014 DO NOT reinterpret. The controller cross-checks.
- The output array length equals the input candidates length, in the same order. No skipping.
- The "reason" must cite a specific input fact ("personas[0].trigger empty", "tradeoffWeights.security=0.5"). Vague reasons ("seems risky") fail.
- If two axis scores are tied, prefer the more conservative interpretation: lower evidence, lower reversibility, higher risk.

ACCEPTANCE
- Reproducible: same input \u2192 same scores \xB1 0.
- Output parses with JSON.parse and exactly matches the shape above.
- All decision values are exactly "ask" or "infer" (no other strings, no booleans).
- Edge case \u2014 if a candidate has zero context to score against, evidence=0, reversibility=0, risk=5 (always ask in pure ignorance).`;
    promptModule2 = {
      key: "intake.blocking_scorer",
      version: "0.1.0",
      content: BLOCKING_SCORER_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 22/25 [Accuracy:5 Clarity:4 Constraints:5 Determinism:4 Completeness:4].
      prompt_builder_score: 22,
      prompt_builder_revision: 2,
      prompt_builder_run_at: "2026-05-02",
      prompt_builder_notes: "22/25. T2 scoring. Haiku-tier (now Groq llama-3.1-8b-instant \u2014 see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot worked example, threshold-tuning rationale, evidence-on-file short-circuit."
    };
    blocking_scorer_default = promptModule2;
  }
});

// shared/prompts/intake/safe-defaults.ts
var SAFE_DEFAULTS_PROMPT_CONTENT, promptModule3, safe_defaults_default;
var init_safe_defaults = __esm({
  "shared/prompts/intake/safe-defaults.ts"() {
    "use strict";
    SAFE_DEFAULTS_PROMPT_CONTENT = `You are ProductPilot's safe-defaults inferer. The blocking-scorer marked these topics as "low cost of being wrong". Your job: pick a sensible default for each, with confidence and rationale, so the user can challenge it instead of answering from scratch.

INPUT
You receive a JSON object with:
  - productState: working memory so far (intake answers, stance, tradeoff weights).
  - spec: current Spec graph (read-only).
  - topics: array of {topic, why_it_matters, evidence_score, reversibility_score, risk_score} \u2014 each topic was already scored as INFER (blocking < 6).

OUTPUT
Respond with ONLY a single valid JSON array of objects, SAME ORDER as topics:

[
  {
    "topic": "<verbatim from input>",
    "default": "<the value you propose \u2014 string or short JSON literal>",
    "confidence": "high" | "medium" | "low",
    "rationale": "<one sentence \u2014 name the existing input fact OR the convention you applied>",
    "challenge_prompt": "<one short question the user can click to challenge \u2014 phrased to be easy to override>"
  },
  ...
]

CONSTRAINTS \u2014 read carefully

A. PII non-inference rule (HARD)
   Do NOT infer values for any of:
     - Personal name, email, phone number, mailing address, geolocation
     - Date of birth, age, gender, race, ethnicity
     - Healthcare diagnoses, treatments, conditions
     - Financial account numbers, payment card data, SSN-shaped strings, tax IDs
     - Government-issued ID numbers
   For any topic that touches these, output: {"topic": "...", "default": null, "confidence": "low",
     "rationale": "PII field \u2014 must be supplied by user, never inferred", "challenge_prompt": "Please enter this value directly."}
   This rule is non-waivable and is enforced again in the Phase 3 spec linter.

B. Cite the source
   "rationale" must reference EITHER a concrete input fact (e.g. "tradeoffWeights.cost = 0.4") OR a named convention
   (e.g. "common B2B SaaS default", "WCAG 2.2 AA baseline"). Vague rationales ("seems reasonable") fail.

C. Confidence calibration
   - high     The default follows directly from a stated user fact or a strong industry standard for this archetype.
   - medium   Reasonable default with one or two assumptions about the archetype.
   - low      Best guess with significant uncertainty; user should review.
   When in doubt: prefer "medium" over "high".

D. The challenge_prompt is the user-facing CTA
   It appears below the inferred value with a "Challenge" button. Phrase it so clicking it leads to a productive conversation:
     Bad:  "Is this right?"
     Good: "If your team handles bursty traffic patterns, you may want a different cache TTL \u2014 tell me how often your data changes."

E. Do not invent state
   If you have no signal at all and the topic is not PII-bound, output confidence: "low" with a rationale that names the gap
   ("no archetype hint in productState \u2014 falling back to consumer-app baseline"). The IntakeController will surface this as
   "Inferred (low confidence) \u2014 please review" in the UI.

F. Output is structured
   No commentary, no markdown fences, no preamble. The first character of the output is "[" and the last character is "]".
   Each topic in the input MUST appear in the output, in the same order. No skipping, no merging.

ACCEPTANCE
- The output array length equals the input topics length, same order.
- Every PII-shaped topic produces default=null with the canonical PII rationale.
- Every non-PII topic produces a non-null default with a cited rationale.
- The output parses with JSON.parse.`;
    promptModule3 = {
      key: "intake.safe_defaults",
      version: "0.1.0",
      content: SAFE_DEFAULTS_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 21/25 [Accuracy:5 Clarity:4 Constraints:5 Determinism:4 Completeness:3].
      prompt_builder_score: 21,
      prompt_builder_revision: 2,
      prompt_builder_run_at: "2026-05-02",
      prompt_builder_notes: "21/25. T2 inference. Haiku-tier (now Groq llama-3.1-8b-instant \u2014 see r2 routing override 2026-05-02). Lowest Completeness=3 (above 2-blocker threshold). Phase 3 follow-ups: 1-shot example, archetype-keyed default library, confidence calibration doc."
    };
    safe_defaults_default = promptModule3;
  }
});

// shared/prompts/methods/jtbd.ts
var JTBD_PROMPT_CONTENT, promptModule4, jtbd_default;
var init_jtbd = __esm({
  "shared/prompts/methods/jtbd.ts"() {
    "use strict";
    JTBD_PROMPT_CONTENT = `You are ProductPilot's JTBD interviewer. The method-router routed this step to JTBD because the persona, trigger, or outcome chain is not yet concrete enough.

GOAL
Ask ONE question whose answer most cheaply fills the biggest gap in the JTBD trio:
  - persona:   WHO reaches for this product
  - trigger:   the observable moment they reach for it
  - outcome:   the measurable change they want afterwards

INPUT
You receive a JSON object with:
  - productState: working memory (existing answers, stance, etc.)
  - spec: current Spec graph \u2014 personas[], scenarios[] are the relevant slices.
  - intakeAnswersSoFar: array of {step, method, question, answer} from prior intake turns.
  - askedJtbdSlots: array of slot strings the controller has already recorded as answered.
                    Treat these as filled \u2014 pick the next-most-blocking unfilled slot.

DECISION RULE
1. If personas[].length is 0 OR all personas have empty trigger \u2192 ask about the trigger.
   "When does someone realize they need this product? Be as specific as you can \u2014 what are they doing in the moments BEFORE they reach for it?"
2. Else if no persona has exclusions[] populated (i.e. "who are they NOT") \u2192 ask about exclusions.
   "Who is this product NOT for? Name three groups of people who might seem like obvious users but should not be your target."
3. Else if no scenario has a measurable outcome (goal must be N-week observable change) \u2192 ask about the outcome.
   "After [N weeks] of using this product, what is the single observable change in the user's behavior or state? Avoid 'feels better' \u2014 pick something a third party could verify."
4. Else \u2192 ask the highest-impact follow-up that sharpens the existing JTBD. The
   follow-up MUST still target one of the 7 known slots (see SLOT TABLE below).
   You cannot emit a follow-up without a slot \u2014 every question feeds structured
   spec state, never a free-form shelf.

SLOT TABLE (every output's "topic" field MUST be exactly one of these strings)
  - persona      \u2014 WHO this is for (persona[].name). spec_path: personas[*].name
  - trigger      \u2014 when they reach for it. spec_path: personas[*].trigger
  - exclusions   \u2014 who this is NOT for. spec_path: personas[*].exclusions
  - outcome      \u2014 verifiable N-week change. spec_path: scenarios[*].successSignal
                   OR scenarios[*].goal OR scenarios[*].context
  - jobs         \u2014 concrete tasks the persona does. spec_path: personas[*].jobs
  - non_goals    \u2014 explicit out-of-scope items. spec_path: nonGoals[*].text
  - priority     \u2014 which need is the P0 must-have. spec_path: needs[*].priority

RULE \u2192 DEFAULT TOPIC MAPPING
  rule_fired = "1"  \u2192  topic = "trigger",     spec_path = "personas[*].trigger"
  rule_fired = "2"  \u2192  topic = "exclusions",  spec_path = "personas[*].exclusions"
  rule_fired = "3"  \u2192  topic = "outcome",     spec_path = "scenarios[*].successSignal"
  rule_fired = "4"  \u2192  topic = one of {jobs, persona, outcome, exclusions, non_goals, priority}
                       spec_path = the SLOT TABLE row's spec_path for that topic

OUTPUT (structured, the IntakeController persists this verbatim into productState)
Respond with ONLY a single valid JSON object \u2014 no markdown fences, no preamble:

{
  "method": "jtbd",
  "question": "<the user-facing question \u2014 one sentence, conversational, no jargon>",
  "rule_fired": "1" | "2" | "3" | "4",
  "topic": "persona" | "trigger" | "exclusions" | "outcome" | "jobs" | "non_goals" | "priority",
  "chips": ["<short chip suggestion 1>", "<short chip suggestion 2>", "<short chip suggestion 3>"],
  "extracts_into": {
    "spec_path": "personas[*].name" | "personas[*].trigger" | "personas[*].exclusions" | "personas[*].jobs" | "scenarios[*].goal" | "scenarios[*].successSignal" | "scenarios[*].context" | "nonGoals[*].text" | "needs[*].priority",
    "kind": "string" | "array<string>",
    "merge_strategy": "append" | "replace"
  },
  "intent": "<one sentence \u2014 why this question is the highest-leverage move RIGHT NOW given the current state>"
}

CHIP SUGGESTIONS
Chips are tappable shortcut answers under the question. Provide three.
- Each chip is a concrete example phrase the user can tap to start their answer.
- Do NOT use chips as the WHOLE answer \u2014 they are starters that prefill the input.
- Examples for trigger: ["Right after a sales call", "When their inbox crosses 50 unread", "End of every sprint"].
- Examples for exclusions: ["Enterprise procurement teams", "Casual hobbyists under 5 yrs experience", "Users who want full customization"].
- Examples for outcome: ["Closes 80% of inbox by 9am", "Ships PR in <2 days vs 5", "Cancels 3 of 5 calendar holds"].
The chips should be archetype-appropriate: read productState.workingMemory.archetype if present.

WORKED EXAMPLE \u2014 rule_fired = "4" (free-form follow-up, slot-aware)
State: persona "Solo runner" has trigger="planning a long run", exclusions ["pros", "groups", "bikers"],
       scenario successSignal "estimates pace within \xB115s/km on hilly routes".
       Trio is filled. The next gap is concrete jobs the persona does inside the product.
Output:
{
  "method": "jtbd",
  "question": "What are the top three things a solo runner does inside RouteMath in a single planning session?",
  "rule_fired": "4",
  "topic": "jobs",
  "chips": ["Drop waypoints on a map", "Read grade-adjusted pace", "Export GPX before heading out"],
  "extracts_into": { "spec_path": "personas[*].jobs", "kind": "array<string>", "merge_strategy": "append" },
  "intent": "Trio is locked. Capturing the top three jobs is the cheapest way to feed personas[].jobs so brief.ts can render the JTBD statement."
}

CONSTRAINTS
- Exactly ONE question. Never multiple. Never compound ("X and Y?").
- The question is conversational \u2014 it does NOT explain JTBD or use the word "JTBD" or "trigger" without context.
- "topic" MUST be one of the 7 slot strings \u2014 no synonyms, no rewording, no creative variants.
- "extracts_into.spec_path" MUST match the topic per the SLOT TABLE. Mismatched topic\u2194spec_path is invalid.
- Read intakeAnswersSoFar AND askedJtbdSlots to avoid asking something already answered. Any slot string that appears in askedJtbdSlots is OFF-LIMITS \u2014 pick a different slot from the SLOT TABLE. If every slot in the SLOT TABLE is in askedJtbdSlots, fall back to topic="jobs" with a question that adds a new concrete job (jobs is naturally append-many).
- Never invent state. If the JSON inputs say a slot is filled, treat it as filled.
- Chip suggestions are short (\u22648 words each).

ACCEPTANCE
- The next-step output passes JSON.parse.
- "rule_fired" matches the actual rule \u2014 no skipping (you cannot say "fired rule 4" if rule 1 still applies).
- "topic" is exactly one of the 7 SLOT TABLE entries.
- "extracts_into.spec_path" is the SLOT TABLE entry for the chosen topic.
- The question, after the user answers it, can be parsed into a value at the named spec_path.`;
    promptModule4 = {
      key: "methods.jtbd",
      version: "0.2.0",
      content: JTBD_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 23/25 [Accuracy:5 Clarity:5 Constraints:5 Determinism:4 Completeness:4].
      prompt_builder_score: 23,
      prompt_builder_revision: 3,
      prompt_builder_run_at: "2026-05-03",
      prompt_builder_notes: "23/25. Slot-aware rule-4: all rules emit topic from a 7-slot enum + spec_path. Constraints lifted 4\u21925 because rule-4 is no longer free-form. Phase 3 follow-ups: chip-suggestion heuristics (Completeness 4\u21925), trigger-vs-outcome 1-shot (Determinism 4\u21925)."
    };
    jtbd_default = promptModule4;
  }
});

// shared/prompts/methods/qfd.ts
var QFD_PROMPT_CONTENT, promptModule5, qfd_default;
var init_qfd = __esm({
  "shared/prompts/methods/qfd.ts"() {
    "use strict";
    QFD_PROMPT_CONTENT = `You are ProductPilot's lightweight QFD interviewer. The method-router routed here because personas exist, features exist, and the relative weight of features-per-need is unclear.

GOAL
Ask ONE question that resolves the highest-leverage persona \xD7 need \xD7 feature weight ambiguity.

LIGHTWEIGHT QFD (the version we ship)
We do NOT build a full House of Quality. We score one persona \xD7 need \xD7 feature triplet per question.
Each turn asks: "For [persona], when they [need], how much does [feature] help \u2014 high, medium, low, or not at all?"
The IntakeController persists the answer as a weight on the matching feature.

INPUT
You receive a JSON object with:
  - productState: working memory.
  - spec: current Spec graph \u2014 personas[], needs[], features[].
  - existingWeights: object mapping "persona_id::need_id::feature_id" \u2192 "high"|"medium"|"low"|"none" for previously-resolved triplets.
  - intakeAnswersSoFar: prior intake turns.

PRECONDITIONS (validate before generating a question)
- spec.personas.length >= 1 (at least one persona)
- spec.features.length >= 1 (at least one feature)
- spec.needs.length >= 1 (at least one need)

If any precondition fails, OUTPUT THE PASSTHROUGH:
{
  "method": "qfd",
  "passthrough": true,
  "reason": "<which precondition failed; cite the field>",
  "suggested_method": "jtbd"
}
The IntakeController will re-route on passthrough=true. Do NOT invent personas/needs/features to satisfy preconditions.

DECISION RULE (which triplet to ask about)
1. List all (persona, need, feature) triplets where need_id \u2208 feature.needIds.
2. Filter to triplets NOT already in existingWeights.
3. Among the remaining, rank by:
   - Need priority (P0 > P1 > P2 > P3) \u2014 higher priority first.
   - Persona index (personas[0] first \u2014 user listed it first for a reason).
   - Feature index.
4. Pick the top triplet. That is the subject of the question.

OUTPUT (structured)
{
  "method": "qfd",
  "passthrough": false,
  "question": "<the user-facing question \u2014 one sentence, names persona, need, and feature concretely>",
  "triplet": {
    "personaId": "<persona.id>",
    "needId": "<need.id>",
    "featureId": "<feature.id>"
  },
  "chips": ["High \u2014 core to the job", "Medium \u2014 useful but not essential", "Low \u2014 nice-to-have only", "Not at all"],
  "extracts_into": {
    "spec_path": "features[*].acceptanceCriteria",
    "kind": "weight",
    "merge_strategy": "weight_map"
  },
  "intent": "<one sentence \u2014 why this triplet is highest-leverage given existing weights and need priority>"
}

CHIP CONVENTION
The four chips above are FIXED for QFD. Do not reword them. The IntakeController matches on exact string to convert chip \u2192 weight.

CONSTRAINTS
- Exactly ONE question. Never compound.
- Name the persona by name, not by id, in the question text. Same for need and feature.
- The question must be answerable with one of the four chips alone. The user can elaborate, but they should not need to.
- Do NOT ask about a triplet that has an entry in existingWeights \u2014 even if you disagree with the prior answer.
- Phase 3 will surface conflicting weights in the linter; Phase 2 just collects them.

ACCEPTANCE
- Output parses with JSON.parse.
- triplet.personaId, triplet.needId, triplet.featureId all reference real entries in spec.
- The four chips are present, in order, with the canonical strings.
- If passthrough=true, no triplet field is required.`;
    promptModule5 = {
      key: "methods.qfd",
      version: "0.1.0",
      content: QFD_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 21/25 [Accuracy:5 Clarity:4 Constraints:4 Determinism:4 Completeness:4].
      prompt_builder_score: 21,
      prompt_builder_revision: 2,
      prompt_builder_run_at: "2026-05-02",
      prompt_builder_notes: "21/25. T2 question-gen. Haiku-tier (now Groq llama-3.1-8b-instant \u2014 see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot weighting example, lightweight-vs-full-QFD doc, fallback-when-no-features explicit path."
    };
    qfd_default = promptModule5;
  }
});

// shared/prompts/methods/pugh.ts
var PUGH_PROMPT_CONTENT, promptModule6, pugh_default;
var init_pugh = __esm({
  "shared/prompts/methods/pugh.ts"() {
    "use strict";
    PUGH_PROMPT_CONTENT = `You are ProductPilot's Pugh concept-selection interviewer. The method-router routed here because the spec contains two or more alternative approaches to the same need or decision and the choice is unresolved.

GOAL
Ask ONE question that scores ONE candidate alternative against ONE criterion, relative to a baseline alternative.

PUGH MATRIX SHAPE (the version we ship)
- Rows: candidate alternatives (e.g. "REST monolith", "GraphQL + microservices", "edge functions").
- Columns: decision criteria (derived from tradeoffWeights and stance "because" clauses).
- Cells: "+ better than baseline", "0 same", "- worse than baseline".
- Baseline: the FIRST alternative in the list (alternatives[0]).
- Final winner: highest column-sum across all criteria.

INPUT
You receive a JSON object with:
  - productState: working memory \u2014 tradeoffWeights and stanceBecauseClauses are the relevant slices.
  - spec: current Spec graph \u2014 adrs[] (especially "decision pending"), features[].
  - alternatives: array of {id, label, description} candidate alternatives the controller has identified.
  - criteria: array of criterion strings derived from tradeoffWeights (e.g. "speed_to_alpha", "ux_polish", "security").
  - existingScores: object mapping "alternative_id::criterion" \u2192 "+" | "0" | "-" for resolved cells.

PRECONDITIONS
- alternatives.length >= 2.
- criteria.length >= 1.

If a precondition fails:
{
  "method": "pugh",
  "passthrough": true,
  "reason": "<which precondition failed; cite the count>",
  "suggested_method": "jtbd" | "qfd"
}
DO NOT invent alternatives or criteria. The IntakeController will re-route.

DECISION RULE (which cell to ask about)
1. Identify the baseline = alternatives[0]. The baseline's row is fixed at "0" for every criterion (relative to itself).
2. List all (alternative, criterion) pairs WHERE alternative.id != baseline.id AND no entry in existingScores yet.
3. Among the remaining, rank by:
   - Criterion weight (read tradeoffWeights[criterion] if it matches a weight key) \u2014 higher weights first.
   - Alternative index in alternatives[].
4. Pick the top cell. That is the subject of the question.

OUTPUT (structured)
{
  "method": "pugh",
  "passthrough": false,
  "question": "<the user-facing question \u2014 name baseline, candidate, and criterion concretely>",
  "cell": {
    "alternativeId": "<alternative.id, the candidate being scored>",
    "baselineId": "<alternatives[0].id, for reference>",
    "criterion": "<the criterion string>"
  },
  "chips": ["Better (+)", "Same (0)", "Worse (-)"],
  "extracts_into": {
    "spec_path": "adrs[*].cites",
    "kind": "pugh_cell",
    "merge_strategy": "score_map"
  },
  "intent": "<one sentence \u2014 why this cell is highest-leverage given criterion weight and unfilled cells>"
}

QUESTION SHAPE
"Compared to [baseline.label], does [candidate.label] do BETTER, the SAME, or WORSE on [criterion]?"
You may add a one-sentence framing if the criterion needs context (e.g. "Security here means data-at-rest encryption and audit logging \u2014 the choice we made in stance.privacy_data.")

CHIP CONVENTION
The three chips above are FIXED for Pugh. Do not reword them. The IntakeController parses on exact string match.

CONSTRAINTS
- Exactly ONE question, ONE cell. Never compound, never two criteria at once.
- Name baseline, candidate, and criterion explicitly in the question. The user should not have to guess.
- If a previous question's answer makes a cell-decision irrelevant (e.g. an alternative was just ruled out), skip ahead and pick the next-highest-priority cell among remaining alternatives.
- Do NOT ask about a cell already in existingScores.

ACCEPTANCE
- Output parses with JSON.parse.
- cell.alternativeId, cell.baselineId, cell.criterion all reference real input values.
- cell.alternativeId !== cell.baselineId.
- The three chips are present, in order, with the canonical strings.
- If passthrough=true, no cell field is required.`;
    promptModule6 = {
      key: "methods.pugh",
      version: "0.1.0",
      content: PUGH_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 21/25 [Accuracy:5 Clarity:4 Constraints:4 Determinism:4 Completeness:4].
      prompt_builder_score: 21,
      prompt_builder_revision: 2,
      prompt_builder_run_at: "2026-05-02",
      prompt_builder_notes: "21/25. T2 question-gen. Haiku-tier (now Groq llama-3.1-8b-instant \u2014 see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot Pugh matrix example, Pugh-vs-AHP discrimination, criteria-derivation-from-weights doc."
    };
    pugh_default = promptModule6;
  }
});

// shared/prompts/methods/agent.ts
var AGENT_PROMPT_CONTENT, promptModule7, agent_default;
var init_agent = __esm({
  "shared/prompts/methods/agent.ts"() {
    "use strict";
    AGENT_PROMPT_CONTENT = `You are ProductPilot's agent-system interviewer.

The controller routed this step to the agent method because the next blocking unknown is about an agent harness: mission boundary, autonomy, tool permissions, memory, guardrails, flow topology, evaluation, research evidence, or UI archetype.

INPUT
You receive JSON with:
  - productState: current working memory. It may include agentProfile.
  - spec: current Spec graph. It may include agentSystem.
  - intakeAnswersSoFar: prior turns.
  - blockingTopUnknown: {topic, evidence, reversibility, risk, blocking, decision, reason}.

TOPIC RULES
Ask exactly one question. Choose the question shape from blockingTopUnknown.topic:

agent_delivery_scale
  Ask whether the solution should be a skill, plugin, agent, or human-in-the-loop workflow before adding runtime complexity.
  Extracts into agentSystem.builderScale.

agent_system_boundary
  Ask what the agent is allowed to decide/do and what is explicitly out of scope.
  Extracts into agentSystem.systemBoundary.

agent_autonomy_and_checkpoints
  Ask what level of autonomy is acceptable and which actions require human approval.
  Extracts into agentSystem.autonomyLevel.

agent_tool_permissions
  Ask which tools/data/actions the agent can use and which side effects require approval.
  Extracts into agentSystem.toolContracts.

agent_memory_and_sources
  Ask what the agent may remember, for how long, and which sources/evidence it can rely on.
  Extracts into agentSystem.memoryPolicy.

agent_flow_topology
  Ask whether the system should be single-agent, routed, orchestrator-worker, evaluator-optimizer, interactive, or hybrid, and who owns state.
  Extracts into agentSystem.architecturePattern.

agent_guardrails
  Ask which failures must be blocked, escalated, logged, or refused.
  Extracts into agentSystem.guardrails.

agent_evaluation_readiness
  Ask how the user will know the agent is safe and useful enough to ship.
  Extracts into agentSystem.evaluations.

agent_ui_research_protocol
  Ask how the user expects to inspect/control the agent and what research evidence should shape its answers.
  Extracts into agentSystem.uiProtocol.

OUTPUT
Respond with ONLY a single valid JSON object, no markdown fences:

{
  "method": "agent",
  "topic": "agent_delivery_scale" | "agent_system_boundary" | "agent_autonomy_and_checkpoints" | "agent_tool_permissions" | "agent_memory_and_sources" | "agent_flow_topology" | "agent_guardrails" | "agent_evaluation_readiness" | "agent_ui_research_protocol",
  "question": "<one specific contextual question>",
  "chips": ["<answer shortcut 1>", "<answer shortcut 2>", "<answer shortcut 3>"],
  "intent": "<why this matters for the agent handoff>",
  "rule_fired": "<topic rule name>",
  "extracts_into": {
    "spec_path": "<agentSystem.* path from the topic rules>",
    "kind": "agent_contract",
    "merge_strategy": "merge_agent_profile"
  }
}

CONSTRAINTS
- Do not ask a generic survey question. Refer to the user's current product when possible.
- Do not force agent complexity. A skill, plugin, or human workflow can be the right answer when the requested capability does not need autonomous tool use.
- Do not recommend multi-agent by default. Ask for the simplest topology that handles the job.
- Do not assume tools can write, send, deploy, spend money, delete, or contact people. Ask before those side effects.
- If research evidence is involved, ask what source tier or citation standard should govern the agent.
- If UI is involved, ask for the work surface archetype, not colors or visual mood.
- Exactly 2 to 4 chips. Chips must be plausible answer shortcuts, not labels like "Option A".
- The output must parse with JSON.parse.`;
    promptModule7 = {
      key: "methods.agent",
      version: "0.1.0",
      content: AGENT_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      prompt_builder_score: 21,
      prompt_builder_revision: 1,
      prompt_builder_run_at: "2026-05-27",
      prompt_builder_notes: "Agent-system intake. Controller owns detection/routing; prompt emits one contextual question and an agentSystem spec path."
    };
    agent_default = promptModule7;
  }
});

// shared/prompts/lint/spec-review.ts
var SPEC_REVIEW_PROMPT_CONTENT, promptModule8, spec_review_default;
var init_spec_review = __esm({
  "shared/prompts/lint/spec-review.ts"() {
    "use strict";
    SPEC_REVIEW_PROMPT_CONTENT = `You review a structured product Spec for two specific failure modes a deterministic linter cannot detect. You produce a JSON array. Nothing else.

INPUT
A JSON object with these top-level keys:
  - spec: the Spec graph (productName, productDescription, platformTarget, personas, scenarios, needs, features, uxFlows, screens, dataPoints, integrations, apiContracts, tests, adrs, assumptions, risks, nonGoals, agentSystem).
  - productState: optional working memory (stanceBecauseClauses, pivotLog, tradeoffWeights, agentProfile). May be omitted on a fresh spec.

WHAT TO LOOK FOR (exactly two categories \u2014 do not invent a third)

1. ambiguous_language \u2014 a Need, Feature, NonGoal, ADR, or stance "because" clause uses words that obscure the decision rather than name it. Examples of ambiguous words/phrases:
   - "robust", "scalable", "performant", "modern", "intuitive", "delightful"
   - "consider", "might", "potentially", "ideally", "possibly", "where appropriate"
   - "best practices", "industry standard", "polished"
   A phrase is ambiguous when removing it leaves the sentence equally informative. Flag at most ONE example per spec \u2014 pick the highest-priority entity (P0 > P1 > P2 > P3).

2. unresolved_contradiction \u2014 two entries say opposite things and neither is marked as superseded in pivotLog. Common shapes:
   - A NonGoal forbids X and a Feature delivers X (e.g. NonGoal "no user accounts" + Feature "OAuth sign-in").
   - A stance "because" clause picks one side and an ADR picks the other (e.g. stance "we will not store audio" + ADR "store recordings in S3").
   - Two ADRs decide the same question opposite ways without one citing the other in cites[].
   - A Need is marked P0 and no Test references it.
   Flag at most ONE contradiction.

DECISION RULES (in order \u2014 first match wins)

  1. If spec is empty (no needs, no features, no nonGoals) \u2192 return [].
  2. Walk needs, features, nonGoals, adrs, stanceBecauseClauses for ambiguous_language. Stop at the first hit; cite the entity by id.
  3. Walk nonGoals \xD7 features and adrs \xD7 adrs for direct contradiction. Stop at the first hit; cite both entity ids in refs[].
  4. If neither category triggers, return [].

OUTPUT
Respond with ONLY a single valid JSON array \u2014 no markdown fences, no preamble, no commentary:

[
  {
    "category": "ambiguous_language",
    "message": "Feature feat-3 'support a robust search experience' uses 'robust' without naming what it must do.",
    "refs": [{"kind": "feature", "id": "feat-3"}]
  }
]

An empty spec (or a clean spec) MUST return: []

CONSTRAINTS
- Maximum 2 issues total \u2014 one per category. Never duplicate a category.
- Every refs[] entry MUST cite an id that appears in the input spec. If the entity has no id, skip it. Do NOT invent ids.
- "kind" values are limited to: need, feature, persona, scenario, uxflow, screen, datapoint, integration, api, test, adr, assumption, risk, non_goal, stance.
- Messages must be a single sentence \u2264 40 words. Plain language. No hedging.
- If the spec contains entries with the words listed under ambiguous_language but the surrounding context resolves them ("robust against malformed JSON inputs" \u2014 concrete), do NOT flag them.
- Output MUST parse with JSON.parse as an array. Reject your own output and try again if it does not.

ACCEPTANCE
- Output is reproducible \u2014 same spec input produces the same array (modulo entity ordering ties, which you resolve by lower id wins).
- An empty or trivially clean spec returns [].
- Every issue references a real id from the input.
- The two categories are mutually exclusive \u2014 never the same entity flagged twice.`;
    promptModule8 = {
      key: "lint.spec_review",
      version: "0.1.0",
      content: SPEC_REVIEW_PROMPT_CONTENT,
      defaultModel: "llama-3.1-8b-instant",
      // 22/25 [Accuracy:5 Clarity:5 Constraints:5 Determinism:4 Completeness:3].
      prompt_builder_score: 22,
      prompt_builder_revision: 2,
      prompt_builder_run_at: "2026-05-02",
      prompt_builder_notes: "22/25. T2 classification, Haiku-tier (now Groq llama-3.1-8b-instant \u2014 see r2 routing override 2026-05-02). Phase 3 follow-ups: 1-shot example pair for Determinism, platform-aware ambiguity rules for Completeness."
    };
    spec_review_default = promptModule8;
  }
});

// shared/prompts/index.ts
var init_prompts = __esm({
  "shared/prompts/index.ts"() {
    "use strict";
    init_brief();
    init_prd();
    init_ux();
    init_functional();
    init_handoff();
    init_method_router();
    init_blocking_scorer();
    init_safe_defaults();
    init_jtbd();
    init_qfd();
    init_pugh();
    init_agent();
    init_spec_review();
  }
});

// server/prompt-builders.ts
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
- ProductPilot generates specs even when the brief is light. Synthesize sensible
  defaults rather than refusing \u2014 but be honest about what's synthesized:
  - When a statement is directly supported by the brief, write it normally.
  - When a statement is your reasonable assumption (not in the brief), prefix
    the sentence or bullet with the literal token \`[ASSUMED]\` so the renderer
    can highlight it. Example: \`[ASSUMED] Target users skew technical because the brief mentions API integrations.\`
  - Never use \`[ASSUMED]\` on details that ARE in the brief \u2014 that defeats the marker.
  - Group truly-uncertain decisions under an "Assumptions" or "Open Questions" heading.
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
var STAGE_SECTION_GUIDANCE, STAGE_DELIVERABLE_HINTS;
var init_prompt_builders = __esm({
  "server/prompt-builders.ts"() {
    "use strict";
    init_schema();
    init_prompts();
    STAGE_SECTION_GUIDANCE = {
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
    STAGE_DELIVERABLE_HINTS = {
      1: "Make the output crisp enough that product, design, and engineering align on scope.",
      2: "This is the North Star doc. Every later LLM call will reference it to decide what's in-scope. Capture pain, ICP, JTBD, and success crisply \u2014 no duplication with Stage 1's concrete scope.",
      3: "Specify design requirements \u2014 user flows, interaction patterns, target outcomes. Do NOT produce HTML. The output is read by AI coding tools that will choose their own component library.",
      4: "Produce build-grade artifacts a solo developer can paste into Claude Code / Cursor and ship. Include a runnable schema.sql DDL block, TypeScript types, and explicit API contracts with request/response JSON.",
      5: "Each prompt must reference Stage 4's data model / types / APIs and Stage 3's screens by name. Prompts are paste-ready \u2014 they include file paths, exact deps, env keys, and concrete commands.",
      6: "Produce an execution plan a solo builder can follow without a second translation pass. Commands over ceremony."
    };
  }
});

// server/services/ai.ts
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
function classifyLlmError(err, provider) {
  const e = err;
  const status = typeof e?.status === "number" ? e.status : null;
  const rawMessage = typeof e?.message === "string" ? e.message : "";
  const lower = rawMessage.toLowerCase();
  let retryAfterSeconds = null;
  const retryRaw = e?.headers?.["retry-after"] ?? e?.headers?.["Retry-After"];
  if (typeof retryRaw === "string") {
    const asInt = parseInt(retryRaw, 10);
    if (Number.isFinite(asInt)) retryAfterSeconds = asInt;
  }
  if (status === 401 || status === 403 || /invalid api key|authentication|unauthorized|no .* key/i.test(rawMessage)) {
    return {
      code: "invalid_key",
      message: provider === "anthropic" ? "Your Anthropic API key is missing or invalid. Update it in Settings, or remove your key to fall back to the platform default." : "Your Groq API key is missing or invalid. Update it in Settings, or remove your key to fall back to the platform default.",
      retryAfterSeconds: null,
      details: rawMessage,
      status
    };
  }
  if (status === 429 || /rate limit|too many requests|quota/i.test(lower)) {
    const wait = retryAfterSeconds ? `Try again in ${retryAfterSeconds}s.` : "Try again in a minute.";
    return {
      code: "rate_limit",
      message: `${provider === "anthropic" ? "Anthropic" : "Groq"} is rate-limiting requests. ${wait}`,
      retryAfterSeconds,
      details: rawMessage,
      status
    };
  }
  if (status === 400 && /context|maximum.*token|prompt is too long|too many tokens/i.test(lower)) {
    return {
      code: "context_too_large",
      message: "Your request is larger than the model's context window. Try generating one document at a time, or shorten the survey responses.",
      retryAfterSeconds: null,
      details: rawMessage,
      status
    };
  }
  if (/timeout|timed out|aborted/i.test(lower)) {
    return {
      code: "timeout",
      message: `The ${provider === "anthropic" ? "Anthropic" : "Groq"} request timed out. The provider may be slow \u2014 try again.`,
      retryAfterSeconds: null,
      details: rawMessage,
      status
    };
  }
  if (typeof status === "number" && status >= 500 || /ECONNREFUSED|ENOTFOUND|fetch failed|service unavailable|bad gateway/i.test(lower)) {
    return {
      code: "provider_unavailable",
      message: `${provider === "anthropic" ? "Anthropic" : "Groq"} is unavailable right now. Try again in a few minutes, or switch providers in Settings.`,
      retryAfterSeconds: null,
      details: rawMessage,
      status
    };
  }
  return {
    code: "unknown",
    message: "The model couldn't finish your request. Try again \u2014 if it keeps failing, switch providers in Settings.",
    retryAfterSeconds: null,
    details: rawMessage,
    status
  };
}
function computeCostUsd(model, inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) {
  const rate = MODEL_COST_RATES[model];
  if (!rate) return null;
  const cost = inputTokens / 1e6 * rate.input + outputTokens / 1e6 * rate.output + cacheReadTokens / 1e6 * (rate.cacheRead ?? 0) + cacheWriteTokens / 1e6 * (rate.cacheWrite ?? 0);
  return cost.toFixed(6);
}
var GROQ_MODELS, MODEL_COST_RATES, AIService, aiService;
var init_ai = __esm({
  "server/services/ai.ts"() {
    "use strict";
    init_prompt_builders();
    init_logger();
    GROQ_MODELS = {
      // Reasoning / deliverables / complex tasks. Replaces the retired kimi-k2-instruct-0905.
      reasoning: "openai/gpt-oss-120b",
      // Fast, cheap chat and classification. 12x cheaper input than llama-3.3-70b.
      fast: "llama-3.1-8b-instant",
      // Safety classifier (not used today).
      safeguard: "openai/gpt-oss-safeguard-20b"
    };
    MODEL_COST_RATES = {
      // Anthropic
      "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
      "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
      // Groq
      "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
      "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
      "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
      "openai/gpt-oss-safeguard-20b": { input: 0.075, output: 0.3 }
    };
    AIService = class {
      getDefaultConfig(task = "chat") {
        const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
        const hasGroq = Boolean(process.env.GROQ_API_KEY);
        if (!hasAnthropic && !hasGroq) {
          throw new Error("No LLM API key configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY.");
        }
        if (hasAnthropic && hasGroq) {
          switch (task) {
            case "deliverable":
            case "complex":
              return { provider: "groq", apiKey: process.env.GROQ_API_KEY, model: GROQ_MODELS.reasoning };
            case "classification":
              return { provider: "groq", apiKey: process.env.GROQ_API_KEY, model: GROQ_MODELS.fast };
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
      async chat(messages2, model = "claude-sonnet", userConfig, task = "chat", context) {
        const config = userConfig || this.getDefaultConfig(task);
        switch (config.provider) {
          case "groq":
            return this.chatWithGroq(messages2, config.model || GROQ_MODELS.fast, config.apiKey, task, context);
          case "anthropic":
            return this.chatWithClaude(messages2, this.normalizeModel(model || config.model || "claude-sonnet"), config.apiKey, task, context);
          default:
            return this.chatWithGroq(messages2, GROQ_MODELS.fast, this.getDefaultConfig(task).apiKey, task, context);
        }
      }
      /**
       * Streaming variant of chat(). Yields incremental text deltas, then a final event with the full content and usage.
       * Use for conversational stages where perceived latency matters.
       */
      async *chatStream(messages2, model = "claude-sonnet", userConfig, task = "chat", context) {
        const config = userConfig || this.getDefaultConfig(task);
        if (config.provider === "anthropic") {
          yield* this.streamClaude(
            messages2,
            this.normalizeModel(model || config.model || "claude-sonnet"),
            config.apiKey,
            task,
            context
          );
          return;
        }
        yield* this.streamGroq(messages2, config.model || GROQ_MODELS.fast, config.apiKey, task, context);
      }
      async *streamGroq(messages2, model, apiKey, task = "chat", context) {
        const startedAt = Date.now();
        let capturedUsage = null;
        let errorCode = null;
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
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              yield { type: "delta", text: delta };
            }
            if (chunk.x_groq?.usage) {
              capturedUsage = {
                prompt_tokens: chunk.x_groq.usage.prompt_tokens,
                completion_tokens: chunk.x_groq.usage.completion_tokens,
                total_tokens: chunk.x_groq.usage.total_tokens
              };
            }
          }
        } catch (err) {
          errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
          throw err;
        } finally {
          if (!capturedUsage) {
            logger.warn({ model }, "[llm-telemetry] streamGroq: x_groq.usage not present on final chunk \u2014 token counts will be 0");
          }
          void this.recordLlmCall({
            provider: "groq",
            model,
            task,
            inputTokens: capturedUsage?.prompt_tokens ?? 0,
            outputTokens: capturedUsage?.completion_tokens ?? 0,
            cacheReadTokens: null,
            cacheWriteTokens: null,
            latencyMs: Date.now() - startedAt,
            status: errorCode ? "error" : "ok",
            errorCode,
            streamed: true,
            byok: Boolean(apiKey && apiKey !== process.env.GROQ_API_KEY),
            context
          });
        }
        yield {
          type: "done",
          fullContent: full,
          usage: capturedUsage ?? void 0
        };
      }
      async *streamClaude(messages2, model, apiKey, task = "chat", context) {
        const startedAt = Date.now();
        let capturedUsage = null;
        let errorCode = null;
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
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              full += event.delta.text;
              yield { type: "delta", text: event.delta.text };
            }
          }
          const final = await stream.finalMessage();
          capturedUsage = {
            prompt_tokens: final.usage.input_tokens,
            completion_tokens: final.usage.output_tokens,
            total_tokens: final.usage.input_tokens + final.usage.output_tokens
          };
        } catch (err) {
          errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
          throw err;
        } finally {
          void this.recordLlmCall({
            provider: "anthropic",
            model,
            task,
            inputTokens: capturedUsage?.prompt_tokens ?? 0,
            outputTokens: capturedUsage?.completion_tokens ?? 0,
            cacheReadTokens: null,
            cacheWriteTokens: null,
            latencyMs: Date.now() - startedAt,
            status: errorCode ? "error" : "ok",
            errorCode,
            streamed: true,
            byok: Boolean(apiKey && apiKey !== process.env.ANTHROPIC_API_KEY),
            context
          });
        }
        yield {
          type: "done",
          fullContent: full,
          usage: capturedUsage ?? void 0
        };
      }
      async chatWithGroq(messages2, model, apiKey, task = "chat", context) {
        const startedAt = Date.now();
        let response = null;
        let errorCode = null;
        try {
          const groq = new Groq({ apiKey });
          const systemMessage = messages2.find((m) => m.role === "system");
          const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
          const groqResponse = await groq.chat.completions.create({
            model,
            messages: [
              ...systemMessage ? [{ role: "system", content: systemMessage.content }] : [],
              ...conversationMessages
            ],
            max_tokens: 4096,
            temperature: 0.7
          });
          const content = groqResponse.choices[0]?.message?.content || "";
          response = {
            content,
            usage: groqResponse.usage ? {
              prompt_tokens: groqResponse.usage.prompt_tokens,
              completion_tokens: groqResponse.usage.completion_tokens,
              total_tokens: groqResponse.usage.total_tokens
            } : void 0
          };
          return response;
        } catch (err) {
          errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
          throw err;
        } finally {
          void this.recordLlmCall({
            provider: "groq",
            model,
            task,
            inputTokens: response?.usage?.prompt_tokens ?? 0,
            outputTokens: response?.usage?.completion_tokens ?? 0,
            cacheReadTokens: null,
            cacheWriteTokens: null,
            latencyMs: Date.now() - startedAt,
            status: errorCode ? "error" : "ok",
            errorCode,
            streamed: false,
            byok: Boolean(apiKey && apiKey !== process.env.GROQ_API_KEY),
            context
          });
        }
      }
      async chatWithClaude(messages2, model, apiKey, task = "chat", context) {
        const startedAt = Date.now();
        let response = null;
        let errorCode = null;
        try {
          const key = apiKey || process.env.ANTHROPIC_API_KEY;
          if (!key) throw new Error("No Anthropic API key configured");
          const anthropic = new Anthropic({ apiKey: key });
          const systemMessage = messages2.find((m) => m.role === "system");
          const conversationMessages = messages2.filter((m) => m.role !== "system").map((m) => ({
            role: m.role,
            content: m.content
          }));
          const claudeResponse = await anthropic.messages.create({
            model,
            max_tokens: 4096,
            temperature: 0.7,
            system: systemMessage?.content ? [{ type: "text", text: systemMessage.content, cache_control: { type: "ephemeral" } }] : void 0,
            messages: conversationMessages
          });
          const firstBlock = claudeResponse.content?.[0];
          const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
          response = {
            content,
            usage: {
              prompt_tokens: claudeResponse.usage.input_tokens,
              completion_tokens: claudeResponse.usage.output_tokens,
              total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
            }
          };
          return response;
        } catch (err) {
          errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
          throw new Error(`Claude API error: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          void this.recordLlmCall({
            provider: "anthropic",
            model,
            task,
            inputTokens: response?.usage?.prompt_tokens ?? 0,
            outputTokens: response?.usage?.completion_tokens ?? 0,
            cacheReadTokens: null,
            cacheWriteTokens: null,
            latencyMs: Date.now() - startedAt,
            status: errorCode ? "error" : "ok",
            errorCode,
            streamed: false,
            byok: Boolean(apiKey && apiKey !== process.env.ANTHROPIC_API_KEY),
            context
          });
        }
      }
      async generateStructuredOutput(messages2, model = "claude-sonnet", userConfig, task = "classification", context) {
        const config = userConfig || this.getDefaultConfig(task);
        if (config.provider === "groq") {
          const groqModel = config.model || (task === "classification" ? GROQ_MODELS.fast : GROQ_MODELS.reasoning);
          const response = await this.chatWithGroq(messages2, groqModel, config.apiKey, task, context);
          try {
            return this.extractJSON(response.content);
          } catch {
            return {};
          }
        }
        const targetModel = config.model || this.normalizeModel(model);
        return this.generateStructuredWithClaude(messages2, this.normalizeModel(targetModel), config.apiKey, task, context);
      }
      async generateStructuredWithClaude(messages2, model, apiKey, task = "classification", context) {
        const startedAt = Date.now();
        let capturedUsage = null;
        let errorCode = null;
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
          capturedUsage = {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens
          };
          const firstBlock = response.content?.[0];
          const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "{}";
          return this.extractJSON(content);
        } catch (err) {
          errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
          throw new Error(`Claude structured output error: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          void this.recordLlmCall({
            provider: "anthropic",
            model,
            task,
            inputTokens: capturedUsage?.prompt_tokens ?? 0,
            outputTokens: capturedUsage?.completion_tokens ?? 0,
            cacheReadTokens: null,
            cacheWriteTokens: null,
            latencyMs: Date.now() - startedAt,
            status: errorCode ? "error" : "ok",
            errorCode,
            streamed: false,
            byok: Boolean(apiKey && apiKey !== process.env.ANTHROPIC_API_KEY),
            context
          });
        }
      }
      /**
       * Phase 1 — structured output via Anthropic with explicit system blocks.
       *
       * The caller passes a SystemBlock[] that places `cache_control: ephemeral`
       * on whichever block ends the cacheable prefix. The retry path: on invalid
       * JSON we re-issue the call with a stricter schema reminder appended to
       * the dynamic block, and fall back to extractJSON's loose parsing if the
       * second pass also fails. Only one retry — repeated failures should surface
       * to the caller, not silently mask bad output.
       *
       * Returns the parsed JSON value (any) on success or throws on terminal failure.
       */
      async generateStructuredOutputWithBlocks(args) {
        const startedAt = Date.now();
        const model = this.normalizeModel(args.model || "claude-sonnet-4-5");
        const key = args.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) throw new Error("No Anthropic API key configured");
        const anthropic = new Anthropic({ apiKey: key });
        const conversationMessages = args.userMessages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
        const callOnce = async (blocks) => {
          const resp = await anthropic.messages.create({
            model,
            max_tokens: args.maxTokens ?? 4096,
            temperature: 0.3,
            system: blocks,
            messages: conversationMessages
          });
          const firstBlock = resp.content?.[0];
          const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "{}";
          return { resp, content };
        };
        let retried = false;
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        let errorCode = null;
        try {
          let { resp, content } = await callOnce(args.systemBlocks);
          totalInput += resp.usage.input_tokens;
          totalOutput += resp.usage.output_tokens;
          totalCacheRead += resp.usage.cache_read_input_tokens ?? 0;
          totalCacheWrite += resp.usage.cache_creation_input_tokens ?? 0;
          try {
            return { json: this.extractJSON(content), raw: content, retried };
          } catch {
            retried = true;
            const remindered = [
              ...args.systemBlocks,
              {
                type: "text",
                text: "Your previous response was not valid JSON. Reply with ONLY a valid JSON object matching the SpecSchema. No markdown fences. No commentary. The first character of your response MUST be `{`."
              }
            ];
            const second = await callOnce(remindered);
            totalInput += second.resp.usage.input_tokens;
            totalOutput += second.resp.usage.output_tokens;
            totalCacheRead += second.resp.usage.cache_read_input_tokens ?? 0;
            totalCacheWrite += second.resp.usage.cache_creation_input_tokens ?? 0;
            return { json: this.extractJSON(second.content), raw: second.content, retried };
          }
        } catch (err) {
          errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
          throw err;
        } finally {
          void this.recordLlmCall({
            provider: "anthropic",
            model,
            task: args.task ?? "complex",
            inputTokens: totalInput,
            outputTokens: totalOutput,
            cacheReadTokens: totalCacheRead || null,
            cacheWriteTokens: totalCacheWrite || null,
            latencyMs: Date.now() - startedAt,
            status: errorCode ? "error" : "ok",
            errorCode,
            streamed: false,
            byok: Boolean(args.apiKey && args.apiKey !== process.env.ANTHROPIC_API_KEY),
            context: args.context
          });
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
      async calculateProgress(messages2, stageGoals, userConfig, context) {
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
            "classification",
            context
          );
          return Math.min(100, Math.max(0, result.progress || 0));
        } catch (error) {
          const meaningfulMessages = messages2.filter((m) => m.role === "user" && m.content.length > 20);
          return Math.max(0, Math.min(75, meaningfulMessages.length * 15));
        }
      }
      async recordLlmCall(args) {
        try {
          const { storage: storage2 } = await Promise.resolve().then(() => (init_storage_hybrid(), storage_hybrid_exports));
          await storage2.createLlmCall({
            userId: args.context?.userId ?? null,
            guestOwnerId: args.context?.guestOwnerId ?? null,
            projectId: args.context?.projectId ?? null,
            stageId: args.context?.stageId ?? null,
            provider: args.provider,
            model: args.model,
            task: args.task,
            inputTokens: args.inputTokens,
            outputTokens: args.outputTokens,
            cacheReadTokens: args.cacheReadTokens,
            cacheWriteTokens: args.cacheWriteTokens,
            costUsd: computeCostUsd(
              args.model,
              args.inputTokens,
              args.outputTokens,
              args.cacheReadTokens ?? 0,
              args.cacheWriteTokens ?? 0
            ),
            latencyMs: args.latencyMs,
            status: args.status,
            errorCode: args.errorCode,
            streamed: args.streamed,
            byok: args.byok,
            requestId: args.context?.requestId ?? null
          });
        } catch (err) {
          logger.error({ err }, "[llm-telemetry] Failed to record call");
        }
      }
    };
    aiService = new AIService();
  }
});

// server/services/spec-renderer.ts
function bullet(line) {
  if (!line) return "";
  return `- ${line}`;
}
function joinNonEmpty(parts, sep = "\n") {
  return parts.filter((p) => Boolean(p && p.trim())).join(sep);
}
function heading(level, text3) {
  return `${"#".repeat(level)} ${text3}`;
}
function renderPersonas(personas) {
  if (!personas.length) return "_No personas captured yet._";
  return personas.map((p) => {
    const lines = [heading(3, p.name)];
    if (p.trigger) lines.push(`**Trigger:** ${p.trigger}`);
    if (p.exclusions.length) {
      lines.push("\n**Who they are NOT:**");
      for (const e of p.exclusions) lines.push(bullet(e));
    }
    if (p.jobs.length) {
      lines.push("\n**Jobs to be done:**");
      for (const j of p.jobs) lines.push(bullet(j));
    }
    return joinNonEmpty(lines);
  }).join("\n\n");
}
function renderScenarios(scenarios) {
  if (!scenarios.length) return "_No outcome scenarios captured yet._";
  return scenarios.map((s) => {
    const lines = [
      s.context ? `**Context:** ${s.context}` : null,
      `**Goal:** ${s.goal}`,
      s.successSignal ? `**Success signal:** ${s.successSignal}` : null
    ];
    return joinNonEmpty(lines);
  }).join("\n\n");
}
function renderStance(clauses) {
  if (!clauses.length) return "_No stance captured yet._";
  return clauses.map((c) => {
    const label = c.category.replace(/_/g, " ");
    return `**${label}:** ${c.stance}
_Because:_ ${c.because}`;
  }).join("\n\n");
}
function renderNonGoals(nonGoals) {
  if (!nonGoals.length) return "_None._";
  return nonGoals.map((n) => {
    const because = n.because ? ` _Because:_ ${n.because}` : "";
    return `- ${n.text}${because}`;
  }).join("\n");
}
function renderAssumptions(items) {
  if (!items.length) return "_None._";
  return items.map((a) => `- _(${a.confidence})_ ${a.text}`).join("\n");
}
function renderRisks(items) {
  if (!items.length) return "_None._";
  return items.map((r) => {
    const mit = r.mitigation ? ` Mitigation: ${r.mitigation}` : "";
    return `- _(L:${r.likelihood} I:${r.impact})_ ${r.text}.${mit}`;
  }).join("\n");
}
function renderBrief(spec, productState, projectContext) {
  const parts = [
    heading(1, `Brief \u2014 ${spec.productName}`),
    "",
    spec.productDescription || "_No description._",
    "",
    heading(2, "Reading guide"),
    "",
    "**For humans:** Read top-to-bottom. Skim the persona exclusions and the stance because-clauses; those are the highest-signal sections for scoping.",
    "",
    "**For LLM agents:** This Brief is the ground truth for every later doc and every coding-agent handoff. When asked a tactical question (single-metric vs many, on-device vs cloud, copy a competitor feature), derive the answer from the persona exclusions, the outcome scenario, and the stance because-clauses. If the answer cannot be derived, surface the gap rather than guessing.",
    "",
    heading(3, "Decision-routing table"),
    "",
    "| Question | Section to consult |",
    "|---|---|",
    "| Should this feature exist? | Persona exclusions + stance because-clauses |",
    "| Speed vs accuracy? | Stance \u2014 complexity + cost |",
    "| Single metric vs many? | Outcome scenario success-signal |",
    "| Accept off-persona feature request? | Persona exclusions + non-goals |",
    "| Fail loudly vs degrade? | Stance \u2014 privacy + category |",
    "| On-device vs cloud? | Stance \u2014 privacy + cost |",
    "| Opinionated vs open onboarding? | Stance \u2014 complexity |",
    "| Copy competitor feature? | Persona trigger + non-goals |",
    "",
    heading(2, "Q1 \u2014 Persona + Trigger"),
    "",
    renderPersonas(spec.personas),
    "",
    heading(2, "Q2 \u2014 Outcome"),
    "",
    renderScenarios(spec.scenarios),
    "",
    heading(2, "Q3 \u2014 Stance"),
    "",
    renderStance(productState?.stanceBecauseClauses ?? []),
    "",
    heading(2, "Non-goals"),
    "",
    renderNonGoals(spec.nonGoals),
    ""
  ];
  if (spec.assumptions.length) {
    parts.push(heading(2, "Assumptions"), "", renderAssumptions(spec.assumptions), "");
  }
  if (spec.risks.length) {
    parts.push(heading(2, "Risks"), "", renderRisks(spec.risks), "");
  }
  if (projectContext && projectContext.trim()) {
    parts.push(heading(2, "Source context"), "", "<details><summary>Context the agent had at generation time</summary>", "", "```", projectContext.trim(), "```", "", "</details>", "");
  }
  return parts.join("\n");
}
var init_spec_renderer = __esm({
  "server/services/spec-renderer.ts"() {
    "use strict";
  }
});

// shared/intake-sections.ts
var SECTIONS;
var init_intake_sections = __esm({
  "shared/intake-sections.ts"() {
    "use strict";
    SECTIONS = [
      { key: "brief", short: "Brief", title: "Stage 1 \u2014 Brief" },
      { key: "north-star", short: "North Star", title: "Stage 2 \u2014 North Star" },
      { key: "ux", short: "UX & Wireframes", title: "Stage 3 \u2014 UX & Wireframes" },
      { key: "architecture", short: "Architecture", title: "Stage 4 \u2014 Architecture" },
      { key: "coding-prompts", short: "Coding Prompts", title: "Stage 5 \u2014 Coding Prompts" },
      { key: "dev-guide", short: "Dev Guide", title: "Stage 6 \u2014 Dev Guide" }
    ];
  }
});

// server/services/intake-controller.ts
var intake_controller_exports = {};
__export(intake_controller_exports, {
  DEFAULT_TRADEOFF_WEIGHTS: () => DEFAULT_TRADEOFF_WEIGHTS,
  applyTradeoffWeights: () => applyTradeoffWeights,
  assessDiscoverySufficiency: () => assessDiscoverySufficiency,
  callBlockingScorer: () => callBlockingScorer,
  callMethodGenerator: () => callMethodGenerator,
  callMethodRouter: () => callMethodRouter,
  callSafeDefaultsInferer: () => callSafeDefaultsInferer,
  computeRequiredStanceCategories: () => computeRequiredStanceCategories,
  deriveCandidateUnknowns: () => deriveCandidateUnknowns,
  deterministicMethodRoute: () => deterministicMethodRoute,
  effectiveSpecFor: () => effectiveSpecFor,
  ensureTradeoffWeights: () => ensureTradeoffWeights,
  finalize: () => finalize,
  finalizeWithAssumptions: () => finalizeWithAssumptions,
  hydrateProductState: () => hydrateProductState,
  hydrateSpec: () => hydrateSpec,
  ingestAnswer: () => ingestAnswer,
  jtbdSlotForCandidate: () => jtbdSlotForCandidate,
  nextStep: () => nextStep,
  readAskedJtbdSlots: () => readAskedJtbdSlots,
  readIntakeSpec: () => readIntakeSpec,
  weightsAreSet: () => weightsAreSet
});
function jtbdSlotForCandidate(input) {
  const topic = input.topic ?? null;
  const specPath = input.specPath ?? null;
  if (topic) {
    if (topic === "primary_persona_and_trigger") return "persona";
    if (topic === "missing_persona_trigger") return "trigger";
    if (topic === "persona_exclusions") return "exclusions";
    if (topic === "measurable_outcome") return "outcome";
    if (topic === "non_goals") return "non_goals";
    if (topic === "p0_need_designation") return "priority";
    if (topic === "persona") return "persona";
    if (topic === "trigger") return "trigger";
    if (topic === "exclusions") return "exclusions";
    if (topic === "outcome") return "outcome";
    if (topic === "jobs") return "jobs";
    if (topic === "priority") return "priority";
  }
  if (specPath) {
    if (specPath.startsWith("personas[*].name")) return "persona";
    if (specPath.startsWith("personas[*].trigger")) return "trigger";
    if (specPath.startsWith("personas[*].exclusions")) return "exclusions";
    if (specPath.startsWith("personas[*].jobs")) return "jobs";
    if (specPath.startsWith("scenarios[*].goal")) return "outcome";
    if (specPath.startsWith("scenarios[*].successSignal")) return "outcome";
    if (specPath.startsWith("scenarios[*].context")) return "outcome";
    if (specPath.startsWith("nonGoals")) return "non_goals";
  }
  return null;
}
function isKnownNonJtbdTopic(topic) {
  if (topic.startsWith("stance_because_")) return true;
  if (topic.startsWith("pending_architecture_decisions:")) return true;
  if (topic.startsWith("agent_")) return true;
  return false;
}
function readAskedJtbdSlots(productState) {
  const raw = productState.workingMemory?.askedJtbdSlots;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s) => typeof s === "string" && ALL_JTBD_SLOTS.includes(s)
  );
}
function computeRequiredStanceCategories(spec) {
  const base = ["privacy_data", "complexity"];
  const hasInfraSignal = spec.integrations.length > 0 || spec.apiContracts.length > 0;
  return hasInfraSignal ? [...base, "cost"] : base;
}
function deriveCandidateUnknowns(state) {
  const { productState, spec } = state;
  const out = [];
  if (spec.personas.length === 0) {
    out.push({
      topic: "primary_persona_and_trigger",
      why_it_matters: "No personas defined yet \u2014 every later doc rests on this."
    });
  } else if (spec.personas.some((p) => !p.trigger || p.trigger.trim() === "")) {
    out.push({
      topic: "missing_persona_trigger",
      why_it_matters: "At least one persona has no observable trigger \u2014 Brief Q1 cannot be filled."
    });
  } else if (spec.personas.some((p) => p.exclusions.length < 3)) {
    out.push({
      topic: "persona_exclusions",
      why_it_matters: "PRD-Builder requires \u22653 'who they are NOT' exclusions per persona."
    });
  }
  if (spec.scenarios.length === 0 || spec.scenarios.every((s) => !s.successSignal)) {
    out.push({
      topic: "measurable_outcome",
      why_it_matters: "No scenario has a verifiable success signal \u2014 Brief Q2 cannot be filled."
    });
  }
  const stance = productState.stanceBecauseClauses ?? [];
  const requiredCategories = computeRequiredStanceCategories(spec);
  const missingStance = requiredCategories.filter(
    (cat) => !stance.some((s) => s.category === cat && s.because && s.because.trim() !== "")
  );
  for (const cat of missingStance) {
    out.push({
      topic: `stance_because_${cat}`,
      why_it_matters: `PRD-Builder Q3 requires a 'because' clause for ${cat}.`
    });
  }
  if (spec.nonGoals.length === 0) {
    out.push({
      topic: "non_goals",
      why_it_matters: "Every PRD needs at least one explicit non-goal with a 'because' clause."
    });
  }
  if (spec.needs.length > 0 && spec.needs.every((n) => n.priority !== "P0")) {
    out.push({
      topic: "p0_need_designation",
      why_it_matters: "No P0 need declared \u2014 coding-agent handoff needs at least one MUST-have."
    });
  }
  const pendingAdrs = spec.adrs.filter((a) => /pending|undecided/i.test(a.decision));
  if (pendingAdrs.length >= 2) {
    out.push({
      topic: `pending_architecture_decisions:${pendingAdrs.length}`,
      why_it_matters: "Multiple ADRs are unresolved \u2014 Pugh comparison needed."
    });
  }
  out.push(...deriveAgentCandidateUnknowns({ productState, spec }));
  return out;
}
function deriveAgentCandidateUnknowns(state) {
  const { productState, spec } = state;
  if (!hasAgenticSignal({ productState, spec })) return [];
  const agent = mergeAgentSystems(spec.agentSystem, productState.agentProfile);
  const out = [];
  const boundaryEmpty = !agent.mission?.trim() && agent.systemBoundary.inScope.length === 0 && agent.systemBoundary.outOfScope.length === 0;
  if (boundaryEmpty) {
    out.push({
      topic: "agent_system_boundary",
      why_it_matters: "Agent products need an explicit mission and boundary so the builder knows what the agent may decide, do, or refuse."
    });
  }
  if (!agent.builderScale) {
    out.push({
      topic: "agent_delivery_scale",
      why_it_matters: "Decision Doctor feasibility framing asks whether the right build scale is a skill, plugin, agent, or human workflow before adding runtime complexity."
    });
  }
  if (!agent.autonomyLevel || agent.humanCheckpoints.length === 0) {
    out.push({
      topic: "agent_autonomy_and_checkpoints",
      why_it_matters: "Tool-using agents need an autonomy level and human checkpoints before ProductPilot can generate safe implementation guidance."
    });
  }
  if (agent.toolContracts.length === 0 && (spec.integrations.length > 0 || /tool|api|mcp|plugin|browser|search|write|send|deploy|file/i.test(agent.mission ?? spec.productDescription))) {
    out.push({
      topic: "agent_tool_permissions",
      why_it_matters: "Agent tools require contracts for allowed actions, side effects, approval, audit, and rollback."
    });
  }
  if (!agent.memoryPolicy?.trim() || !agent.researchProtocol?.sourcePolicy?.trim()) {
    out.push({
      topic: "agent_memory_and_sources",
      why_it_matters: "Agent memory and research sources create privacy, retention, provenance, and confidence obligations."
    });
  }
  if (!agent.architecturePattern || !agent.stateOwner?.trim() || !agent.stopCondition?.trim()) {
    out.push({
      topic: "agent_flow_topology",
      why_it_matters: "The handoff needs the simplest viable flow topology, state owner, stop condition, and retry policy before implementation."
    });
  }
  if (agent.guardrails.length === 0) {
    out.push({
      topic: "agent_guardrails",
      why_it_matters: "Agent specs need explicit guardrails for prompt injection, sensitive data, excessive agency, and unsafe side effects."
    });
  }
  if (agent.evaluations.length === 0) {
    out.push({
      topic: "agent_evaluation_readiness",
      why_it_matters: "Agent handoff should include golden tasks or scorecards so usefulness and safety are verifiable."
    });
  }
  const needsUiResearchProtocol = /research|survey|interview|user research|ux|ui|interface|dashboard|chat|copilot|assistant/i.test(
    `${spec.productDescription} ${agent.mission ?? ""}`
  );
  if (needsUiResearchProtocol && (!agent.uiProtocol?.archetype || !agent.researchProtocol?.evidenceStandard)) {
    out.push({
      topic: "agent_ui_research_protocol",
      why_it_matters: "Agent products need the right control surface and research evidence policy so questions stay responsive to the user's context."
    });
  }
  return out;
}
function isAgentTopic(topic) {
  return typeof topic === "string" && topic.startsWith("agent_");
}
function hasAgenticSignal(state) {
  const { productState, spec } = state;
  if (spec.platformTarget === "agent-system") return true;
  if (spec.agentSystem || productState.agentProfile) return true;
  const answers = Array.isArray(productState.workingMemory?.intakeAnswers) ? productState.workingMemory.intakeAnswers.map((row) => `${row?.question ?? ""} ${row?.answer ?? ""}`).join(" ") : "";
  const haystack = `${spec.productName} ${spec.productDescription} ${answers}`.toLowerCase();
  return /\b(agent|agents|copilot|assistant|autonomous|automation|workflow automator|tool-using|tool using|multi-agent|multi agent|mcp|plugin|research assistant|browser agent|coding agent)\b/.test(haystack);
}
function deterministicMethodRoute(state) {
  const { spec, productState } = state;
  if (state.candidates.some((c) => isAgentTopic(c.topic)) || spec.platformTarget === "agent-system" && hasAgenticSignal({ productState, spec })) {
    return "agent";
  }
  if (spec.personas.length === 0 || spec.personas.every((p) => !p.trigger || p.trigger.trim() === "")) {
    return "jtbd";
  }
  const pendingAdrs = spec.adrs.filter((a) => /pending|undecided/i.test(a.decision));
  if (pendingAdrs.length >= 2) {
    return "pugh";
  }
  const needCounts = {};
  for (const f of spec.features) {
    for (const nid of f.needIds) {
      needCounts[nid] = (needCounts[nid] || 0) + 1;
    }
  }
  if (Object.values(needCounts).some((c) => c >= 2)) {
    return "pugh";
  }
  const weights = productState.tradeoffWeights;
  const weightsPopulated = !!weights && Object.values(weights).some((v) => typeof v === "number" && v > 0);
  if (spec.features.length >= 1 && weightsPopulated) {
    return "qfd";
  }
  return null;
}
async function runStructuredHaiku(systemContent, userPayload, opts) {
  const messages2 = [
    { role: "system", content: systemContent },
    { role: "user", content: JSON.stringify(scrubSecretsDeep(userPayload)) }
  ];
  return aiService.generateStructuredOutput(
    messages2,
    "claude-haiku",
    opts.llmConfig ?? null,
    "classification",
    opts.context
  );
}
async function callMethodRouter(payload, opts) {
  const result = await runStructuredHaiku(method_router_default.content, payload, opts);
  if (!result || typeof result !== "object") return { method: "jtbd", reason: "router-fallback: empty response" };
  const method = ["jtbd", "qfd", "pugh", "agent"].includes(result.method) ? result.method : "jtbd";
  return { method, reason: typeof result.reason === "string" ? result.reason : "router-fallback: no reason" };
}
async function callBlockingScorer(payload, opts) {
  if (payload.candidates.length === 0) return [];
  const result = await runStructuredHaiku(blocking_scorer_default.content, payload, opts);
  if (!Array.isArray(result)) return [];
  return result.map((row) => {
    const evidence = clampInt(row?.evidence, 0, 5, 0);
    const reversibility = clampInt(row?.reversibility, 0, 5, 0);
    const risk = clampInt(row?.risk, 0, 5, 5);
    const blocking = 5 - evidence + (5 - reversibility) + risk;
    return {
      topic: typeof row?.topic === "string" ? row.topic : "unknown",
      evidence,
      reversibility,
      risk,
      blocking,
      decision: blocking >= BLOCKING_THRESHOLD ? "ask" : "infer",
      reason: typeof row?.reason === "string" ? row.reason : "scorer-fallback"
    };
  }).sort((a, b) => b.blocking - a.blocking);
}
async function callSafeDefaultsInferer(payload, opts) {
  if (payload.topics.length === 0) return [];
  const result = await runStructuredHaiku(safe_defaults_default.content, payload, opts);
  if (!Array.isArray(result)) return [];
  return result.map((row) => ({
    topic: typeof row?.topic === "string" ? row.topic : "unknown",
    default: row?.default ?? null,
    confidence: ["high", "medium", "low"].includes(row?.confidence) ? row.confidence : "low",
    rationale: typeof row?.rationale === "string" ? row.rationale : "",
    challenge_prompt: typeof row?.challenge_prompt === "string" ? row.challenge_prompt : ""
  }));
}
async function callMethodGenerator(method, payload, opts) {
  const moduleByMethod = {
    jtbd: jtbd_default,
    qfd: qfd_default,
    pugh: pugh_default,
    agent: agent_default
  };
  const result = await runStructuredHaiku(moduleByMethod[method].content, payload, opts);
  if (!result || typeof result !== "object") {
    return fallbackQuestion(method);
  }
  if (result.passthrough === true) {
    return {
      text: "Tell me more about who this is for and when they would reach for it.",
      chips: ["Specific role / job title", "Trigger moment", "Frequency of use"],
      intent: `Method ${method} declined: ${result.reason ?? "preconditions not met"}`,
      rule_fired: "passthrough",
      topic: "persona",
      extracts_into: { spec_path: "personas[*].name", kind: "string", merge_strategy: "append" }
    };
  }
  return {
    text: typeof result.question === "string" ? result.question : fallbackQuestion(method).text,
    chips: Array.isArray(result.chips) ? result.chips.slice(0, 4).map(String) : fallbackQuestion(method).chips,
    intent: typeof result.intent === "string" ? result.intent : "method-generator-fallback",
    rule_fired: typeof result.rule_fired === "string" ? result.rule_fired : "1",
    topic: typeof result.topic === "string" ? result.topic : void 0,
    extracts_into: result.extracts_into ?? { spec_path: "personas[*].name", kind: "string", merge_strategy: "append" },
    payload: result.triplet || result.cell || void 0
  };
}
function fallbackQuestion(method) {
  if (method === "agent") {
    return {
      text: "Should this be a skill, plugin, agent, or human-in-the-loop workflow before we add agent runtime complexity?",
      chips: ["Skill: deterministic helper", "Plugin: packaged tool surface", "Agent: uses tools and state", "Human workflow with AI drafting"],
      intent: "Agent fallback when LLM response was malformed.",
      rule_fired: "fallback",
      topic: "agent_delivery_scale",
      extracts_into: { spec_path: "agentSystem.builderScale", kind: "agent_contract", merge_strategy: "merge_agent_profile" }
    };
  }
  if (method === "qfd") {
    return {
      text: "Which feature most directly serves your highest-priority user need?",
      chips: ["High \u2014 core to the job", "Medium \u2014 useful but not essential", "Low \u2014 nice-to-have only", "Not at all"],
      intent: "QFD fallback when LLM response was malformed.",
      rule_fired: "fallback",
      // QFD does not emit a JTBD slot — leave topic undefined.
      extracts_into: { spec_path: "features[*].acceptanceCriteria", kind: "weight", merge_strategy: "weight_map" }
    };
  }
  if (method === "pugh") {
    return {
      text: "Comparing your two leading approaches, which one wins on the criterion that matters most to you?",
      chips: ["Better (+)", "Same (0)", "Worse (-)"],
      intent: "Pugh fallback when LLM response was malformed.",
      rule_fired: "fallback",
      // Pugh does not emit a JTBD slot — leave topic undefined.
      extracts_into: { spec_path: "adrs[*].cites", kind: "pugh_cell", merge_strategy: "score_map" }
    };
  }
  return {
    text: "When does someone realize they need this product? What are they doing in the moments BEFORE they reach for it?",
    chips: ["Right after a sales call", "When their inbox crosses 50 unread", "End of every sprint"],
    intent: "JTBD fallback when LLM response was malformed.",
    rule_fired: "fallback",
    topic: "trigger",
    extracts_into: { spec_path: "personas[*].trigger", kind: "string", merge_strategy: "append" }
  };
}
function clampInt(n, min, max, fallback) {
  const v = typeof n === "number" ? Math.round(n) : fallback;
  if (Number.isNaN(v)) return fallback;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function weightsAreSet(weights) {
  if (!weights) return false;
  const parsed = TradeoffWeightsSchema.safeParse(weights);
  return parsed.success;
}
function ensureTradeoffWeights(state) {
  if (weightsAreSet(state.tradeoffWeights)) {
    return { productState: state, assumed: false };
  }
  const next = ProductStateSchema.parse({
    ...state,
    tradeoffWeights: DEFAULT_TRADEOFF_WEIGHTS,
    workingMemory: {
      ...state.workingMemory ?? {},
      tradeoff_weights_assumed: true
    }
  });
  return { productState: next, assumed: true };
}
function finalizeWithAssumptions(state) {
  const finalizedAt = (/* @__PURE__ */ new Date()).toISOString();
  const wm = state.workingMemory ?? {};
  const intakeAnswerCount = Array.isArray(wm.intakeAnswers) ? wm.intakeAnswers.length : 0;
  const next = ProductStateSchema.parse({
    ...state,
    workingMemory: {
      ...wm,
      user_chose_assumption_fill: true,
      assumption_fill_at: finalizedAt,
      // existing intake-progress nudges read this flag to stop firing.
      adaptive_intake_finalized: true
    }
  });
  return { productState: next, intakeAnswerCount, finalizedAt };
}
function applyTradeoffWeights(args) {
  const validated = TradeoffWeightsSchema.parse(args.weights);
  const next = ProductStateSchema.parse({
    ...args.state,
    tradeoffWeights: validated,
    workingMemory: { ...args.state.workingMemory ?? {} }
  });
  return { productState: next };
}
function hydrateProductState(raw) {
  if (!raw || typeof raw !== "object") {
    return ProductStateSchema.parse({});
  }
  const result = ProductStateSchema.safeParse(raw);
  if (result.success) return result.data;
  return ProductStateSchema.parse({});
}
function hydrateSpec(raw, fallbackId, productName, productDescription) {
  if (!raw || typeof raw !== "object") {
    return SpecSchema.parse({
      id: fallbackId,
      productName,
      productDescription
    });
  }
  const result = SpecSchema.safeParse(raw);
  if (result.success) return result.data;
  return SpecSchema.parse({
    id: fallbackId,
    productName,
    productDescription
  });
}
async function nextStep(input) {
  const { productState, history } = input;
  const opts = { llmConfig: input.llmConfig, context: input.context };
  const spec = effectiveSpecFor(productState, input.spec);
  const weightsSet = weightsAreSet(productState.tradeoffWeights);
  if (history.length >= MAX_INTAKE_STEPS) {
    if (!weightsSet) {
      return {
        action: "allocate_tradeoffs",
        axes: TRADEOFF_AXES,
        reason: `Reached MAX_INTAKE_STEPS=${MAX_INTAKE_STEPS}; collect tradeoff allocation before finalizing.`
      };
    }
    return { action: "done", reason: `Reached MAX_INTAKE_STEPS=${MAX_INTAKE_STEPS}` };
  }
  const rawCandidates = deriveCandidateUnknowns({ productState, spec });
  const askedSlots = readAskedJtbdSlots(productState);
  const candidates = askedSlots.length === 0 ? rawCandidates : rawCandidates.filter((c) => {
    const slot = jtbdSlotForCandidate({ topic: c.topic });
    if (!slot) return true;
    return !askedSlots.includes(slot);
  });
  if (candidates.length === 0) {
    if (!weightsSet) {
      return {
        action: "allocate_tradeoffs",
        axes: TRADEOFF_AXES,
        reason: "No structural gaps remain \u2014 collect 100-point tradeoff allocation before finalizing."
      };
    }
    return {
      action: "done",
      reason: history.length >= MEDIAN_TARGET ? "No structural gaps remain; intake is complete." : "No structural gaps remain \u2014 proceeding with thin spec by user choice."
    };
  }
  const scoring = await callBlockingScorer({ productState, spec, candidates }, opts);
  const top = scoring[0];
  if (top && top.blocking >= BLOCKING_THRESHOLD) {
    let method = isAgentTopic(top.topic) ? "agent" : deterministicMethodRoute({ productState, spec, candidates });
    if (!method) {
      const router = await callMethodRouter(
        { productState, spec, blockingTopUnknowns: scoring.slice(0, 3) },
        opts
      );
      method = router.method;
    }
    const question = await callMethodGenerator(
      method,
      {
        productState,
        spec,
        intakeAnswersSoFar: history,
        blockingTopUnknown: top,
        askedJtbdSlots: askedSlots
      },
      opts
    );
    if (method === "jtbd") {
      const requestedSlot = jtbdSlotForCandidate({
        topic: typeof question.topic === "string" ? question.topic : null,
        specPath: question.extracts_into?.spec_path ?? null
      });
      if (requestedSlot && askedSlots.includes(requestedSlot)) {
        const inferTargets2 = scoring.filter((s) => s.decision === "infer").slice(0, 4);
        const defaults2 = inferTargets2.length > 0 ? await callSafeDefaultsInferer({ productState, spec, topics: inferTargets2 }, opts) : [];
        return { action: "infer", defaults: defaults2, scoring };
      }
    }
    return { action: "ask", question, method, scoring };
  }
  const inferTargets = scoring.filter((s) => s.decision === "infer").slice(0, 4);
  const defaults = inferTargets.length > 0 ? await callSafeDefaultsInferer({ productState, spec, topics: inferTargets }, opts) : [];
  return { action: "infer", defaults, scoring };
}
function ingestAnswer(args) {
  const { state, answer } = args;
  const next = ProductStateSchema.parse({
    ...state,
    workingMemory: { ...state.workingMemory ?? {} }
  });
  const intakeAnswers = Array.isArray(next.workingMemory.intakeAnswers) ? [...next.workingMemory.intakeAnswers] : [];
  intakeAnswers.push({
    step: answer.step,
    method: answer.method ?? null,
    question: answer.questionText,
    answer: answer.answer,
    metadata: answer.metadata ?? {},
    answeredAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  next.workingMemory.intakeAnswers = intakeAnswers;
  promoteAnswerIntoState(next, answer);
  return { productState: next };
}
function emptyIntakeSpec() {
  return { personas: [], scenarios: [], nonGoals: [], needs: [] };
}
function readIntakeSpec(productState) {
  const raw = productState.workingMemory?.intakeSpec;
  if (!raw || typeof raw !== "object") return emptyIntakeSpec();
  const r = raw;
  return {
    personas: Array.isArray(r.personas) ? r.personas : [],
    scenarios: Array.isArray(r.scenarios) ? r.scenarios : [],
    nonGoals: Array.isArray(r.nonGoals) ? r.nonGoals : [],
    needs: Array.isArray(r.needs) ? r.needs : []
  };
}
function promoteAnswerIntoState(state, answer) {
  const dedupKey = `${answer.step}`;
  const promoted = state.workingMemory.promotedSteps ?? [];
  if (promoted.includes(dedupKey)) return;
  const meta = answer.metadata ?? {};
  const extractsInto = meta.extracts_into;
  const specPath = typeof extractsInto?.spec_path === "string" ? extractsInto.spec_path : null;
  const topic = typeof meta.topic === "string" ? meta.topic : null;
  const text3 = answer.answer.trim();
  if (answer.method === "jtbd") {
    const slot = jtbdSlotForCandidate({ topic, specPath });
    if (slot) {
      const existing = readAskedJtbdSlots(state);
      if (!existing.includes(slot)) {
        state.workingMemory.askedJtbdSlots = [...existing, slot];
      }
    } else if (topic && !isKnownNonJtbdTopic(topic)) {
      const unmapped = state.workingMemory.unmappedJtbdTopics ?? [];
      if (!unmapped.includes(topic)) {
        state.workingMemory.unmappedJtbdTopics = [...unmapped, topic];
        console.warn(
          `[intake-controller] JTBD topic "${topic}" did not map to a known slot; recorded under workingMemory.unmappedJtbdTopics`
        );
      }
    }
  }
  if (text3 === "") {
    state.workingMemory.promotedSteps = [...promoted, dedupKey];
    return;
  }
  const intakeSpec = readIntakeSpec(state);
  let didPromote = false;
  if (isAgentTopic(topic) || specPath?.startsWith("agentSystem.")) {
    didPromote = promoteAgentAnswer(state, answer, { topic, specPath, text: text3 });
  } else if (topic && topic.startsWith("stance_because_")) {
    const category = topic.slice("stance_because_".length);
    if (["privacy_data", "complexity", "cost", "category"].includes(category)) {
      const stance = [...state.stanceBecauseClauses ?? []];
      const already = stance.some((s) => s.category === category);
      if (!already) {
        stance.push({
          id: `stance-${category}-${answer.step}`,
          category,
          stance: text3,
          because: text3
        });
        state.stanceBecauseClauses = stance;
        didPromote = true;
      }
    }
  } else if (topic === "non_goals") {
    intakeSpec.nonGoals.push({
      id: `ng-${answer.step}`,
      text: text3,
      because: text3
    });
    state.workingMemory.intakeSpec = intakeSpec;
    didPromote = true;
  } else if (topic === "persona_exclusions") {
    const parts = splitListy(text3);
    const exclusions = parts.length >= 3 ? parts : [...parts, "Not power users", "Not casual hobbyists", "Not enterprise IT"].slice(0, Math.max(3, parts.length));
    if (intakeSpec.personas.length === 0) {
      intakeSpec.personas.push({ id: "p1", name: "Primary user", exclusions, jobs: [] });
    } else {
      intakeSpec.personas[0] = { ...intakeSpec.personas[0], exclusions };
    }
    state.workingMemory.intakeSpec = intakeSpec;
    didPromote = true;
  } else if (topic === "p0_need_designation") {
    intakeSpec.needs.push({ id: `n-${answer.step}`, title: text3, priority: "P0" });
    state.workingMemory.intakeSpec = intakeSpec;
    didPromote = true;
  } else if (specPath) {
    if (specPath.startsWith("personas[*].name")) {
      ensurePersona(intakeSpec, { name: text3 });
      didPromote = true;
    } else if (specPath.startsWith("personas[*].trigger")) {
      ensurePersona(intakeSpec, { trigger: text3 });
      didPromote = true;
    } else if (specPath.startsWith("personas[*].exclusions")) {
      const parts = splitListy(text3);
      ensurePersona(intakeSpec, { exclusions: parts.length >= 3 ? parts : [...parts, "Not power users", "Not casual hobbyists"].slice(0, Math.max(3, parts.length)) });
      didPromote = true;
    } else if (specPath.startsWith("personas[*].jobs")) {
      ensurePersona(intakeSpec, { jobsToAppend: [text3] });
      didPromote = true;
    } else if (specPath.startsWith("scenarios[*].context")) {
      ensureScenario(intakeSpec, { context: text3 });
      didPromote = true;
    } else if (specPath.startsWith("scenarios[*].goal")) {
      ensureScenario(intakeSpec, { goal: text3 });
      didPromote = true;
    } else if (specPath.startsWith("scenarios[*].successSignal")) {
      ensureScenario(intakeSpec, { successSignal: text3 });
      didPromote = true;
    } else if (specPath.startsWith("nonGoals")) {
      intakeSpec.nonGoals.push({ id: `ng-${answer.step}`, text: text3, because: text3 });
      didPromote = true;
    } else if (specPath.startsWith("features[*].acceptanceCriteria")) {
      const weights = state.workingMemory.qfdWeights ?? {};
      weights[`step-${answer.step}`] = text3;
      state.workingMemory.qfdWeights = weights;
      didPromote = true;
    } else if (specPath.startsWith("adrs[*].cites")) {
      const cells = state.workingMemory.pughScores ?? {};
      cells[`step-${answer.step}`] = text3;
      state.workingMemory.pughScores = cells;
      didPromote = true;
    }
    if (didPromote) state.workingMemory.intakeSpec = intakeSpec;
  } else if (answer.method) {
    if (answer.method === "jtbd") {
      const p = intakeSpec.personas[0];
      if (!p) {
        intakeSpec.personas.push({ id: "p1", name: "Primary user", trigger: text3, exclusions: [], jobs: [] });
      } else if (!p.trigger) {
        p.trigger = text3;
      } else {
        p.jobs.push(text3);
      }
      state.workingMemory.intakeSpec = intakeSpec;
      didPromote = true;
    } else if (answer.method === "qfd") {
      const weights = state.workingMemory.qfdWeights ?? {};
      weights[`step-${answer.step}`] = text3;
      state.workingMemory.qfdWeights = weights;
      didPromote = true;
    } else if (answer.method === "pugh") {
      const cells = state.workingMemory.pughScores ?? {};
      cells[`step-${answer.step}`] = text3;
      state.workingMemory.pughScores = cells;
      didPromote = true;
    }
  }
  if (!didPromote) {
    const shelf = state.workingMemory.unroutedAnswers ?? [];
    shelf.push(`step-${answer.step}: ${text3.slice(0, 200)}`);
    state.workingMemory.unroutedAnswers = shelf;
    console.warn(
      `[intake-controller] ingestAnswer: no spec_path/topic/method routing for step ${answer.step}; parked in workingMemory.unroutedAnswers`
    );
  }
  state.workingMemory.promotedSteps = [...promoted, dedupKey];
}
function promoteAgentAnswer(state, answer, input) {
  const profile = AgentSystemSchema.parse(state.agentProfile ?? {});
  const topic = normalizeAgentTopic(input.topic, input.specPath);
  const text3 = input.text.trim();
  const traceRef = `intake:${answer.step}`;
  profile.traceabilityRefs = uniqueStrings([...profile.traceabilityRefs ?? [], traceRef]);
  if (topic === "agent_delivery_scale") {
    profile.builderScale = inferBuilderScale(text3);
  } else if (topic === "agent_system_boundary") {
    if (!profile.mission) profile.mission = text3;
    profile.systemBoundary = {
      inScope: uniqueStrings([...profile.systemBoundary?.inScope ?? [], text3]),
      outOfScope: profile.systemBoundary?.outOfScope ?? []
    };
  } else if (topic === "agent_autonomy_and_checkpoints") {
    profile.autonomyLevel = profile.autonomyLevel ?? inferAutonomyLevel(text3);
    profile.humanCheckpoints = uniqueStrings([...profile.humanCheckpoints ?? [], text3]);
  } else if (topic === "agent_tool_permissions") {
    const tier = inferToolPermissionTier(text3);
    profile.toolContracts = [
      ...profile.toolContracts ?? [],
      {
        id: `tool-${answer.step}`,
        name: inferToolName(text3, answer.step),
        purpose: text3,
        permissionTier: tier,
        allowedActions: [text3],
        forbiddenActions: inferForbiddenActions(text3),
        dataAccess: inferDataAccess(text3),
        sideEffects: inferSideEffects(text3),
        requiresHumanApproval: requiresApproval(text3, tier),
        auditLog: "Record tool name, input summary, output summary, approval state, and error state.",
        rollbackPlan: /write|update|delete|deploy|send|purchase|spend/i.test(text3) ? "Define rollback before enabling this tool in production." : void 0,
        failureMode: "Stop with a visible reason when permissions, source evidence, or required input is missing."
      }
    ];
  } else if (topic === "agent_memory_and_sources") {
    profile.memoryPolicy = text3;
    const existingResearch = profile.researchProtocol ?? {
      citationRequired: false,
      evidenceRefs: [],
      openQuestions: []
    };
    profile.researchProtocol = {
      ...existingResearch,
      evidenceRefs: existingResearch.evidenceRefs ?? [],
      openQuestions: existingResearch.openQuestions ?? [],
      sourcePolicy: existingResearch.sourcePolicy ?? text3,
      evidenceStandard: existingResearch.evidenceStandard ?? inferEvidenceStandard(text3),
      confidencePolicy: existingResearch.confidencePolicy ?? "Preserve uncertainty; label assumptions and unsupported claims before acting on them.",
      citationRequired: existingResearch.citationRequired ?? /source|cite|citation|evidence|research/i.test(text3)
    };
  } else if (topic === "agent_flow_topology") {
    profile.architecturePattern = profile.architecturePattern ?? inferArchitecturePattern(text3);
    profile.stateOwner = profile.stateOwner ?? text3;
    profile.stopCondition = profile.stopCondition ?? text3;
  } else if (topic === "agent_guardrails") {
    profile.guardrails = [
      ...profile.guardrails ?? [],
      {
        id: `guardrail-${answer.step}`,
        appliesTo: ["agent-runtime"],
        trigger: text3,
        check: "Detect the named failure mode before the agent uses tools or returns a final answer.",
        action: "Block, ask for human confirmation, or escalate with a visible reason.",
        severity: /must|never|block|pii|credential|delete|send|spend|external/i.test(text3) ? "block" : "warn",
        escalation: "Ask the user when the guardrail triggers and no safe default exists."
      }
    ];
  } else if (topic === "agent_evaluation_readiness") {
    profile.evaluations = [
      ...profile.evaluations ?? [],
      {
        id: `eval-${answer.step}`,
        name: "Agent readiness",
        metric: text3,
        coverageRefs: [],
        blocking: true
      }
    ];
  } else if (topic === "agent_ui_research_protocol") {
    profile.uiProtocol = {
      ...profile.uiProtocol ?? {},
      archetype: profile.uiProtocol?.archetype ?? inferUiArchetype(text3),
      userResearchQuestions: uniqueStrings([
        ...profile.uiProtocol?.userResearchQuestions ?? [],
        text3
      ]),
      highRiskFailures: profile.uiProtocol?.highRiskFailures ?? []
    };
    const existingResearch = profile.researchProtocol ?? {
      citationRequired: false,
      evidenceRefs: [],
      openQuestions: []
    };
    profile.researchProtocol = {
      ...existingResearch,
      citationRequired: existingResearch.citationRequired ?? false,
      evidenceRefs: existingResearch.evidenceRefs ?? [],
      evidenceStandard: existingResearch.evidenceStandard ?? inferEvidenceStandard(text3),
      openQuestions: uniqueStrings([
        ...existingResearch.openQuestions ?? [],
        text3
      ])
    };
  } else {
    if (!profile.mission) profile.mission = text3;
  }
  state.agentProfile = AgentSystemSchema.parse(profile);
  return true;
}
function normalizeAgentTopic(topic, specPath) {
  if (isAgentTopic(topic)) return topic;
  if (!specPath) return "agent_system_boundary";
  if (specPath.includes("autonomy") || specPath.includes("humanCheckpoints")) return "agent_autonomy_and_checkpoints";
  if (specPath.includes("builderScale")) return "agent_delivery_scale";
  if (specPath.includes("toolContracts")) return "agent_tool_permissions";
  if (specPath.includes("memoryPolicy") || specPath.includes("researchProtocol")) return "agent_memory_and_sources";
  if (specPath.includes("architecturePattern") || specPath.includes("stateOwner") || specPath.includes("stopCondition")) return "agent_flow_topology";
  if (specPath.includes("guardrails")) return "agent_guardrails";
  if (specPath.includes("evaluations")) return "agent_evaluation_readiness";
  if (specPath.includes("uiProtocol")) return "agent_ui_research_protocol";
  return "agent_system_boundary";
}
function inferAutonomyLevel(text3) {
  if (/draft|suggest|recommend|no tool|read-only|read only/i.test(text3)) return "draft-only";
  if (/approval|approve|ask|human|review|confirm/i.test(text3)) return "human-in-loop";
  if (/supervised|audit|logged|reversible|sandbox/i.test(text3)) return "supervised";
  if (/autonomous|without approval|fully/i.test(text3)) return "autonomous";
  return "human-in-loop";
}
function inferBuilderScale(text3) {
  if (/human|manual|operator|review workflow|workflow/i.test(text3)) return "human";
  if (/plugin|package|connector|mcp|command|skill bundle/i.test(text3)) return "plugin";
  if (/agent|autonomous|tool use|tool-using|memory|state|plan|multi[- ]agent/i.test(text3)) return "agent";
  return "skill";
}
function inferToolPermissionTier(text3) {
  if (/no tool|no-tool|none/i.test(text3)) return "T0";
  if (/delete|deploy|purchase|spend|payment|irreversible|production/i.test(text3)) return "T5";
  if (/email|message|notify|post|send|publish|external communication/i.test(text3)) return "T4";
  if (/write|update|create|edit|commit|patch/i.test(text3)) return "T3";
  if (/search|read external|api|web|browser|fetch|research/i.test(text3)) return "T2";
  if (/read local|local file|inspect|scan local/i.test(text3)) return "T1";
  return "T2";
}
function inferArchitecturePattern(text3) {
  if (/multi[- ]agent/i.test(text3)) return "multi-agent";
  if (/orchestrator|worker|manager/i.test(text3)) return "orchestrator-worker";
  if (/evaluator|critic|optimizer|judge/i.test(text3)) return "evaluator-optimizer";
  if (/router|route|classify/i.test(text3)) return "router";
  if (/interactive|human|chat|approve/i.test(text3)) return "interactive";
  if (/sequence|pipeline|step/i.test(text3)) return "sequential";
  if (/hybrid/i.test(text3)) return "hybrid";
  return "single-agent";
}
function inferUiArchetype(text3) {
  if (/chat|conversation|assistant|copilot/i.test(text3)) return "ai-agent-chat";
  if (/editor|canvas|workbench|builder/i.test(text3)) return "editor-workbench";
  if (/research|evidence|source|analysis|dataset/i.test(text3)) return "data-research-tool";
  if (/admin|ops|internal/i.test(text3)) return "internal-admin";
  if (/dashboard|metrics|saas/i.test(text3)) return "saas-dashboard";
  return "ai-agent-chat";
}
function inferToolName(text3, step) {
  const cleaned = text3.replace(/[^a-z0-9\s-]/gi, " ").trim().split(/\s+/).filter((word) => word.length > 2).slice(0, 4).join(" ");
  return cleaned || `Tool contract ${step}`;
}
function inferForbiddenActions(text3) {
  const forbidden = [];
  if (!/delete/i.test(text3)) forbidden.push("delete without approval");
  if (!/spend|purchase|payment/i.test(text3)) forbidden.push("spend money without approval");
  if (!/send|email|message|notify/i.test(text3)) forbidden.push("contact external people without approval");
  return forbidden;
}
function inferDataAccess(text3) {
  if (/pii|personal|email|customer|user data|credential/i.test(text3)) return "Potential sensitive data; require least-privilege access and redaction.";
  if (/research|source|web|external/i.test(text3)) return "External source data; preserve provenance and confidence.";
  if (/local|file/i.test(text3)) return "Local project files only.";
  return void 0;
}
function inferSideEffects(text3) {
  const effects = [];
  if (/write|update|create|edit|commit|patch/i.test(text3)) effects.push("writes project state or files");
  if (/send|email|message|notify|publish/i.test(text3)) effects.push("external communication");
  if (/delete|deploy|purchase|spend|payment/i.test(text3)) effects.push("irreversible or high-impact external action");
  return effects;
}
function requiresApproval(text3, tier) {
  return tier === "T4" || tier === "T5" || /approval|approve|human|ask|confirm|irreversible|production/i.test(text3);
}
function inferEvidenceStandard(text3) {
  if (/two|2|corroborat|multiple/i.test(text3)) return "Require corroboration for factual or numeric claims.";
  if (/cite|citation|source|evidence/i.test(text3)) return "Return source-backed claims with citations and confidence labels.";
  return "Separate observed evidence, assumptions, and open questions.";
}
function uniqueStrings(values) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}
function ensurePersona(intakeSpec, patch) {
  if (intakeSpec.personas.length === 0) {
    intakeSpec.personas.push({
      id: "p1",
      name: patch.name ?? "Primary user",
      trigger: patch.trigger,
      exclusions: patch.exclusions ?? [],
      jobs: patch.jobsToAppend ?? []
    });
    return;
  }
  const p = intakeSpec.personas[0];
  if (patch.name && p.name === "Primary user") p.name = patch.name;
  if (patch.trigger && !p.trigger) p.trigger = patch.trigger;
  if (patch.exclusions && p.exclusions.length < patch.exclusions.length) p.exclusions = patch.exclusions;
  if (patch.jobsToAppend) p.jobs = [...p.jobs, ...patch.jobsToAppend];
}
function ensureScenario(intakeSpec, patch) {
  if (intakeSpec.scenarios.length === 0) {
    intakeSpec.scenarios.push({
      id: "s1",
      personaId: intakeSpec.personas[0]?.id,
      context: patch.context ?? "",
      goal: patch.goal ?? "",
      successSignal: patch.successSignal
    });
    return;
  }
  const s = intakeSpec.scenarios[0];
  if (patch.context && !s.context) s.context = patch.context;
  if (patch.goal && !s.goal) s.goal = patch.goal;
  if (patch.successSignal && !s.successSignal) s.successSignal = patch.successSignal;
}
function splitListy(text3) {
  const lines = text3.split(/\n+/).map((line) => line.replace(/^\s*[-*•]\s*/, "").trim()).filter((line) => line.length > 0);
  if (lines.length > 1) return lines.slice(0, 6);
  const parts = text3.split(/[,;]\s+/).map((p) => p.trim()).filter((p) => p.length > 0);
  return parts.length > 1 ? parts.slice(0, 6) : [text3];
}
function effectiveSpecFor(productState, baseSpec) {
  const intakeSpec = readIntakeSpec(productState);
  const agentProfile = productState.agentProfile;
  if (intakeSpec.personas.length === 0 && intakeSpec.scenarios.length === 0 && intakeSpec.nonGoals.length === 0 && intakeSpec.needs.length === 0 && !agentProfile) {
    return baseSpec;
  }
  const merged = {
    ...baseSpec,
    personas: baseSpec.personas.length > 0 ? baseSpec.personas : intakeSpec.personas,
    scenarios: baseSpec.scenarios.length > 0 ? baseSpec.scenarios : intakeSpec.scenarios,
    nonGoals: [
      ...baseSpec.nonGoals,
      ...intakeSpec.nonGoals.filter((ng) => !baseSpec.nonGoals.some((b) => b.id === ng.id))
    ],
    needs: [
      ...baseSpec.needs,
      ...intakeSpec.needs.filter((n) => !baseSpec.needs.some((b) => b.id === n.id))
    ]
  };
  if (agentProfile) {
    merged.agentSystem = mergeAgentSystems(baseSpec.agentSystem, agentProfile);
    if (merged.platformTarget === "web" && hasAgenticSignal({ productState, spec: merged })) {
      merged.platformTarget = "agent-system";
    }
  }
  return SpecSchema.parse(merged);
}
function mergeAgentSystems(base, incoming) {
  const b = AgentSystemSchema.parse(base ?? {});
  const i = AgentSystemSchema.parse(incoming ?? {});
  return AgentSystemSchema.parse({
    ...i,
    ...b,
    mission: b.mission ?? i.mission,
    systemBoundary: {
      inScope: uniqueStrings([...b.systemBoundary?.inScope ?? [], ...i.systemBoundary?.inScope ?? []]),
      outOfScope: uniqueStrings([...b.systemBoundary?.outOfScope ?? [], ...i.systemBoundary?.outOfScope ?? []])
    },
    modelRoutes: mergeById(b.modelRoutes, i.modelRoutes),
    toolContracts: mergeById(b.toolContracts, i.toolContracts),
    guardrails: mergeById(b.guardrails, i.guardrails),
    evaluations: mergeById(b.evaluations, i.evaluations),
    humanCheckpoints: uniqueStrings([...b.humanCheckpoints ?? [], ...i.humanCheckpoints ?? []]),
    traceabilityRefs: uniqueStrings([...b.traceabilityRefs ?? [], ...i.traceabilityRefs ?? []]),
    researchProtocol: {
      ...i.researchProtocol ?? {},
      ...b.researchProtocol ?? {},
      evidenceRefs: uniqueStrings([
        ...b.researchProtocol?.evidenceRefs ?? [],
        ...i.researchProtocol?.evidenceRefs ?? []
      ]),
      openQuestions: uniqueStrings([
        ...b.researchProtocol?.openQuestions ?? [],
        ...i.researchProtocol?.openQuestions ?? []
      ])
    },
    uiProtocol: {
      ...i.uiProtocol ?? {},
      ...b.uiProtocol ?? {},
      userResearchQuestions: uniqueStrings([
        ...b.uiProtocol?.userResearchQuestions ?? [],
        ...i.uiProtocol?.userResearchQuestions ?? []
      ]),
      highRiskFailures: uniqueStrings([
        ...b.uiProtocol?.highRiskFailures ?? [],
        ...i.uiProtocol?.highRiskFailures ?? []
      ])
    }
  });
}
function mergeById(base, incoming) {
  const map = /* @__PURE__ */ new Map();
  for (const item of incoming) map.set(item.id, item);
  for (const item of base) map.set(item.id, item);
  return Array.from(map.values());
}
function finalize(args) {
  const baseSpec = args.existingSpec ? args.existingSpec : SpecSchema.parse({
    id: `spec-${args.projectId}`,
    productName: args.productName,
    productDescription: args.productDescription
  });
  const intakeAnswers = Array.isArray(args.productState.workingMemory?.intakeAnswers) ? args.productState.workingMemory.intakeAnswers : [];
  const merged = effectiveSpecFor(args.productState, baseSpec);
  const augmentedSpec = {
    ...merged,
    assumptions: [
      ...merged.assumptions,
      ...intakeAnswers.map((row, i) => ({
        id: `intake-${i}`,
        text: `${row.question} \u2192 ${row.answer}`,
        confidence: "medium"
      }))
    ]
  };
  const renderedMarkdown = renderBrief(augmentedSpec);
  return { spec: augmentedSpec, renderedMarkdown };
}
async function assessDiscoverySufficiency(messages2, opts) {
  const allOpen = () => ({
    sections: SECTIONS.map((s) => ({ key: s.key, label: s.short, state: "open" })),
    enough: false
  });
  const hasUser = messages2.some(
    (m) => m.role === "user" && typeof m.content === "string" && m.content.trim() !== ""
  );
  if (!hasUser) return allOpen();
  const transcript = messages2.filter((m) => typeof m.content === "string" && m.content.trim() !== "").map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content.trim()}`).join("\n");
  let raw;
  try {
    raw = await aiService.generateStructuredOutput(
      [
        { role: "system", content: DISCOVERY_SUFFICIENCY_PROMPT },
        { role: "user", content: transcript }
      ],
      "claude-haiku",
      opts.llmConfig ?? null,
      "classification",
      opts.context
    );
  } catch {
    return allOpen();
  }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.sections)) return allOpen();
  const byKey = /* @__PURE__ */ new Map();
  for (const row of raw.sections) {
    const key = typeof row?.key === "string" ? row.key : "";
    const state = ["covered", "inferred", "open"].includes(row?.state) ? row.state : "open";
    if (key) byKey.set(key, state);
  }
  const sections = SECTIONS.map((s) => ({
    key: s.key,
    label: s.short,
    state: byKey.get(s.key) ?? "open"
  }));
  const openCount = sections.filter((s) => s.state === "open").length;
  const coreOpen = sections.some((s) => (s.key === "brief" || s.key === "north-star") && s.state === "open");
  const enough = !coreOpen && openCount <= 2;
  return { sections, enough };
}
var MAX_INTAKE_STEPS, MEDIAN_TARGET, BLOCKING_THRESHOLD, ALL_JTBD_SLOTS, DEFAULT_TRADEOFF_WEIGHTS, DISCOVERY_SUFFICIENCY_PROMPT;
var init_intake_controller = __esm({
  "server/services/intake-controller.ts"() {
    "use strict";
    init_schema();
    init_prompts();
    init_ai();
    init_secret_crypto();
    init_spec_renderer();
    init_intake_sections();
    MAX_INTAKE_STEPS = 9;
    MEDIAN_TARGET = 5;
    BLOCKING_THRESHOLD = 6;
    ALL_JTBD_SLOTS = [
      "persona",
      "trigger",
      "exclusions",
      "outcome",
      "jobs",
      "non_goals",
      "priority"
    ];
    DEFAULT_TRADEOFF_WEIGHTS = {
      speed_to_alpha: 18,
      scalability: 16,
      ux_polish: 18,
      maintainability: 16,
      cost: 16,
      security: 16,
      unacceptable_tradeoff: "security"
    };
    DISCOVERY_SUFFICIENCY_PROMPT = `You assess how complete a product-discovery conversation is for generating first-draft product documents. The six document sections are:
- brief: the core problem, who it is for, and what the product is
- north-star: the target persona(s), their trigger / job-to-be-done, and the measurable success outcome
- ux: the key screens, the primary user action, and the main flows
- architecture: data, integrations / external APIs, and the key technical decisions
- coding-prompts: enough specificity to hand off to a builder (features + acceptance)
- dev-guide: delivery / rollout, risks, and explicit non-goals
For EACH section return a state:
- "covered": the conversation gives real, usable detail for this section
- "inferred": not stated outright but reasonably inferable from what was said
- "open": a genuine gap a builder would still need filled
Return ONLY valid JSON: {"sections":[{"key":"brief","state":"covered|inferred|open"}, ... all six keys ...]}
Use exactly these keys: brief, north-star, ux, architecture, coding-prompts, dev-guide.`;
  }
});

// server/services/open-questions.ts
var open_questions_exports = {};
__export(open_questions_exports, {
  applyAnswer: () => applyAnswer,
  extractOpenQuestions: () => extractOpenQuestions,
  mergeOpenQuestions: () => mergeOpenQuestions
});
function extractOpenQuestions(input) {
  if (!input.content) return [];
  const trailerMatch = input.content.match(TRAILER_RE);
  if (trailerMatch) {
    try {
      const raw = JSON.parse(trailerMatch[1]);
      if (Array.isArray(raw)) {
        const parsed = [];
        for (const row of raw) {
          const result = OpenQuestionSchema.safeParse({
            ...row,
            stageId: input.stageId,
            stageNumber: input.stageNumber ?? row?.stageNumber
          });
          if (result.success) parsed.push(result.data);
        }
        if (parsed.length > 0) return parsed;
      }
    } catch {
    }
  }
  const lines = input.content.split(/\r?\n/);
  const collected = [];
  let inSection = false;
  let topicCounter = 0;
  for (const line of lines) {
    if (HEADING_RE.test(line.trim())) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,6}\s+/.test(line)) {
        inSection = false;
        continue;
      }
      const match = line.match(LIST_ITEM_RE);
      if (match) {
        const prompt = match[1].trim();
        if (prompt.length >= 6 && prompt.length <= 500) {
          collected.push({
            topicId: `oq-${input.stageId}-${topicCounter++}`,
            prompt,
            stageId: input.stageId,
            stageNumber: input.stageNumber,
            answerKind: "text"
          });
        }
      }
    }
  }
  return collected;
}
function mergeOpenQuestions(existing, incoming) {
  const byKey = /* @__PURE__ */ new Map();
  for (const row of existing ?? []) {
    byKey.set(`${row.stageId ?? ""}::${row.topicId}`, row);
  }
  const merged = [];
  for (const row of incoming) {
    const key = `${row.stageId ?? ""}::${row.topicId}`;
    const prior = byKey.get(key);
    if (prior?.answeredValue) {
      merged.push({
        ...row,
        answeredValue: prior.answeredValue,
        answeredAt: prior.answeredAt
      });
    } else {
      merged.push(row);
    }
    byKey.delete(key);
  }
  byKey.forEach((remaining) => {
    merged.push(remaining);
  });
  return merged;
}
function applyAnswer(list, args) {
  let found = false;
  const updated = list.map((row) => {
    const stageMatches = !args.stageId || row.stageId === args.stageId;
    if (stageMatches && row.topicId === args.topicId) {
      found = true;
      return {
        ...row,
        answeredValue: args.answer,
        answeredAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    return row;
  });
  return { list: updated, found };
}
var TRAILER_RE, HEADING_RE, LIST_ITEM_RE;
var init_open_questions = __esm({
  "server/services/open-questions.ts"() {
    "use strict";
    init_schema();
    TRAILER_RE = /<!--\s*open-questions\s*:\s*(\[[\s\S]*?\])\s*-->/i;
    HEADING_RE = /^#{1,6}\s*(open questions|missing information(\s+needed)?)\s*$/i;
    LIST_ITEM_RE = /^\s*[-*]\s+(.+?)\s*$/;
  }
});

// server/services/title-generator.ts
var title_generator_exports = {};
__export(title_generator_exports, {
  deriveProjectTitle: () => deriveProjectTitle,
  hasEnoughSignalForTitle: () => hasEnoughSignalForTitle
});
function truncate(input) {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_TITLE) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE - 1).trimEnd()}\u2026`;
}
function clean(input) {
  return input.replace(/^\s*(an?|the|a tool that|a system that|an app that|app that|tool for|tool that)\s+/i, "").replace(/[.,;:!?]+$/g, "").trim();
}
function findAnswer(rows, predicate) {
  for (const row of rows) {
    if (!predicate(row)) continue;
    const ans = row.answer;
    if (typeof ans === "string" && ans.trim().length >= 3) return clean(ans);
    if (ans && typeof ans === "object") {
      const text3 = ans.text;
      if (typeof text3 === "string" && text3.trim().length >= 3) return clean(text3);
    }
  }
  return null;
}
function deriveProjectTitle(input) {
  const intakeAnswers = Array.isArray(input.productState?.workingMemory?.intakeAnswers) ? input.productState.workingMemory.intakeAnswers : [];
  const persona = input.spec?.personas?.[0];
  if (persona) {
    const role = clean(persona.name ?? "");
    const trigger = clean(persona.trigger ?? "");
    if (role.length >= 3 && trigger.length >= 3) {
      return {
        name: truncate(`${role}: ${trigger}`),
        source: "persona_pain",
        derivedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (role.length >= 3) {
      return {
        name: truncate(`${role}'s tool`),
        source: "persona_pain",
        derivedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  const icp = findAnswer(
    intakeAnswers,
    (r) => /icp|persona|user|audience|customer|who/i.test(`${r.step ?? ""} ${r.question ?? ""}`)
  );
  const problem = findAnswer(
    intakeAnswers,
    (r) => /problem|pain|gap|struggle|frustr/i.test(`${r.step ?? ""} ${r.question ?? ""}`)
  );
  if (icp && problem) {
    return {
      name: truncate(`${icp}: ${problem}`),
      source: "icp_pain",
      derivedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (problem) {
    return {
      name: truncate(problem),
      source: "problem_statement",
      derivedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (input.minimumDetails && typeof input.minimumDetails === "object") {
    const ps = input.minimumDetails.problemStatement;
    if (typeof ps === "string" && ps.trim().length >= 4) {
      return {
        name: truncate(clean(ps)),
        source: "problem_statement",
        derivedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  if (typeof input.description === "string") {
    const stripped = input.description.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
    if (stripped.length >= 4) {
      return {
        name: truncate(clean(stripped)),
        source: "description",
        derivedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  return null;
}
function hasEnoughSignalForTitle(input) {
  if (input.spec?.personas && input.spec.personas.length > 0) return true;
  const rows = Array.isArray(input.productState?.workingMemory?.intakeAnswers) ? input.productState.workingMemory.intakeAnswers : [];
  const hasIcp = !!findAnswer(
    rows,
    (r) => /icp|persona|user|audience|customer|who/i.test(`${r.step ?? ""} ${r.question ?? ""}`)
  );
  const hasProblem = !!findAnswer(
    rows,
    (r) => /problem|pain|gap|struggle|frustr/i.test(`${r.step ?? ""} ${r.question ?? ""}`)
  );
  return hasIcp && hasProblem;
}
var MAX_TITLE;
var init_title_generator = __esm({
  "server/services/title-generator.ts"() {
    "use strict";
    MAX_TITLE = 60;
  }
});

// server/services/spec-linter.ts
var spec_linter_exports = {};
__export(spec_linter_exports, {
  lintSpec: () => lintSpec,
  lintSpecSync: () => lintSpecSync,
  runFidelityCheck: () => runFidelityCheck,
  sanitizeWaiverReason: () => sanitizeWaiverReason
});
function hasBecauseClause(state, pattern) {
  if (!state || !state.stanceBecauseClauses) return false;
  return state.stanceBecauseClauses.some(
    (c) => pattern.test(`${c.stance} ${c.because}`) && (c.because ?? "").trim().length > 0
  );
}
function hasNonGoalBecause(spec, pattern) {
  return spec.nonGoals.some((g) => pattern.test(`${g.text} ${g.because}`) && (g.because ?? "").trim().length > 0);
}
function hasRiskMitigation(spec, pattern) {
  return spec.risks.some((r) => pattern.test(`${r.text} ${r.mitigation ?? ""}`));
}
function runFidelityCheck(spec, productState) {
  const failures = [];
  let derivedCount = 0;
  for (const q of FIDELITY_QUESTIONS) {
    if (q.predictor(spec, productState ?? null)) {
      derivedCount++;
    } else {
      failures.push({ id: q.id, question: q.question });
    }
  }
  return {
    derivedCount,
    total: FIDELITY_QUESTIONS.length,
    threshold: FIDELITY_THRESHOLD,
    failures,
    passes: derivedCount >= FIDELITY_THRESHOLD
  };
}
function nextIssueId(rule) {
  issueIdCounter = (issueIdCounter + 1) % 1e6;
  return `lint-${rule}-${issueIdCounter}`;
}
function makeIssue(args) {
  return {
    id: args.id ?? nextIssueId(args.rule),
    rule: args.rule,
    severity: args.severity,
    waivable: args.waivable,
    message: args.message,
    refs: args.refs ?? []
  };
}
function truncate2(s, n) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}\u2026`;
}
function deterministicCheck(input) {
  const issues = [];
  const push = (i) => issues.push(i);
  const { spec, productState } = input;
  for (const need of spec.needs) {
    if (need.priority !== "P0") continue;
    const hasTest = spec.tests.some((t) => t.needIds.includes(need.id));
    if (!hasTest) {
      push(makeIssue({
        rule: "p0_need_missing_test",
        severity: "warn",
        waivable: true,
        message: `P0 Need ${need.id} ('${truncate2(need.title, 60)}') has no Test referencing it.`,
        refs: [{ kind: "need", id: need.id }]
      }));
    }
  }
  for (const dp of spec.dataPoints) {
    if (dp.pii !== true) continue;
    if (!dp.handlingNote || dp.handlingNote.trim().length === 0) {
      push(makeIssue({
        rule: "pii_handling_note_missing",
        severity: "warn",
        waivable: false,
        message: `DataPoint ${dp.id} ('${dp.name}') is marked pii=true with no handlingNote \u2014 non-waivable.`,
        refs: [{ kind: "datapoint", id: dp.id }]
      }));
    }
  }
  for (const adr of spec.adrs) {
    if (adr.reversibility !== "low") continue;
    if (adr.cites.length === 0) {
      push(makeIssue({
        rule: "low_reversibility_adr_uncited",
        severity: "warn",
        waivable: true,
        message: `ADR ${adr.id} ('${truncate2(adr.title, 60)}') is low-reversibility with empty cites[]; cite the Needs/Features it justifies.`,
        refs: [{ kind: "adr", id: adr.id }]
      }));
    }
  }
  const stanceIds = /* @__PURE__ */ new Set();
  for (const s of productState?.stanceBecauseClauses ?? []) stanceIds.add(s.id);
  const axisPattern = new RegExp(
    `(${[...TRADEOFF_AXES, "unacceptable_tradeoff"].join("|")})`,
    "i"
  );
  for (const adr of spec.adrs) {
    if (adr.cites.length === 0) {
      push(makeIssue({
        rule: "adr_missing_weight_or_stance_citation",
        severity: "warn",
        waivable: true,
        message: `ADR ${adr.id} ('${truncate2(adr.title, 60)}') has empty cites[] \u2014 every ADR must cite at least one tradeoff axis (e.g. "speed_to_alpha") OR a stance "because" id (e.g. "stance:s-1").`,
        refs: [{ kind: "adr", id: adr.id }]
      }));
      continue;
    }
    const hasAxis = adr.cites.some((c) => axisPattern.test(c));
    const hasStance = adr.cites.some(
      (c) => c.startsWith("stance:") || stanceIds.has(c)
    );
    if (!hasAxis && !hasStance) {
      push(makeIssue({
        rule: "adr_missing_weight_or_stance_citation",
        severity: "warn",
        waivable: true,
        message: `ADR ${adr.id} ('${truncate2(adr.title, 60)}') cites[] does not reference any tradeoff axis or stance "because" clause; cite at least one.`,
        refs: [{ kind: "adr", id: adr.id }]
      }));
    }
  }
  if (productState?.stanceBecauseClauses) {
    for (const stance of productState.stanceBecauseClauses) {
      if (!stance.because || stance.because.trim().length === 0) {
        push(makeIssue({
          rule: "stance_because_missing",
          severity: "warn",
          waivable: true,
          message: `Stance ${stance.id} (${stance.category}) has an empty 'because' clause.`,
          refs: [{ kind: "stance", id: stance.id }]
        }));
      }
    }
  }
  for (const ng of spec.nonGoals) {
    if (!ng.because || ng.because.trim().length === 0) {
      push(makeIssue({
        rule: "non_goal_because_missing",
        severity: "warn",
        waivable: true,
        message: `NonGoal ${ng.id} ('${truncate2(ng.text, 60)}') has an empty 'because' clause.`,
        refs: [{ kind: "non_goal", id: ng.id }]
      }));
    }
  }
  const platformRules = PLATFORM_RULES[spec.platformTarget];
  if (platformRules) {
    for (const test of spec.tests) {
      const framework = (test.testFramework ?? "").trim();
      if (framework.length === 0) {
        push(makeIssue({
          rule: "test_framework_missing",
          severity: "warn",
          waivable: true,
          message: `Test ${test.id} ('${truncate2(test.description, 60)}') has no testFramework \u2014 required for platform '${spec.platformTarget}' (${platformRules.expectedFrameworks}).`,
          refs: [{ kind: "test", id: test.id }]
        }));
        continue;
      }
      if (!platformRules.testFrameworkPattern.test(framework)) {
        push(makeIssue({
          rule: "test_framework_platform_mismatch",
          severity: "warn",
          waivable: true,
          message: `Test ${test.id} testFramework '${framework}' is not appropriate for platform '${spec.platformTarget}' \u2014 expected ${platformRules.expectedFrameworks}.`,
          refs: [{ kind: "test", id: test.id }]
        }));
      }
    }
    if (platformRules.extras) {
      platformRules.extras(spec, push);
    }
  }
  const fidelity = runFidelityCheck(spec, productState ?? null);
  if (!fidelity.passes) {
    push(makeIssue({
      rule: "stage1_fidelity_below_threshold",
      severity: "warn",
      waivable: true,
      message: `Brief is light: ${fidelity.derivedCount}/${fidelity.total} tactical answers derivable. Generation will proceed with assumptions flagged inline.`,
      refs: []
    }));
  }
  return issues;
}
async function llmCheck(input) {
  const hasKey = !!input.llmConfig?.apiKey || !!process.env.GROQ_API_KEY || !!process.env.ANTHROPIC_API_KEY;
  if (!hasKey) return { issues: [], ran: false };
  const validIds = /* @__PURE__ */ new Set();
  for (const arr of [
    spec_.needs(input.spec),
    spec_.features(input.spec),
    spec_.personas(input.spec),
    spec_.scenarios(input.spec),
    spec_.uxFlows(input.spec),
    spec_.screens(input.spec),
    spec_.dataPoints(input.spec),
    spec_.integrations(input.spec),
    spec_.apiContracts(input.spec),
    spec_.tests(input.spec),
    spec_.adrs(input.spec),
    spec_.assumptions(input.spec),
    spec_.risks(input.spec),
    spec_.nonGoals(input.spec)
  ]) {
    for (const e of arr) validIds.add(e.id);
  }
  for (const s of input.productState?.stanceBecauseClauses ?? []) validIds.add(s.id);
  const userPayload = scrubSecretsDeep({
    spec: input.spec,
    productState: input.productState ?? null
  });
  const messages2 = [
    { role: "system", content: SPEC_REVIEW_PROMPT_CONTENT },
    { role: "user", content: JSON.stringify(userPayload) }
  ];
  let parsed;
  try {
    parsed = await aiService.generateStructuredOutput(
      messages2,
      spec_review_default.defaultModel,
      input.llmConfig ?? null,
      "classification",
      input.context
    );
  } catch {
    return { issues: [], ran: false };
  }
  if (!Array.isArray(parsed)) return { issues: [], ran: true };
  const issues = [];
  const seenCategories = /* @__PURE__ */ new Set();
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const category = typeof raw.category === "string" ? raw.category : "";
    if (!ALLOWED_LLM_CATEGORIES.has(category)) continue;
    if (seenCategories.has(category)) continue;
    const message = typeof raw.message === "string" ? raw.message.slice(0, 240) : "";
    if (message.length === 0) continue;
    const refs = Array.isArray(raw.refs) ? raw.refs : [];
    const safeRefs = refs.filter((r) => r && typeof r === "object" && typeof r.kind === "string" && ALLOWED_LLM_KINDS.has(r.kind) && typeof r.id === "string" && validIds.has(r.id)).slice(0, 4).map((r) => ({ kind: r.kind, id: r.id }));
    seenCategories.add(category);
    issues.push(makeIssue({
      rule: `llm.${category}`,
      // LLM tier never blocks; only the deterministic tier can.
      severity: category === "unresolved_contradiction" ? "warn" : "info",
      waivable: true,
      message,
      refs: safeRefs
    }));
  }
  return { issues, ran: true };
}
async function lintSpec(input) {
  const deterministic = deterministicCheck(input);
  const { issues: fromLlm, ran } = await llmCheck(input);
  const issues = [...deterministic, ...fromLlm];
  return {
    issues,
    blockerCount: issues.filter((i) => i.severity === "block").length,
    nonWaivableCount: issues.filter((i) => i.waivable === false).length,
    llmRan: ran
  };
}
function lintSpecSync(input) {
  const issues = deterministicCheck(input);
  return {
    issues,
    blockerCount: issues.filter((i) => i.severity === "block").length,
    nonWaivableCount: issues.filter((i) => i.waivable === false).length,
    llmRan: false
  };
}
function sanitizeWaiverReason(raw) {
  if (typeof raw !== "string") return "";
  const cleaned = Array.from(raw).filter((ch) => {
    const code = ch.charCodeAt(0);
    if (code === 9 || code === 10) return true;
    if (code < 32 || code === 127) return false;
    return true;
  }).join("");
  const escaped = cleaned.replace(/[<>]/g, (c) => c === "<" ? "&lt;" : "&gt;");
  return escaped.trim().slice(0, 1e3);
}
var PLATFORM_RULES, FIDELITY_QUESTIONS, FIDELITY_THRESHOLD, issueIdCounter, ALLOWED_LLM_KINDS, ALLOWED_LLM_CATEGORIES, spec_;
var init_spec_linter = __esm({
  "server/services/spec-linter.ts"() {
    "use strict";
    init_ai();
    init_secret_crypto();
    init_spec_review();
    init_schema();
    PLATFORM_RULES = {
      web: {
        testFrameworkPattern: /vitest|jest|playwright/i,
        expectedFrameworks: "Vitest, Jest, or Playwright"
      },
      "vite-spa": {
        testFrameworkPattern: /vitest|playwright/i,
        expectedFrameworks: "Vitest (preferred) or Playwright"
      },
      ios: {
        testFrameworkPattern: /xctest|swift\s*testing/i,
        expectedFrameworks: "XCTest or Swift Testing",
        extras: (spec, push) => {
          const haystack = [
            spec.productDescription,
            ...spec.screens.flatMap((s) => [s.purpose, ...s.states]),
            ...spec.uxFlows.flatMap((f) => f.steps)
          ].join(" \n ").toLowerCase();
          const mentionsDynamicType = /dynamic\s*type/.test(haystack);
          const mentionsVoiceOver = /voiceover|voice over|voice-over/.test(haystack);
          if (!mentionsDynamicType || !mentionsVoiceOver) {
            push(makeIssue({
              rule: "ios.accessibility_notes",
              severity: "warn",
              waivable: true,
              message: "iOS spec must reference Dynamic Type and VoiceOver in UX flows, screen states, or product description. " + (mentionsDynamicType ? "" : "Missing: Dynamic Type. ") + (mentionsVoiceOver ? "" : "Missing: VoiceOver."),
              refs: []
            }));
          }
        }
      },
      macos: {
        testFrameworkPattern: /xctest|swift\s*testing/i,
        expectedFrameworks: "XCTest or Swift Testing",
        extras: (spec, push) => {
          const haystack = [
            spec.productDescription,
            ...spec.screens.flatMap((s) => [s.purpose, ...s.states]),
            ...spec.uxFlows.flatMap((f) => f.steps)
          ].join(" \n ").toLowerCase();
          const mentionsMenuBar = /menu\s*bar|menubar|nsstatusitem|status\s*item/.test(haystack);
          const mentionsWindowMgmt = /window|toolbar|sidebar|nswindow|popover/.test(haystack);
          if (!mentionsMenuBar && !mentionsWindowMgmt) {
            push(makeIssue({
              rule: "macos.window_management_notes",
              severity: "warn",
              waivable: true,
              message: "macOS spec must reference menu-bar/window/toolbar/sidebar conventions in UX flows, screens, or product description.",
              refs: []
            }));
          }
        }
      },
      "claude-plugin": {
        testFrameworkPattern: /plugin[- ]?builder|manifest[- ]?validator|skill[- ]?validator|hook[- ]?validator|command[- ]?validator/i,
        expectedFrameworks: "plugin-builder validators (manifest/skill/hook/command)",
        extras: (spec, push) => {
          const haystack = [
            spec.productDescription,
            ...spec.integrations.map((i) => `${i.name} ${i.purpose}`),
            ...spec.nonGoals.map((g) => `${g.text} ${g.because}`),
            ...spec.adrs.map((a) => `${a.title} ${a.context} ${a.decision}`)
          ].join(" \n ").toLowerCase();
          const declaresManifest = /plugin\.json|claude\.json|\.claude-plugin|plugin manifest/.test(haystack);
          if (!declaresManifest) {
            push(makeIssue({
              rule: "claude_plugin.manifest_required",
              severity: "warn",
              waivable: true,
              message: "claude-plugin spec must declare a plugin manifest (e.g. 'plugin.json') in description, integrations, or an ADR.",
              refs: []
            }));
          }
          for (const test of spec.tests) {
            if (test.validatorRefs.length === 0) {
              push(makeIssue({
                rule: "claude_plugin.validator_ref_missing",
                severity: "warn",
                waivable: true,
                message: `Test ${test.id} ('${truncate2(test.description, 60)}') has no validatorRefs[] entry \u2014 claude-plugin tests should cite at least one validator.`,
                refs: [{ kind: "test", id: test.id }]
              }));
            }
          }
        }
      },
      "agent-system": {
        testFrameworkPattern: /eval|golden\s*task|fixture|vitest|pytest|playwright/i,
        expectedFrameworks: "golden-task/eval fixtures, Vitest, Pytest, or Playwright",
        extras: (spec, push) => {
          const agent = spec.agentSystem;
          const agentRef = [{ kind: "agent", id: "agent-system" }];
          if (!agent) {
            push(makeIssue({
              rule: "agent_system.contract_missing",
              severity: "warn",
              waivable: true,
              message: "agent-system platformTarget requires spec.agentSystem with mission, autonomy, tool contracts, guardrails, and evals.",
              refs: agentRef
            }));
            return;
          }
          if (!agent.builderScale) {
            push(makeIssue({
              rule: "agent_system.builder_scale_missing",
              severity: "warn",
              waivable: true,
              message: "Agent system should classify build scale as skill, plugin, agent, or human workflow before adding runtime complexity.",
              refs: agentRef
            }));
          }
          if (!agent.architecturePattern || !agent.autonomyLevel || !agent.stopCondition) {
            push(makeIssue({
              rule: "agent_system.topology_incomplete",
              severity: "warn",
              waivable: true,
              message: "Agent system should declare architecturePattern, autonomyLevel, and stopCondition before handoff.",
              refs: agentRef
            }));
          }
          if (agent.toolContracts.length === 0) {
            push(makeIssue({
              rule: "agent_system.tool_contracts_missing",
              severity: "warn",
              waivable: true,
              message: "Agent system has no toolContracts[]. Each tool needs purpose, permission tier, side effects, approval, audit, and failure behavior.",
              refs: agentRef
            }));
          }
          for (const tool of agent.toolContracts) {
            if ((tool.permissionTier === "T4" || tool.permissionTier === "T5") && !tool.requiresHumanApproval) {
              push(makeIssue({
                rule: "agent_system.high_impact_tool_requires_approval",
                severity: "warn",
                waivable: true,
                message: `Tool ${tool.id} (${tool.name}) is ${tool.permissionTier} but requiresHumanApproval=false. External communication, production, destructive, or spending actions need approval.`,
                refs: agentRef
              }));
            }
          }
          if (!agent.memoryPolicy && !agent.researchProtocol?.sourcePolicy) {
            push(makeIssue({
              rule: "agent_system.memory_source_policy_missing",
              severity: "warn",
              waivable: true,
              message: "Agent system should declare memoryPolicy or researchProtocol.sourcePolicy so retention, provenance, and uncertainty are explicit.",
              refs: agentRef
            }));
          }
          if (agent.guardrails.length === 0) {
            push(makeIssue({
              rule: "agent_system.guardrails_missing",
              severity: "warn",
              waivable: true,
              message: "Agent system has no guardrails[]. Add prompt-injection, sensitive-data, excessive-agency, and tool-side-effect controls.",
              refs: agentRef
            }));
          }
          if (agent.evaluations.length === 0) {
            push(makeIssue({
              rule: "agent_system.evals_missing",
              severity: "warn",
              waivable: true,
              message: "Agent system has no evaluations[]. Add golden tasks or safety scorecards before coding handoff.",
              refs: agentRef
            }));
          }
        }
      }
    };
    FIDELITY_QUESTIONS = [
      {
        id: "speed_vs_accuracy",
        question: "Speed vs accuracy?",
        predictor: (_, s) => hasBecauseClause(s, /speed|fast|latency|throughput|accuracy|correct|precise/i)
      },
      {
        id: "complexity_vs_simplify",
        question: "Add complexity vs simplify?",
        predictor: (_, s) => hasBecauseClause(s, /complex|simplif|minimal|opinionat|configurab/i) || hasNonGoalBecause(_, /complex|configurab|customiz/i)
      },
      {
        id: "single_metric_vs_many",
        question: "Single primary metric vs many?",
        predictor: (spec) => (
          // A persona with at least one explicit job + a P0 need with a Test
          spec.personas.some((p) => p.jobs.length > 0) && spec.needs.some((n) => n.priority === "P0" && spec.tests.some((t) => t.needIds.includes(n.id)))
        )
      },
      {
        id: "off_persona_request_policy",
        question: "Accept off-persona feature request?",
        predictor: (spec) => (
          // At least one nonGoal with a non-empty because clause
          spec.nonGoals.some((g) => (g.because ?? "").trim().length > 0)
        )
      },
      {
        id: "fail_loudly_vs_degrade",
        question: "Fail loudly vs degrade silently?",
        predictor: (_, s) => hasBecauseClause(s, /fail|degrad|graceful|error|fallback|crash/i) || hasRiskMitigation(_, /fallback|graceful|degrade|fail/i)
      },
      {
        id: "on_device_vs_cloud",
        question: "On-device vs cloud?",
        predictor: (spec, s) => {
          const haystack = [
            spec.productDescription,
            ...spec.adrs.map((a) => `${a.context} ${a.decision} ${a.consequences ?? ""}`),
            ...spec.dataPoints.map((d) => `${d.handlingNote ?? ""}`)
          ].join(" \n ").toLowerCase();
          return /on-device|local-first|on device|cloud|server|api|saas|self-host/.test(haystack) || hasBecauseClause(s, /privacy|data|cloud|local|on-device/i);
        }
      },
      {
        id: "opinionated_vs_open_onboarding",
        question: "Opinionated vs open onboarding?",
        predictor: (spec) => spec.uxFlows.length > 0 && spec.uxFlows[0].steps.length > 0
      },
      {
        id: "copy_competitor_feature",
        question: "Copy competitor feature on demand?",
        predictor: (_, s) => hasBecauseClause(s, /competitor|differentiat|copy|parity|compete/i) || hasNonGoalBecause(_, /competitor|differentiat|parity/i)
      }
    ];
    FIDELITY_THRESHOLD = 6;
    issueIdCounter = 0;
    ALLOWED_LLM_KINDS = /* @__PURE__ */ new Set([
      "need",
      "feature",
      "persona",
      "scenario",
      "uxflow",
      "screen",
      "datapoint",
      "integration",
      "api",
      "test",
      "adr",
      "assumption",
      "risk",
      "non_goal",
      "stance",
      "agent"
    ]);
    ALLOWED_LLM_CATEGORIES = /* @__PURE__ */ new Set(["ambiguous_language", "unresolved_contradiction"]);
    spec_ = {
      needs: (s) => s.needs ?? [],
      features: (s) => s.features ?? [],
      personas: (s) => s.personas ?? [],
      scenarios: (s) => s.scenarios ?? [],
      uxFlows: (s) => s.uxFlows ?? [],
      screens: (s) => s.screens ?? [],
      dataPoints: (s) => s.dataPoints ?? [],
      integrations: (s) => s.integrations ?? [],
      apiContracts: (s) => s.apiContracts ?? [],
      tests: (s) => s.tests ?? [],
      adrs: (s) => s.adrs ?? [],
      assumptions: (s) => s.assumptions ?? [],
      risks: (s) => s.risks ?? [],
      nonGoals: (s) => s.nonGoals ?? []
    };
  }
});

// server/services/agent-handoff.ts
var agent_handoff_exports = {};
__export(agent_handoff_exports, {
  ASK_BEFORE_POLICY_LINES: () => ASK_BEFORE_POLICY_LINES,
  __platformScaffolds: () => __platformScaffolds,
  generateHandoff: () => generateHandoff
});
function generateHandoff(spec, productState) {
  const sections = [];
  sections.push(renderHeader(spec));
  sections.push(renderBuildObjective(spec));
  sections.push(renderPersona(spec));
  sections.push(renderNonGoals2(spec.nonGoals));
  sections.push(renderStanceAndWeights(productState ?? null));
  sections.push(renderADRs(spec.adrs));
  sections.push(renderDataModel(spec.dataPoints));
  sections.push(renderAPIContracts(spec.apiContracts));
  sections.push(renderIntegrations(spec.integrations));
  sections.push(renderAgentSystem(spec.agentSystem));
  sections.push(renderTestScaffolding(spec));
  sections.push(renderAskBeforePolicy());
  sections.push(renderNeedsAndFeatures(spec));
  sections.push(renderUXFlowsAndScreens(spec));
  sections.push(renderAssumptions2(spec.assumptions));
  sections.push(renderRisks2(spec.risks));
  const joined = sections.filter((s) => s && s.trim().length > 0).join("\n\n");
  return scrubSecretShapedStrings(joined) + "\n";
}
function renderHeader(spec) {
  return `# Coding Agent Handoff \u2014 ${spec.productName}

> Generated by ProductPilot. Paste into Claude Code, Cursor, or Codex.
> Section order is prompt-cache-friendly: stable identity content first,
> dynamic specifics last. Edit the bottom freely without invalidating the
> cache for the upper sections.

**Platform target:** \`${spec.platformTarget}\``;
}
function renderBuildObjective(spec) {
  const desc2 = spec.productDescription?.trim() || "_No product description captured._";
  return `## Build objective

${desc2}`;
}
function renderPersona(spec) {
  const lines = ["## Who this is for"];
  if (!spec.personas.length && !spec.scenarios.length) {
    lines.push("_No personas or scenarios captured yet._");
    return lines.join("\n");
  }
  for (const p of spec.personas) {
    lines.push("", `### ${p.name}`);
    if (p.trigger) lines.push(`**Trigger:** ${p.trigger}`);
    if (p.exclusions.length) {
      lines.push("", "**Who they are NOT:**");
      for (const e of p.exclusions) lines.push(`- ${e}`);
    }
    if (p.jobs.length) {
      lines.push("", "**Jobs to be done:**");
      for (const j of p.jobs) lines.push(`- ${j}`);
    }
  }
  if (spec.scenarios.length) {
    lines.push("", "### Outcome scenarios");
    for (const s of spec.scenarios) {
      const ctx = s.context ? `**Context:** ${s.context}
` : "";
      const sig = s.successSignal ? `
**Success signal:** ${s.successSignal}` : "";
      lines.push(`${ctx}**Goal:** ${s.goal}${sig}`);
    }
  }
  return lines.join("\n");
}
function renderNonGoals2(nonGoals) {
  if (!nonGoals.length) {
    return "## Non-goals\n\n_None declared._";
  }
  const items = nonGoals.map((n) => {
    const because = n.because?.trim() ? ` _Because: ${n.because}_` : "";
    return `- ${n.text}${because}`;
  }).join("\n");
  return `## Non-goals

${items}`;
}
function renderStanceAndWeights(productState) {
  const lines = ["## Strategic frame"];
  const stance = productState?.stanceBecauseClauses ?? [];
  const weights = productState?.tradeoffWeights;
  lines.push("", "### Stance \u2014 because clauses");
  if (!stance.length) {
    lines.push("_No stance captured._");
  } else {
    for (const c of stance) {
      const label = c.category.replace(/_/g, " ");
      lines.push(`- **${label}** _(id: \`${c.id}\`)_: ${c.stance}`);
      if (c.because?.trim()) lines.push(`  _Because:_ ${c.because}`);
    }
  }
  lines.push("", "### Tradeoff weights (100-point allocation)");
  if (!weights) {
    lines.push("_No tradeoff weights allocated._");
  } else {
    for (const axis of TRADEOFF_AXES) {
      const v = weights[axis];
      lines.push(`- \`${axis}\`: ${v}`);
    }
    lines.push(
      "",
      `**Unacceptable tradeoff:** \`${weights.unacceptable_tradeoff}\` \u2014 the user refuses to compromise this axis.`
    );
  }
  return lines.join("\n");
}
function renderADRs(adrs) {
  if (!adrs.length) {
    return "## Architecture decisions (ADRs)\n\n_None recorded._";
  }
  const lines = ["## Architecture decisions (ADRs)"];
  for (const a of adrs) {
    lines.push(
      "",
      `### ${a.id} \u2014 ${a.title}`,
      `**Reversibility:** ${a.reversibility}`,
      `**Context:** ${a.context}`,
      `**Decision:** ${a.decision}`
    );
    if (a.consequences) lines.push(`**Consequences:** ${a.consequences}`);
    if (a.cites.length) lines.push(`**Cites:** ${a.cites.join(", ")}`);
  }
  return lines.join("\n");
}
function renderDataModel(dataPoints) {
  if (!dataPoints.length) {
    return "## Data model\n\n_No data points captured._";
  }
  const lines = ["## Data model"];
  for (const d of dataPoints) {
    if (d.pii === true) {
      const note = d.handlingNote?.trim() ? d.handlingNote : "TAG:UNRESOLVED \u2014 handlingNote required (linter blocks export).";
      lines.push(
        `- **${d.id}** ${d.name} \`${d.type}\` **(PII \u2014 handling note only)** \u2014 ${note}`
      );
    } else {
      const desc2 = d.description ? ` \u2014 ${d.description}` : "";
      lines.push(`- **${d.id}** ${d.name} \`${d.type}\`${desc2}`);
    }
  }
  return lines.join("\n");
}
function renderAPIContracts(apis) {
  if (!apis.length) {
    return "## API contracts\n\n_No APIs captured._";
  }
  const lines = ["## API contracts"];
  for (const a of apis) {
    lines.push("", `### \`${a.method} ${a.path}\` _(id: ${a.id})_`);
    if (a.description) lines.push(a.description);
    if (a.requestSchema) lines.push("**Request schema:**", "```", a.requestSchema, "```");
    if (a.responseSchema) lines.push("**Response schema:**", "```", a.responseSchema, "```");
    if (a.featureIds.length) lines.push(`_Serves features: ${a.featureIds.join(", ")}_`);
  }
  return lines.join("\n");
}
function renderIntegrations(items) {
  if (!items.length) return "";
  const lines = ["## Integrations"];
  for (const i of items) {
    const auth2 = i.authMode ? ` (auth: ${i.authMode})` : "";
    lines.push(`- **${i.id}** ${i.name} \u2014 ${i.purpose}${auth2}`);
  }
  return lines.join("\n");
}
function renderAgentSystem(agent) {
  if (!agent) return "";
  const lines = ["## Agent system contract"];
  if (agent.mission) lines.push("", `**Mission:** ${agent.mission}`);
  if (agent.builderScale) lines.push(`**Build scale:** \`${agent.builderScale}\``);
  lines.push(
    "",
    `**Topology:** \`${agent.architecturePattern ?? "TBD"}\``,
    `**Autonomy:** \`${agent.autonomyLevel ?? "TBD"}\``
  );
  if (agent.stateOwner) lines.push(`**State owner:** ${agent.stateOwner}`);
  if (agent.stopCondition) lines.push(`**Stop condition:** ${agent.stopCondition}`);
  if (agent.systemBoundary.inScope.length || agent.systemBoundary.outOfScope.length) {
    lines.push("", "### Boundary");
    if (agent.systemBoundary.inScope.length) {
      lines.push("**In scope:**");
      for (const item of agent.systemBoundary.inScope) lines.push(`- ${item}`);
    }
    if (agent.systemBoundary.outOfScope.length) {
      lines.push("**Out of scope:**");
      for (const item of agent.systemBoundary.outOfScope) lines.push(`- ${item}`);
    }
  }
  if (agent.toolContracts.length) {
    lines.push("", "### Tool contracts");
    for (const tool of agent.toolContracts) {
      lines.push(`#### ${tool.id} \u2014 ${tool.name}`);
      lines.push(`- Purpose: ${tool.purpose}`);
      lines.push(`- Permission tier: \`${tool.permissionTier}\`${tool.requiresHumanApproval ? " (human approval required)" : ""}`);
      if (tool.allowedActions.length) lines.push(`- Allowed: ${tool.allowedActions.join("; ")}`);
      if (tool.forbiddenActions.length) lines.push(`- Forbidden: ${tool.forbiddenActions.join("; ")}`);
      if (tool.dataAccess) lines.push(`- Data access: ${tool.dataAccess}`);
      if (tool.sideEffects.length) lines.push(`- Side effects: ${tool.sideEffects.join("; ")}`);
      if (tool.auditLog) lines.push(`- Audit log: ${tool.auditLog}`);
      if (tool.rollbackPlan) lines.push(`- Rollback: ${tool.rollbackPlan}`);
      if (tool.failureMode) lines.push(`- Failure mode: ${tool.failureMode}`);
    }
  }
  if (agent.memoryPolicy || agent.researchProtocol) {
    lines.push("", "### Memory, sources, and evidence");
    if (agent.memoryPolicy) lines.push(`- Memory policy: ${agent.memoryPolicy}`);
    if (agent.researchProtocol?.sourcePolicy) lines.push(`- Source policy: ${agent.researchProtocol.sourcePolicy}`);
    if (agent.researchProtocol?.evidenceStandard) lines.push(`- Evidence standard: ${agent.researchProtocol.evidenceStandard}`);
    if (agent.researchProtocol?.confidencePolicy) lines.push(`- Confidence policy: ${agent.researchProtocol.confidencePolicy}`);
    if (agent.researchProtocol?.citationRequired) lines.push("- Citations required for factual claims.");
  }
  if (agent.uiProtocol) {
    lines.push("", "### UI and control surface");
    if (agent.uiProtocol.archetype) lines.push(`- UI archetype: \`${agent.uiProtocol.archetype}\``);
    if (agent.uiProtocol.designMode) lines.push(`- Design mode: ${agent.uiProtocol.designMode}`);
    for (const question of agent.uiProtocol.userResearchQuestions) {
      lines.push(`- User research question: ${question}`);
    }
  }
  if (agent.guardrails.length) {
    lines.push("", "### Guardrails");
    for (const guardrail of agent.guardrails) {
      lines.push(`- **${guardrail.id}** [${guardrail.severity}] Trigger: ${guardrail.trigger}; check: ${guardrail.check}; action: ${guardrail.action}`);
    }
  }
  if (agent.humanCheckpoints.length) {
    lines.push("", "### Human checkpoints");
    for (const checkpoint of agent.humanCheckpoints) lines.push(`- ${checkpoint}`);
  }
  if (agent.evaluations.length) {
    lines.push("", "### Evaluation scorecard");
    for (const evaluation of agent.evaluations) {
      lines.push(`- **${evaluation.id}** ${evaluation.name}: ${evaluation.metric}${evaluation.blocking ? " (blocking)" : ""}`);
    }
  }
  return lines.join("\n");
}
function renderTestScaffolding(spec) {
  const scaffold = PLATFORM_SCAFFOLDS[spec.platformTarget];
  if (!scaffold) {
    return `## Test scaffolding

_Unknown platform target \`${spec.platformTarget}\`._`;
  }
  const lines = [
    `## Test scaffolding \u2014 ${scaffold.heading}`,
    "",
    scaffold.runInstruction,
    "",
    scaffold.fileLocation,
    "",
    scaffold.extraNotes
  ];
  const p0Needs = spec.needs.filter((n) => n.priority === "P0");
  if (p0Needs.length) {
    lines.push("", "### P0 Need \u2192 Test mapping");
    for (const n of p0Needs) {
      const tests = spec.tests.filter((t) => t.needIds.includes(n.id));
      if (tests.length === 0) {
        lines.push(
          `- Need \`${n.id}\` (${truncate3(n.title, 50)}) \u2192 **TAG:UNRESOLVED** \u2014 no Test references this Need (linter blocks export).`
        );
      } else {
        for (const t of tests) {
          lines.push(`- ${scaffold.needToTest(n, t)}`);
        }
      }
    }
  } else {
    lines.push("", "_No P0 Needs declared. The coding agent should ask the user before scaffolding tests._");
  }
  return lines.join("\n");
}
function renderAskBeforePolicy() {
  const items = ASK_BEFORE_POLICY_LINES.map((line) => `- ${line}`).join("\n");
  return `## Ask before acting

The coding agent MUST escalate to the user before doing any of the following.
Do not infer, do not "use best judgment" \u2014 pause and ask.

${items}

If a low-confidence assumption is the only way to proceed, name the
assumption explicitly and confirm before writing code.`;
}
function renderNeedsAndFeatures(spec) {
  const lines = ["## Needs and features"];
  if (spec.needs.length === 0 && spec.features.length === 0) {
    lines.push("", "_No Needs or Features captured yet._");
    return lines.join("\n");
  }
  lines.push("", "### Needs");
  if (!spec.needs.length) {
    lines.push("_None._");
  } else {
    for (const n of spec.needs) {
      lines.push(formatNeed(n));
    }
  }
  lines.push("", "### Features");
  if (!spec.features.length) {
    lines.push("_None._");
  } else {
    for (const f of spec.features) {
      lines.push(formatFeature(f));
    }
  }
  return lines.join("\n");
}
function formatNeed(n) {
  const pri = n.priority ? `[${n.priority}] ` : "";
  const desc2 = n.description ? ` \u2014 ${n.description}` : "";
  return `- **${n.id}** ${pri}${n.title}${desc2}`;
}
function formatFeature(f) {
  const pri = f.priority ? `[${f.priority}] ` : "";
  const refs = f.needIds.length ? ` (serves ${f.needIds.join(", ")})` : "";
  const ac = f.acceptanceCriteria.length ? `
  - Acceptance:
${f.acceptanceCriteria.map((c) => `    - ${c}`).join("\n")}` : "";
  return `- **${f.id}** ${pri}${f.title}${refs}${ac}`;
}
function renderUXFlowsAndScreens(spec) {
  if (!spec.uxFlows.length && !spec.screens.length) return "";
  const lines = ["## UX flows and screens"];
  if (spec.uxFlows.length) {
    lines.push("", "### Flows");
    for (const f of spec.uxFlows) {
      const steps = f.steps.length ? f.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n") : "  _No steps._";
      const screens = f.screenIds.length ? `  - Screens: ${f.screenIds.join(", ")}` : "";
      lines.push(`#### ${f.name} _(${f.id})_`);
      lines.push(steps);
      if (screens) lines.push(screens);
    }
  }
  if (spec.screens.length) {
    lines.push("", "### Screens");
    for (const s of spec.screens) {
      const states = s.states.length ? `  - States: ${s.states.join(", ")}` : "";
      const primary = s.primaryAction ? `  - Primary action: ${s.primaryAction}` : "";
      lines.push(`- **${s.id}** ${s.name} \u2014 ${s.purpose}`);
      if (primary) lines.push(primary);
      if (states) lines.push(states);
    }
  }
  return lines.join("\n");
}
function renderAssumptions2(items) {
  if (!items.length) return "";
  const list = items.map((a) => `- _(${a.confidence})_ ${a.text}`).join("\n");
  return `## Assumptions

${list}`;
}
function renderRisks2(items) {
  if (!items.length) return "";
  const list = items.map((r) => {
    const mit = r.mitigation ? ` Mitigation: ${r.mitigation}` : "";
    return `- _(L:${r.likelihood} I:${r.impact})_ ${r.text}.${mit}`;
  }).join("\n");
  return `## Risks

${list}`;
}
function truncate3(s, n) {
  if (typeof s !== "string") return "";
  return s.length <= n ? s : `${s.slice(0, n - 1)}\u2026`;
}
function scrubSecretShapedStrings(s) {
  let out = s;
  for (const re of SECRET_PATTERNS2) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}
var ASK_BEFORE_POLICY_LINES, PLATFORM_SCAFFOLDS, SECRET_PATTERNS2, __platformScaffolds;
var init_agent_handoff = __esm({
  "server/services/agent-handoff.ts"() {
    "use strict";
    init_schema();
    ASK_BEFORE_POLICY_LINES = [
      "Storing PII or regulated data not declared in the spec.",
      "Choosing a paid external service.",
      "Introducing distributed services that aren't in the ADRs.",
      "Removing a P0 Need.",
      "Making any irreversible architecture decision with low confidence.",
      "Modifying the database schema in a non-additive way.",
      "Letting an agent use T4/T5 tools, external communication, production deploys, or destructive actions without explicit approval."
    ];
    PLATFORM_SCAFFOLDS = {
      web: {
        heading: "web (Vitest)",
        runInstruction: "Run `npm run test` (Vitest).",
        fileLocation: "Place tests under `<repo>/test/`. Each P0 Need maps to \u22651 test file.",
        extraNotes: "Use jsdom for component tests. Mock fetch via `vi.fn()`. For E2E flows, Playwright is allowed \u2014 declare it in the test's `testFramework` field.",
        needToTest: (need, test) => `Need \`${need.id}\` (${truncate3(need.title, 50)}) \u2192 Test \`${test.id}\` \u2192 run \`npm run test -- ${test.id}\` or filter by description.`
      },
      "vite-spa": {
        heading: "vite-spa (Vitest, optional Playwright)",
        runInstruction: "Run `npm run test` (Vitest preferred). Use Playwright only when an E2E browser is unavoidable.",
        fileLocation: "Place tests under `src/` colocated with the unit-under-test, suffix `.test.ts(x)`.",
        extraNotes: "Bundle-size budgets are first-class \u2014 every P0 feature should have a test that asserts no new top-level dep crosses the budget. No SSR; assume a single static entry.",
        needToTest: (need, test) => `Need \`${need.id}\` (${truncate3(need.title, 50)}) \u2192 Test \`${test.id}\` \u2192 run \`npm run test -- ${test.id}\`.`
      },
      ios: {
        heading: "ios (Swift Testing + XCTest)",
        runInstruction: "Run `xcodebuild test -scheme <Scheme>` or `swift test` (Swift Testing).",
        fileLocation: "Place tests in the `<Project>Tests/` group within the Xcode project. New files require `xcodegen generate` after adding (SourceKit ghosts otherwise).",
        extraNotes: "Use Swift Testing's `@Test` macro for new tests; XCTest stays for legacy compatibility. Verify Dynamic Type (XS through XXXL) and full VoiceOver navigation per Need \u2014 accessibility is a build-time requirement, not a polish step.",
        needToTest: (need, test) => `Need \`${need.id}\` (${truncate3(need.title, 50)}) \u2192 Test \`${test.id}\` \u2192 run \`xcodebuild test -only-testing:<Scheme>Tests/${test.id}\`.`
      },
      macos: {
        heading: "macos (Swift Testing + XCTest)",
        runInstruction: "Run `xcodebuild test -scheme <Scheme>` or `swift test` (Swift Testing).",
        fileLocation: "Place tests in the `<Project>Tests/` group. New files require `xcodegen generate` after adding.",
        extraNotes: "Use Swift Testing's `@Test` macro for new tests; XCTest stays for legacy compatibility. Validate menu-bar, toolbar, and window-management conventions per HIG. Keyboard-first apps must include a test for full menu-bar keyboard navigation.",
        needToTest: (need, test) => `Need \`${need.id}\` (${truncate3(need.title, 50)}) \u2192 Test \`${test.id}\` \u2192 run \`xcodebuild test -only-testing:<Scheme>Tests/${test.id}\`.`
      },
      "claude-plugin": {
        heading: "claude-plugin (plugin-builder validators)",
        runInstruction: "Validate `plugin.json` via the manifest-validator. Test commands/skills/hooks via the matching plugin-builder validators (skill-validator, hook-validator, command-validator).",
        fileLocation: "Reference the plugin-builder skill at `~/dev/git-folder/RossLabs-AI-Toolkit/plugins/plugin-builder/`. Each artifact (command, skill, hook) declares the validator that gates it.",
        extraNotes: "Every Test must declare \u22651 entry in `validatorRefs[]` \u2014 the linter warns when a claude-plugin test has none. Run validators locally before committing \u2014 `claude plugins lint` against the package root.",
        needToTest: (need, test) => {
          const refs = test.validatorRefs.length ? test.validatorRefs.join(", ") : "no validatorRefs declared (linter warning)";
          return `Need \`${need.id}\` (${truncate3(need.title, 50)}) \u2192 Test \`${test.id}\` \u2192 validators: ${refs}.`;
        }
      },
      "agent-system": {
        heading: "agent-system (golden tasks + safety evals)",
        runInstruction: "Run the agent's golden-task suite and safety/permission evals before marking the handoff ready.",
        fileLocation: "Place eval fixtures under `evals/` or the repo's existing test directory. Include tool-permission fixtures for every T3+ tool.",
        extraNotes: "Each P0 Need should map to a golden task. Every T4/T5 tool needs an approval-path test, audit-log check, and refusal test for missing permission or source evidence.",
        needToTest: (need, test) => `Need \`${need.id}\` (${truncate3(need.title, 50)}) \u2192 Test \`${test.id}\` \u2192 run golden task / safety eval \`${test.description}\`.`
      }
    };
    SECRET_PATTERNS2 = [
      /\bsk-[A-Za-z0-9_-]{16,}\b/g,
      /\bghp_[A-Za-z0-9]{24,}\b/g,
      /\bgho_[A-Za-z0-9]{24,}\b/g,
      /\bAKIA[0-9A-Z]{12,20}\b/g,
      /\baws_secret_access_key\s*[=:]\s*[A-Za-z0-9/+]{30,}\b/gi,
      /\b[A-Za-z0-9_-]{40,}\b\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
      // jwt-shaped
    ];
    __platformScaffolds = PLATFORM_SCAFFOLDS;
  }
});

// server/api-entry/index.ts
import express from "express";
import { toNodeHandler } from "better-auth/node";

// server/auth/index.ts
init_db();
import fs from "fs";
import path from "path";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";

// server/auth/email.ts
init_logger();
var RESEND_API_URL = "https://api.resend.com/emails";
function canSendAuthEmail() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_FROM_EMAIL);
}
function shouldLogAuthEmailBody() {
  return process.env.NODE_ENV !== "production";
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
async function sendAuthEmail(payload) {
  if (!canSendAuthEmail()) {
    if (shouldLogAuthEmailBody()) {
      logger.info({ to: payload.to, subject: payload.subject, text: payload.text }, "[auth] Email provider not configured. Logging email instead.");
      return;
    }
    logger.error({ to: payload.to, subject: payload.subject }, "[auth] Email provider not configured. Refusing to log auth email body in production.");
    throw new Error("Auth email provider is not configured.");
  }
  if (!process.env.RESEND_API_KEY || !process.env.AUTH_FROM_EMAIL) {
    logger.error({ to: payload.to, subject: payload.subject }, "[auth] Email provider configuration is incomplete.");
    throw new Error("Auth email provider configuration is incomplete.");
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
function escapeAuthUrl(url2) {
  return escapeHtml(url2);
}
async function sendPasswordResetEmail(input) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeAuthUrl(input.url);
  const subject = "Reset your ProductPilot password";
  const text3 = `${greeting}

You (or someone with your email) requested a password reset. Click the link below to set a new password:
${input.url}

The link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;
  const html = `<p>${safeGreeting}</p>
<p>You (or someone with your email) requested a password reset.</p>
<p><a href="${safeUrl}">Reset your password</a></p>
<p>If the button does not work, open this link:</p>
<p>${safeUrl}</p>
<p>The link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`;
  await sendAuthEmail({
    to: input.email,
    subject,
    html,
    text: text3
  });
}
async function sendMagicLinkEmail(input) {
  const subject = "Sign in to ProductPilot";
  const safeUrl = escapeAuthUrl(input.url);
  const text3 = `Click this link to sign in to ProductPilot:

${input.url}

The link expires in 15 minutes. If you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#1a1714">
      <h2 style="margin:0 0 16px;color:#110f0d">Sign in to ProductPilot</h2>
      <p style="margin:0 0 24px;color:#4a3f38;line-height:1.5">Click the button below to sign in. The link expires in 15 minutes.</p>
      <a href="${safeUrl}" style="display:inline-block;background:#f0b65e;color:#110f0d;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to ProductPilot</a>
      <p style="margin:24px 0 0;color:#6b5d52;font-size:13px">If you didn't request this, you can ignore this email.</p>
    </div>
  `;
  await sendAuthEmail({ to: input.email, subject, html, text: text3 });
}
async function sendVerificationEmail(input) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeAuthUrl(input.url);
  const subject = "Verify your ProductPilot email";
  const text3 = `${greeting}

Verify your email to finish setting up ProductPilot:
${input.url}

If you did not request this, you can ignore this email.`;
  const html = `<p>${safeGreeting}</p>
<p>Verify your email to finish setting up ProductPilot.</p>
<p><a href="${safeUrl}">Verify email</a></p>
<p>If the button does not work, open this link:</p>
<p>${safeUrl}</p>
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
  rateLimit: () => rateLimit,
  session: () => session,
  user: () => user,
  verification: () => verification
});
import { bigint, index as index2, integer as integer2, pgTable as pgTable2, text as text2, timestamp as timestamp2, boolean as boolean2, uniqueIndex as uniqueIndex2 } from "drizzle-orm/pg-core";
var user = pgTable2("user", {
  id: text2("id").primaryKey(),
  name: text2("name").notNull(),
  email: text2("email").notNull(),
  emailVerified: boolean2("email_verified").notNull().default(false),
  image: text2("image"),
  createdAt: timestamp2("created_at").notNull().defaultNow(),
  updatedAt: timestamp2("updated_at").notNull().defaultNow()
}, (table) => [
  uniqueIndex2("user_email_unique").on(table.email)
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
  uniqueIndex2("session_token_unique").on(table.token),
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
  uniqueIndex2("account_provider_account_unique").on(table.providerId, table.accountId)
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
var rateLimit = pgTable2("rateLimit", {
  key: text2("key").primaryKey(),
  count: integer2("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull()
});

// server/auth/index.ts
init_logger();
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
var extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
var listenOrigin = `${defaultProtocol}://${defaultHost}:${defaultPort}`;
var trustedOrigins = Array.from(
  /* @__PURE__ */ new Set([baseURL, listenOrigin, ...extraTrustedOrigins])
);
var googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
var auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: authSecret,
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: schema_exports2
  }),
  emailAndPassword: {
    enabled: true,
    // Verification email is still sent on sign-up (see emailVerification below), but not required
    // to sign in. Users who want to verify can; users who don't are not blocked.
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user: user2, url: url2 }) => {
      await sendPasswordResetEmail({
        email: user2.email,
        name: user2.name,
        url: url2
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60
    // 1 hour
  },
  emailVerification: {
    sendOnSignUp: canSendAuthEmail() || process.env.NODE_ENV !== "production",
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user: user2, url: url2 }) => {
      await sendVerificationEmail({
        email: user2.email,
        name: user2.name,
        url: url2
      });
    }
  },
  account: {
    encryptOAuthTokens: true,
    // Account linking: if a user signs up with email/password and later uses Google OAuth,
    // Better Auth merges the accounts IF the emails match and Google is trusted.
    // allowDifferentEmails: false means linking is blocked when emails differ — prevents
    // accidental merging of distinct identities.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false
    }
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/magic-link/verify": { window: 60, max: 5 }
    }
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"]
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
    magicLink({
      sendMagicLink: async ({ email, url: url2 }) => {
        try {
          await sendMagicLinkEmail({ email, url: url2 });
        } catch (err) {
          logger.error(
            { err, email, urlPrefix: url2.slice(0, 80) },
            "[auth] magic-link send failed"
          );
          throw err;
        }
      },
      storeToken: "hashed",
      // Token TTL: 15 min is friendlier for mobile paste UX than the 5-min default.
      expiresIn: 60 * 15,
      rateLimit: {
        window: 60,
        max: 3
      }
    })
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
  } catch (err) {
    req.authSession = null;
    req.user = null;
    req.userId = null;
    logger.warn({ err, path: req.path }, "[auth] extractUser failed; treating as anonymous");
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
init_logger();
init_storage_hybrid();
init_ai();
init_schema();
import { randomUUID } from "crypto";
import { createServer } from "http";
import { z as z2 } from "zod";
init_prompt_builders();
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
var SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
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
function getOrigin(value) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
function validateUnsafeRequestOrigin(req, res, next) {
  if (!req.path.startsWith("/api") || req.path.startsWith("/api/auth") || SAFE_METHODS.has(req.method)) {
    return next();
  }
  const allowedOrigins = new Set(trustedOrigins.map((origin) => getOrigin(origin)).filter(Boolean));
  const originHeader = req.get("origin");
  const refererHeader = req.get("referer");
  const requestOrigin = getOrigin(originHeader) || getOrigin(refererHeader);
  if ((originHeader || refererHeader) && !requestOrigin) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  next();
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
  app2.use(validateUnsafeRequestOrigin);
  app2.use((req, _res, next) => {
    const actor = getActorContext(req);
    const guestOwnerId = getGuestOwnerId(req);
    runWithDbActorContext(
      {
        userId: actor.kind === "user" ? actor.id : null,
        guestOwnerId
      },
      next
    );
  });
  app2.get("/api/auth-capabilities", (_req, res) => {
    res.json({
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      magicLink: Boolean(process.env.RESEND_API_KEY && process.env.AUTH_FROM_EMAIL),
      password: true
    });
  });
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
      logger.error({ err: error }, "Error fetching user draft");
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
      logger.error({ err: error }, "Error claiming project");
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
        updateDbActorContext({ guestOwnerId });
      }
      const project = await storage.createProject({
        ...projectData,
        userId: actor.kind === "user" ? actor.id : null,
        guestOwnerId
      });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.kind === "user" ? actor.id : guestOwnerId,
        action: "project.create",
        resourceType: "project",
        resourceId: project.id,
        metadata: { name: project.name, mode: project.mode }
      }).catch((e) => logger.error({ err: e }, "[audit] project.create failed"));
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
      void storage.createAuditEvent({
        actorType: projectAccess.actor.kind,
        actorId: projectAccess.actor.id,
        action: "project.delete",
        resourceType: "project",
        resourceId: projectAccess.project.id,
        metadata: { name: projectAccess.project.name }
      }).catch((e) => logger.error({ err: e }, "[audit] project.delete failed"));
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
      logger.error({ err: error }, "Error ensuring stages");
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
          logger.debug({ chars: projectContext.length }, "AI context enriched with project data");
        } else if (project.intakeAnswers || project.minimumDetails) {
          logger.warn({ projectId: project.id }, "Project has intake/details but context extraction failed");
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
          const aiResponse = await aiService.chat(aiMessages, modelToUse, userConfig, task, {
            userId: stageAccess.actor.kind === "user" ? stageAccess.actor.id : null,
            guestOwnerId: stageAccess.actor.kind === "guest" ? stageAccess.actor.id : null,
            projectId: project.id,
            stageId: stage.id
          });
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
          logger.error({ err: aiError }, "AI service error");
          res.status(503).json({ userMessage: message, aiMessage: null, error: "AI service unavailable" });
        }
      } else {
        res.status(201).json({ userMessage: message });
      }
    } catch (error) {
      logger.error({ err: error }, "Message creation error");
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
      for await (const chunk of aiService.chatStream(aiMessages, modelToUse, userConfig, task, {
        userId: stageAccess.actor.kind === "user" ? stageAccess.actor.id : null,
        guestOwnerId: stageAccess.actor.kind === "guest" ? stageAccess.actor.id : null,
        projectId: project.id,
        stageId: stage.id
      })) {
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
      logger.error({ err }, "Stream error");
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
      logger.error({ err: error }, "Survey generation error");
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
  app2.post("/api/projects/:projectId/survey/reset", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      await storage.updateProject(project.id, {
        surveyResponses: null,
        surveyPhase: "discovery"
      });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "survey.reset",
        resourceType: "project",
        resourceId: project.id,
        metadata: { previousPhase: project.surveyPhase ?? null }
      }).catch((e) => logger.error({ err: e }, "[audit] survey.reset failed"));
      res.json({ message: "Survey reset", surveyPhase: "discovery" });
    } catch (error) {
      logger.error({ err: error }, "[survey.reset] error");
      res.status(500).json({ message: "Failed to reset survey" });
    }
  });
  app2.post("/api/projects/:projectId/generate-docs-from-survey", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) {
        return;
      }
      const { project } = projectAccess;
      let surveyDefinition = project.surveyDefinition;
      let surveyResponses = project.surveyResponses;
      if (!surveyResponses || !surveyDefinition) {
        if (project.intakeMode === "adaptive") {
          const productState = project.productState ?? {};
          const intakeAnswers = Array.isArray(productState.workingMemory?.intakeAnswers) ? productState.workingMemory.intakeAnswers : [];
          if (intakeAnswers.length === 0) {
            const stagesForDocs = await storage.getStagesByProject(project.id);
            const prdStageForDocs = stagesForDocs.find((s) => s.stageNumber === 2);
            const discoveryMsgs = prdStageForDocs ? await storage.getMessagesByStage(prdStageForDocs.id) : [];
            const qa = [];
            for (let i = 0; i < discoveryMsgs.length; i++) {
              const m = discoveryMsgs[i];
              if (m.role !== "user" || !m.content?.trim()) continue;
              const prevAssistant = [...discoveryMsgs.slice(0, i)].reverse().find((p) => p.role === "assistant");
              qa.push({
                id: `disc-q-${qa.length}`,
                question: prevAssistant?.content?.trim() || `Discovery answer ${qa.length + 1}`,
                answer: m.content.trim()
              });
            }
            if (qa.length === 0) {
              return res.status(400).json({
                message: "No intake captured yet. Add a few discovery answers before generating documents.",
                code: "adaptive_intake_incomplete"
              });
            }
            surveyDefinition = {
              source: "discovery_chat",
              description: "Synthesized from the PRD-stage discovery conversation.",
              questions: qa.map((row) => ({ id: row.id, question: row.question }))
            };
            surveyResponses = Object.fromEntries(qa.map((row) => [row.id, row.answer]));
          } else {
            surveyDefinition = {
              source: "adaptive_intake",
              description: "Synthesized from productState.workingMemory.intakeAnswers \u2014 adaptive controller-driven Q/A.",
              questions: intakeAnswers.map((row, i) => ({
                id: `adaptive-q-${i}`,
                step: row.step ?? null,
                method: row.method ?? null,
                question: row.question ?? `Adaptive question ${i + 1}`
              }))
            };
            surveyResponses = Object.fromEntries(
              intakeAnswers.map((row, i) => [`adaptive-q-${i}`, row.answer ?? null])
            );
          }
        } else if (project.minimumDetails) {
          const md = project.minimumDetails;
          const entries = Object.entries(md).filter(([, v]) => v !== null && v !== void 0 && v !== "");
          if (entries.length === 0) {
            return res.status(400).json({ message: "Minimum details are empty.", code: "minimum_details_empty" });
          }
          surveyDefinition = {
            source: "minimum_details",
            description: "Synthesized from project.minimumDetails.",
            questions: entries.map(([key], i) => ({ id: `min-${i}`, key, question: key }))
          };
          surveyResponses = Object.fromEntries(entries.map(([key, value], i) => [`min-${i}`, value]));
        } else {
          return res.status(400).json({
            message: "No intake captured for this project yet. Complete the survey or adaptive intake before regenerating documents.",
            code: "intake_incomplete"
          });
        }
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
      const stageResults = await Promise.all(stages2.map(async (stage) => {
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
          surveyDefinition,
          surveyResponses,
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
          ], "claude-sonnet", userConfig, task, {
            userId: projectAccess.actor.kind === "user" ? projectAccess.actor.id : null,
            guestOwnerId: projectAccess.actor.kind === "guest" ? projectAccess.actor.id : null,
            projectId: project.id,
            stageId: stage.id
          });
          const priorDeliverables = await storage.getDeliverablesByStage(stage.id);
          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content,
            kind: "deliverable",
            version: priorDeliverables.length + 1
          });
          await storage.updateStage(stage.id, { progress: 100 });
          void storage.createAuditEvent({
            actorType: projectAccess.actor.kind,
            actorId: projectAccess.actor.kind === "user" ? projectAccess.actor.id : projectAccess.actor.kind === "guest" ? projectAccess.actor.id : null,
            action: "stage.regenerate",
            resourceType: "stage",
            resourceId: stage.id,
            metadata: {
              projectId: project.id,
              stageNumber: stage.stageNumber,
              detailLevel
            }
          }).catch((e) => logger.error({ err: e }, "[audit] stage.regenerate failed"));
          return { ok: true, stageId: stage.id, stageTitle: stage.title };
        } catch (stageError) {
          const provider = userConfig?.provider === "anthropic" ? "anthropic" : "groq";
          const classified = classifyLlmError(stageError, provider);
          logger.error(
            { err: stageError, classification: classified.code, stageTitle: stage.title, stageNumber: stage.stageNumber },
            "Error generating docs for stage"
          );
          return {
            ok: false,
            stageId: stage.id,
            stageTitle: stage.title,
            error: classified.message,
            errorCode: classified.code,
            retryAfterSeconds: classified.retryAfterSeconds
          };
        }
      }));
      const failed = stageResults.filter((r) => !r.ok);
      const succeeded = stageResults.filter((r) => r.ok);
      for (const f of failed) {
        void storage.updateStage(f.stageId, { progress: 0 }).catch((e) => logger.warn({ err: e, stageId: f.stageId }, "[T1-4] failed to reset stage progress"));
      }
      if (succeeded.length === 0 && failed.length > 0) {
        return res.status(502).json({
          message: `Doc generation failed: ${failed[0].error}`,
          errorCode: failed[0].errorCode ?? "unknown",
          retryAfterSeconds: failed[0].retryAfterSeconds ?? null,
          failed: failed.map((f) => ({
            stageId: f.stageId,
            stageTitle: f.stageTitle,
            error: f.error,
            errorCode: f.errorCode ?? "unknown",
            retryAfterSeconds: f.retryAfterSeconds ?? null
          }))
        });
      }
      res.json({
        message: "Documentation generated successfully",
        succeeded: succeeded.length,
        failed: failed.length,
        ...failed.length > 0 ? {
          failures: failed.map((f) => ({
            stageId: f.stageId,
            stageTitle: f.stageTitle,
            error: f.error,
            errorCode: f.errorCode ?? "unknown",
            retryAfterSeconds: f.retryAfterSeconds ?? null
          }))
        } : {}
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: error }, "Doc generation error");
      res.status(500).json({ message: `Failed to generate documentation: ${message}` });
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
      const minResults = await Promise.all(coreStagesToGenerate.map(async (stage) => {
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
          ], "claude-sonnet", userConfig, task, {
            userId: projectAccess.actor.kind === "user" ? projectAccess.actor.id : null,
            guestOwnerId: projectAccess.actor.kind === "guest" ? projectAccess.actor.id : null,
            projectId: project.id,
            stageId: stage.id
          });
          await storage.createMessage({
            stageId: stage.id,
            role: "assistant",
            content: response.content,
            kind: "deliverable"
          });
          await storage.updateStage(stage.id, { progress: 100 });
          return { ok: true, stageTitle: stage.title };
        } catch (stageError) {
          const message = stageError instanceof Error ? stageError.message : String(stageError);
          logger.error({ err: stageError, stageTitle: stage.title, stageNumber: stage.stageNumber }, "Error generating docs for stage (minimum)");
          return { ok: false, stageTitle: stage.title, error: message };
        }
      }));
      const minFailed = minResults.filter((r) => !r.ok);
      const minSucceeded = minResults.filter((r) => r.ok);
      if (minSucceeded.length === 0 && minFailed.length > 0) {
        return res.status(502).json({
          message: `Doc generation failed: ${minFailed[0].error}`,
          failed: minFailed.map((f) => ({ stageTitle: f.stageTitle, error: f.error }))
        });
      }
      res.json({
        message: "Documentation generated from minimum details",
        succeeded: minSucceeded.length,
        failed: minFailed.length,
        ...minFailed.length > 0 ? { failures: minFailed.map((f) => ({ stageTitle: f.stageTitle, error: f.error })) } : {}
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: error }, "Min doc generation error");
      res.status(500).json({ message: `Failed to generate documentation: ${message}` });
    }
  });
  function requireAdaptiveMode(project, res) {
    if (project.intakeMode !== "adaptive") {
      res.status(409).json({
        message: `Adaptive intake is not enabled for this project (intake_mode='${project.intakeMode}')`,
        code: "intake_mode_not_adaptive"
      });
      return false;
    }
    return true;
  }
  app2.post("/api/projects/:projectId/intake/next", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const { hydrateProductState: hydrateProductState2, hydrateSpec: hydrateSpec2, nextStep: nextStep2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const productState = hydrateProductState2(project.productState);
      const spec = hydrateSpec2(null, `spec-${project.id}`, project.name, project.description);
      const intakeQs = await storage.getIntakeQuestionsByProject(project.id);
      const history = intakeQs.map((row) => ({
        step: row.step,
        method: row.method,
        question: row.questionText,
        answer: row.answerText,
        metadata: row.metadata
      }));
      const llmConfig = await getLLMConfig(req);
      const action = await nextStep2({
        productState,
        spec,
        history,
        llmConfig,
        context: {
          userId: actor.kind === "user" ? actor.id : null,
          guestOwnerId: actor.kind === "guest" ? actor.id : null,
          projectId: project.id
        }
      });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.next",
        resourceType: "project",
        resourceId: project.id,
        metadata: { action: action.action, historyLength: history.length }
      }).catch((e) => logger.error({ err: e }, "[audit] intake.next failed"));
      res.json(action);
    } catch (error) {
      logger.error({ err: error }, "[intake/next] error");
      res.status(500).json({ message: "Failed to compute next intake step" });
    }
  });
  app2.get("/api/projects/:projectId/intake/sufficiency", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project } = projectAccess;
      const { assessDiscoverySufficiency: assessDiscoverySufficiency2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const llmConfig = await getLLMConfig(req);
      const stages2 = await storage.getStagesByProject(project.id);
      const prdStage = stages2.find((s) => s.stageNumber === 2);
      const messages2 = prdStage ? await storage.getMessagesByStage(prdStage.id) : [];
      const convo = messages2.map((m) => ({ role: m.role, content: m.content }));
      const result = await assessDiscoverySufficiency2(convo, {
        llmConfig,
        context: { projectId: project.id }
      });
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, "[intake/sufficiency] error");
      res.status(500).json({ message: "Failed to compute intake sufficiency" });
    }
  });
  app2.post("/api/projects/:projectId/intake/answer", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const body = z2.object({
        questionText: z2.string().min(1).max(2e3),
        answer: z2.string().min(1).max(8e3),
        method: z2.enum(["jtbd", "qfd", "pugh", "agent"]).nullable().optional(),
        questionId: z2.string().nullable().optional(),
        metadata: z2.record(z2.string(), z2.any()).optional()
      }).parse(req.body);
      const existing = await storage.getIntakeQuestionsByProject(project.id);
      const step = existing.length + 1;
      const row = await storage.createIntakeQuestion({
        projectId: project.id,
        step,
        method: body.method ?? null,
        questionText: body.questionText,
        answerText: body.answer,
        metadata: body.metadata ?? null,
        answeredAt: /* @__PURE__ */ new Date()
      });
      const { hydrateProductState: hydrateProductState2, ingestAnswer: ingestAnswer2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const currentState = hydrateProductState2(project.productState);
      const { productState } = ingestAnswer2({
        state: currentState,
        answer: {
          projectId: project.id,
          step,
          questionText: body.questionText,
          answer: body.answer,
          method: body.method ?? null,
          metadata: body.metadata
        }
      });
      const updated = await storage.updateProject(project.id, { productState });
      const promotedSpecPath = body.metadata?.extracts_into?.spec_path ?? null;
      const promotedTopic = body.metadata?.topic ?? null;
      const { jtbdSlotForCandidate: jtbdSlotForCandidate2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const jtbdSlot = body.method === "jtbd" ? jtbdSlotForCandidate2({ topic: promotedTopic, specPath: promotedSpecPath }) : null;
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.answer",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          step,
          method: body.method ?? null,
          intakeQuestionId: row.id,
          promotedSpecPath,
          promotedTopic,
          jtbdSlot
        }
      }).catch((e) => logger.error({ err: e }, "[audit] intake.answer failed"));
      res.json({
        productState: updated?.productState ?? productState,
        intakeQuestion: row
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid intake answer", errors: error.issues });
      }
      logger.error({ err: error }, "[intake/answer] error");
      res.status(500).json({ message: "Failed to ingest intake answer" });
    }
  });
  app2.post("/api/projects/:projectId/finalize-with-assumptions", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const { hydrateProductState: hydrateProductState2, finalizeWithAssumptions: finalizeWithAssumptions2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const current = hydrateProductState2(project.productState);
      const { productState, intakeAnswerCount, finalizedAt } = finalizeWithAssumptions2(current);
      const updated = await storage.updateProject(project.id, { productState });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.finalize_with_assumptions",
        resourceType: "project",
        resourceId: project.id,
        metadata: { intakeAnswerCount, finalizedAt }
      }).catch((e) => logger.error({ err: e }, "[audit] finalize_with_assumptions failed"));
      res.json({
        productState: updated?.productState ?? productState,
        intakeAnswerCount,
        finalizedAt
      });
    } catch (error) {
      logger.error({ err: error }, "[finalize-with-assumptions] error");
      res.status(500).json({ message: "Failed to finalize with assumptions" });
    }
  });
  app2.get("/api/projects/:projectId/open-questions", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project } = projectAccess;
      const { extractOpenQuestions: extractOpenQuestions2, mergeOpenQuestions: mergeOpenQuestions2 } = await Promise.resolve().then(() => (init_open_questions(), open_questions_exports));
      const { hydrateProductState: hydrateProductState2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const productState = hydrateProductState2(project.productState);
      const existing = Array.isArray(productState.workingMemory?.openQuestions) ? productState.workingMemory.openQuestions : [];
      const stagesForProject = await storage.getStagesByProject(project.id);
      let incoming = [];
      for (const stage of stagesForProject) {
        const stageMessages = await storage.getMessagesByStage(stage.id);
        const latestAssistant = [...stageMessages].reverse().find((m) => m.role === "assistant");
        if (!latestAssistant) continue;
        const extracted = extractOpenQuestions2({
          stageId: stage.id,
          stageNumber: stage.stageNumber,
          content: latestAssistant.content
        });
        incoming = incoming.concat(extracted);
      }
      const merged = mergeOpenQuestions2(existing, incoming);
      productState.workingMemory = {
        ...productState.workingMemory,
        openQuestions: merged
      };
      await storage.updateProject(project.id, { productState });
      res.json({ openQuestions: merged });
    } catch (error) {
      logger.error({ err: error }, "[open-questions:get] error");
      res.status(500).json({ message: "Failed to load open questions" });
    }
  });
  app2.post("/api/projects/:projectId/open-questions/answer", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      const body = z2.object({
        topicId: z2.string().min(1).max(200),
        stageId: z2.string().optional(),
        answer: z2.string().min(1).max(500)
      }).parse(req.body);
      const { applyAnswer: applyAnswer2 } = await Promise.resolve().then(() => (init_open_questions(), open_questions_exports));
      const { hydrateProductState: hydrateProductState2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const productState = hydrateProductState2(project.productState);
      const list = Array.isArray(productState.workingMemory?.openQuestions) ? productState.workingMemory.openQuestions : [];
      const { list: updatedList, found } = applyAnswer2(list, {
        topicId: body.topicId,
        stageId: body.stageId,
        answer: body.answer
      });
      if (!found) {
        return res.status(404).json({ message: "Open question not found", code: "topic_not_found" });
      }
      productState.workingMemory = {
        ...productState.workingMemory,
        openQuestions: updatedList
      };
      const existing = await storage.getIntakeQuestionsByProject(project.id);
      const step = existing.length + 1;
      const questionText = list.find((row) => row.topicId === body.topicId)?.prompt ?? `OpenQ ${body.topicId}`;
      const intakeRow = await storage.createIntakeQuestion({
        projectId: project.id,
        step,
        method: null,
        questionText: String(questionText),
        answerText: body.answer,
        metadata: { source: "open_questions_inline", topicId: body.topicId, stageId: body.stageId ?? null },
        answeredAt: /* @__PURE__ */ new Date()
      });
      const intakeAnswers = Array.isArray(productState.workingMemory?.intakeAnswers) ? productState.workingMemory.intakeAnswers : [];
      intakeAnswers.push({
        step,
        method: null,
        question: questionText,
        answer: body.answer,
        metadata: { source: "open_questions_inline", topicId: body.topicId, stageId: body.stageId ?? null }
      });
      productState.workingMemory = {
        ...productState.workingMemory,
        intakeAnswers
      };
      const updated = await storage.updateProject(project.id, { productState });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "open_questions.answer",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          topicId: body.topicId,
          stageId: body.stageId ?? null,
          intakeQuestionId: intakeRow.id
        }
      }).catch((e) => logger.error({ err: e }, "[audit] open-questions.answer failed"));
      res.json({
        openQuestions: updated?.productState?.workingMemory?.openQuestions ?? updatedList,
        intakeQuestion: intakeRow
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid open-question answer", errors: error.issues });
      }
      logger.error({ err: error }, "[open-questions:answer] error");
      res.status(500).json({ message: "Failed to record open-question answer" });
    }
  });
  app2.post("/api/projects/:projectId/intake/finalize", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const {
        hydrateProductState: hydrateProductState2,
        finalize: finalize2,
        applyTradeoffWeights: applyTradeoffWeights2,
        ensureTradeoffWeights: ensureTradeoffWeights2
      } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      let productState = hydrateProductState2(project.productState);
      const bodyWeights = req.body?.tradeoffWeights;
      let weightsApplied = false;
      let weightsAssumed = false;
      if (bodyWeights !== void 0) {
        try {
          const result = applyTradeoffWeights2({ state: productState, weights: bodyWeights });
          productState = result.productState;
          await storage.updateProject(project.id, { productState });
          weightsApplied = true;
        } catch (err) {
          if (err instanceof z2.ZodError) {
            return res.status(400).json({ message: "Invalid tradeoff weights", errors: err.issues });
          }
          throw err;
        }
      } else {
        const ensured = ensureTradeoffWeights2(productState);
        if (ensured.assumed) {
          productState = ensured.productState;
          await storage.updateProject(project.id, { productState });
          weightsAssumed = true;
        }
      }
      const { spec, renderedMarkdown } = finalize2({
        projectId: project.id,
        productName: project.name,
        productDescription: project.description,
        productState,
        existingSpec: null
      });
      let derivedTitle = null;
      try {
        const { deriveProjectTitle: deriveProjectTitle2, hasEnoughSignalForTitle: hasEnoughSignalForTitle2 } = await Promise.resolve().then(() => (init_title_generator(), title_generator_exports));
        const userRenamed = Boolean(
          productState.workingMemory?.titleRenamedByUser
        );
        if (!userRenamed && hasEnoughSignalForTitle2({
          storedName: project.name,
          description: project.description,
          minimumDetails: project.minimumDetails,
          productState,
          spec
        })) {
          derivedTitle = deriveProjectTitle2({
            storedName: project.name,
            description: project.description,
            minimumDetails: project.minimumDetails,
            productState,
            spec
          });
          if (derivedTitle && derivedTitle.name !== project.name) {
            productState.workingMemory = {
              ...productState.workingMemory,
              titleDerivation: {
                source: derivedTitle.source,
                derivedAt: derivedTitle.derivedAt,
                fromName: project.name
              }
            };
            await storage.updateProject(project.id, {
              name: derivedTitle.name,
              productState
            });
          }
        }
      } catch (titleErr) {
        logger.warn({ err: titleErr }, "[intake/finalize] title derivation failed");
      }
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "intake.finalize",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          specId: spec.id,
          markdownChars: renderedMarkdown.length,
          weightsApplied,
          weightsAssumed,
          tradeoffWeights: productState.tradeoffWeights ?? null,
          titleDerived: derivedTitle ? derivedTitle.source : null
        }
      }).catch((e) => logger.error({ err: e }, "[audit] intake.finalize failed"));
      res.json({ spec, renderedMarkdown, productState, weightsAssumed, derivedTitle });
    } catch (error) {
      logger.error({ err: error }, "[intake/finalize] error");
      res.status(500).json({ message: "Failed to finalize intake" });
    }
  });
  app2.post("/api/projects/:projectId/derive-title", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project } = projectAccess;
      const { hydrateProductState: hydrateProductState2, finalize: finalize2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const { deriveProjectTitle: deriveProjectTitle2, hasEnoughSignalForTitle: hasEnoughSignalForTitle2 } = await Promise.resolve().then(() => (init_title_generator(), title_generator_exports));
      const productState = hydrateProductState2(project.productState);
      const userRenamed = Boolean(
        productState.workingMemory?.titleRenamedByUser
      );
      let spec = null;
      try {
        const finalized = finalize2({
          projectId: project.id,
          productName: project.name,
          productDescription: project.description,
          productState,
          existingSpec: null
        });
        spec = finalized.spec;
      } catch {
        spec = null;
      }
      if (!hasEnoughSignalForTitle2({
        storedName: project.name,
        description: project.description,
        minimumDetails: project.minimumDetails,
        productState,
        spec
      })) {
        return res.json({ derivedTitle: null, persisted: false, reason: "not_enough_signal" });
      }
      const derived = deriveProjectTitle2({
        storedName: project.name,
        description: project.description,
        minimumDetails: project.minimumDetails,
        productState,
        spec
      });
      const dryRun = req.query.dryRun === "1" || req.body?.dryRun === true;
      if (!derived) {
        return res.json({ derivedTitle: null, persisted: false, reason: "no_signal_resolved" });
      }
      if (userRenamed) {
        return res.json({ derivedTitle: derived, persisted: false, reason: "user_renamed" });
      }
      if (derived.name === project.name) {
        return res.json({ derivedTitle: derived, persisted: false, reason: "unchanged" });
      }
      if (dryRun) {
        return res.json({ derivedTitle: derived, persisted: false, reason: "dry_run" });
      }
      productState.workingMemory = {
        ...productState.workingMemory,
        titleDerivation: {
          source: derived.source,
          derivedAt: derived.derivedAt,
          fromName: project.name
        }
      };
      const updated = await storage.updateProject(project.id, {
        name: derived.name,
        productState
      });
      res.json({ derivedTitle: derived, persisted: true, project: updated });
    } catch (error) {
      logger.error({ err: error }, "[derive-title] error");
      res.status(500).json({ message: "Failed to derive title" });
    }
  });
  app2.post("/api/projects/:projectId/rename", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project } = projectAccess;
      const parsed = z2.object({ name: z2.string().trim().min(1).max(80) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid name", errors: parsed.error.issues });
      }
      const { hydrateProductState: hydrateProductState2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const productState = hydrateProductState2(project.productState);
      productState.workingMemory = {
        ...productState.workingMemory,
        titleRenamedByUser: true,
        titleRenamedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updated = await storage.updateProject(project.id, {
        name: parsed.data.name,
        productState
      });
      res.json({ project: updated });
    } catch (error) {
      logger.error({ err: error }, "[rename] error");
      res.status(500).json({ message: "Failed to rename project" });
    }
  });
  app2.post("/api/projects/:projectId/spec/lint", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const { hydrateProductState: hydrateProductState2, hydrateSpec: hydrateSpec2, finalize: finalize2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const { lintSpec: lintSpec2 } = await Promise.resolve().then(() => (init_spec_linter(), spec_linter_exports));
      const productState = hydrateProductState2(project.productState);
      let spec;
      const inlineSpec = req.body?.spec;
      if (inlineSpec && typeof inlineSpec === "object") {
        spec = hydrateSpec2(inlineSpec, `spec-${project.id}`, project.name, project.description);
      } else {
        const built = finalize2({
          projectId: project.id,
          productName: project.name,
          productDescription: project.description,
          productState,
          existingSpec: null
        });
        spec = built.spec;
      }
      const llmConfig = await getLLMConfig(req);
      const result = await lintSpec2({
        spec,
        productState,
        llmConfig,
        context: {
          userId: actor.kind === "user" ? actor.id : null,
          guestOwnerId: actor.kind === "guest" ? actor.id : null,
          projectId: project.id
        }
      });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "spec.lint",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          issueCount: result.issues.length,
          blockerCount: result.blockerCount,
          nonWaivableCount: result.nonWaivableCount,
          llmRan: result.llmRan
        }
      }).catch((e) => logger.error({ err: e }, "[audit] spec.lint failed"));
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, "[spec/lint] error");
      res.status(500).json({ message: "Failed to lint spec" });
    }
  });
  app2.post("/api/projects/:projectId/spec/waive", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const body = z2.object({
        issueId: z2.string().min(1).max(200),
        rule: z2.string().min(1).max(200),
        reason: z2.string().min(1).max(2e3),
        refs: z2.array(z2.object({
          kind: z2.string().max(40),
          id: z2.string().max(200)
        })).optional()
      }).parse(req.body);
      const { sanitizeWaiverReason: sanitizeWaiverReason2 } = await Promise.resolve().then(() => (init_spec_linter(), spec_linter_exports));
      const cleanReason = sanitizeWaiverReason2(body.reason);
      if (cleanReason.length === 0) {
        return res.status(400).json({ message: "Waiver reason is empty after sanitization." });
      }
      const { hydrateProductState: hydrateProductState2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const currentState = hydrateProductState2(project.productState);
      const waivers = currentState.workingMemory.waivers ?? {};
      waivers[body.issueId] = {
        issueId: body.issueId,
        rule: body.rule,
        reason: cleanReason,
        refs: body.refs ?? [],
        actorId: actor.id,
        actorKind: actor.kind,
        waivedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const nextState = {
        ...currentState,
        workingMemory: { ...currentState.workingMemory, waivers }
      };
      await storage.updateProject(project.id, { productState: nextState });
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "spec.waive",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          issueId: body.issueId,
          rule: body.rule,
          reasonChars: cleanReason.length
        }
      }).catch((e) => logger.error({ err: e }, "[audit] spec.waive failed"));
      res.json({
        ok: true,
        waiver: waivers[body.issueId]
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid waiver payload", errors: error.issues });
      }
      logger.error({ err: error }, "[spec/waive] error");
      res.status(500).json({ message: "Failed to record waiver" });
    }
  });
  app2.get("/api/projects/:projectId/handoff.md", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project, actor } = projectAccess;
      if (!requireAdaptiveMode(project, res)) return;
      const { hydrateProductState: hydrateProductState2, finalize: finalize2, ensureTradeoffWeights: ensureTradeoffWeights2 } = await Promise.resolve().then(() => (init_intake_controller(), intake_controller_exports));
      const { lintSpec: lintSpec2 } = await Promise.resolve().then(() => (init_spec_linter(), spec_linter_exports));
      const { generateHandoff: generateHandoff2 } = await Promise.resolve().then(() => (init_agent_handoff(), agent_handoff_exports));
      const { scrubSecretsDeep: scrubSecretsDeep2 } = await Promise.resolve().then(() => (init_secret_crypto(), secret_crypto_exports));
      let productState = hydrateProductState2(project.productState);
      const ensured = ensureTradeoffWeights2(productState);
      let weightsAssumed = false;
      if (ensured.assumed) {
        productState = ensured.productState;
        await storage.updateProject(project.id, { productState });
        weightsAssumed = true;
      }
      const built = finalize2({
        projectId: project.id,
        productName: project.name,
        productDescription: project.description,
        productState,
        existingSpec: null
      });
      const spec = built.spec;
      const llmConfig = await getLLMConfig(req);
      const lint = await lintSpec2({
        spec,
        productState,
        llmConfig,
        context: {
          userId: actor.kind === "user" ? actor.id : null,
          guestOwnerId: actor.kind === "guest" ? actor.id : null,
          projectId: project.id
        }
      });
      const waiverBag = productState.workingMemory.waivers ?? {};
      const isWaived = (issueId) => Object.prototype.hasOwnProperty.call(waiverBag, issueId);
      const advisoryWarn = lint.issues.filter(
        (i) => (i.severity === "warn" || i.severity === "block") && !isWaived(i.id)
      );
      if (advisoryWarn.length > 0) {
        void storage.createAuditEvent({
          actorType: actor.kind,
          actorId: actor.id,
          action: "handoff.export",
          resourceType: "project",
          resourceId: project.id,
          metadata: {
            outcome: "exported_with_advisories",
            advisoryCount: advisoryWarn.length,
            advisoryIds: advisoryWarn.map((i) => i.id)
          }
        }).catch((e) => logger.error({ err: e }, "[audit] handoff.export failed"));
      }
      const safeSpec = scrubSecretsDeep2(spec);
      const safeProductState = scrubSecretsDeep2(productState);
      const handoffMarkdown = generateHandoff2(safeSpec, safeProductState);
      void storage.createAuditEvent({
        actorType: actor.kind,
        actorId: actor.id,
        action: "handoff.export",
        resourceType: "project",
        resourceId: project.id,
        metadata: {
          outcome: "success",
          markdownChars: handoffMarkdown.length,
          platformTarget: spec.platformTarget,
          waiverIds: Object.keys(waiverBag),
          weightsAssumed
        }
      }).catch((e) => logger.error({ err: e }, "[audit] handoff.export failed"));
      if (weightsAssumed) {
        res.setHeader("X-Weights-Assumed", "true");
      }
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.status(200).send(handoffMarkdown);
    } catch (error) {
      logger.error({ err: error }, "[handoff.md] error");
      res.status(500).json({ message: "Failed to generate handoff" });
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
  const latestDeliverableContent = async (stageId) => {
    const dels = await storage.getDeliverablesByStage(stageId);
    if (dels.length > 0) return dels[dels.length - 1].content;
    const msgs = await storage.getMessagesByStage(stageId);
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
    return lastAssistant?.content ?? "";
  };
  const mdFilename = (base) => `${base.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "document"}.md`;
  app2.get("/api/projects/:projectId/stages/:stageId/document.md", async (req, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
      if (!stageAccess) return;
      const { project, stage } = stageAccess;
      if (stage.projectId !== req.params.projectId) {
        return res.status(404).json({ message: "Stage not found in project" });
      }
      const content = await latestDeliverableContent(stage.id);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${mdFilename(`${project.name}-${stage.title}`)}"`
      );
      res.status(200).send(content);
    } catch (error) {
      logger.error({ err: error }, "[document.md] error");
      res.status(500).json({ message: "Failed to export document" });
    }
  });
  app2.get("/api/projects/:projectId/documents.md", async (req, res) => {
    try {
      const projectAccess = await loadOwnedProject(req, res, req.params.projectId);
      if (!projectAccess) return;
      const { project } = projectAccess;
      const stages2 = (await storage.getStagesByProject(project.id)).sort(
        (a, b) => a.stageNumber - b.stageNumber
      );
      const sections = [`# ${project.name}

${project.description}`];
      for (const stage of stages2) {
        const content = await latestDeliverableContent(stage.id);
        if (content.trim().length === 0) continue;
        sections.push(`# ${stage.title}

${content}`);
      }
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${mdFilename(`${project.name}-all-documents`)}"`
      );
      res.status(200).send(sections.join("\n\n---\n\n"));
    } catch (error) {
      logger.error({ err: error }, "[documents.md] error");
      res.status(500).json({ message: "Failed to export documents" });
    }
  });
  app2.get("/api/projects/:projectId/stages/:stageId/versions", async (req, res) => {
    try {
      const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
      if (!stageAccess) return;
      const { stage } = stageAccess;
      if (stage.projectId !== req.params.projectId) {
        return res.status(404).json({ message: "Stage not found in project" });
      }
      const dels = await storage.getDeliverablesByStage(stage.id);
      res.json(
        dels.map((d) => ({
          version: d.version ?? 1,
          createdAt: d.createdAt,
          charCount: d.content.length
        }))
      );
    } catch (error) {
      logger.error({ err: error }, "[versions] error");
      res.status(500).json({ message: "Failed to list versions" });
    }
  });
  app2.post(
    "/api/projects/:projectId/stages/:stageId/versions/:version/restore",
    async (req, res) => {
      try {
        const stageAccess = await loadOwnedStage(req, res, req.params.stageId);
        if (!stageAccess) return;
        const { actor, stage } = stageAccess;
        if (stage.projectId !== req.params.projectId) {
          return res.status(404).json({ message: "Stage not found in project" });
        }
        const target = Number.parseInt(req.params.version, 10);
        if (!Number.isInteger(target) || target < 1) {
          return res.status(400).json({ message: "Invalid version" });
        }
        const dels = await storage.getDeliverablesByStage(stage.id);
        const source = dels.find((d) => (d.version ?? 1) === target);
        if (!source) {
          return res.status(404).json({ message: "Version not found" });
        }
        const restored = await storage.createMessage({
          stageId: stage.id,
          role: "assistant",
          content: source.content,
          kind: "deliverable",
          version: dels.length + 1
        });
        void storage.createAuditEvent({
          actorType: actor.kind,
          actorId: actor.id,
          action: "stage.restore_version",
          resourceType: "stage",
          resourceId: stage.id,
          metadata: { restoredFromVersion: target, newVersion: dels.length + 1 }
        }).catch((e) => logger.error({ err: e }, "[audit] stage.restore_version failed"));
        res.status(200).json({
          restoredFromVersion: target,
          newVersion: restored.version ?? dels.length + 1
        });
      } catch (error) {
        logger.error({ err: error }, "[restore version] error");
        res.status(500).json({ message: "Failed to restore version" });
      }
    }
  );
  app2.get("/api/admin/prompts", requireAuth, isAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllAdminPrompts();
      res.json(prompts);
    } catch (error) {
      logger.error({ err: error }, "Error fetching admin prompts");
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
      void storage.createAuditEvent({
        actorType: "admin",
        actorId: userId,
        action: "admin.prompt.create",
        resourceType: "admin_prompt",
        resourceId: prompt.id,
        metadata: { targetKey: prompt.targetKey, scope: prompt.scope }
      }).catch((e) => logger.error({ err: e }, "[audit] admin.prompt.create failed"));
      res.status(201).json(prompt);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid prompt data", errors: error.issues });
      }
      logger.error({ err: error }, "Error creating prompt");
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
      void storage.createAuditEvent({
        actorType: "admin",
        actorId: userId,
        action: "admin.prompt.update",
        resourceType: "admin_prompt",
        resourceId: prompt.id,
        metadata: { targetKey: prompt.targetKey }
      }).catch((e) => logger.error({ err: e }, "[audit] admin.prompt.update failed"));
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
      logger.error({ err: error }, "Error seeding prompts");
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
  const parseIntSafe = (v, fallback) => {
    const n = typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const pickString = (v) => typeof v === "string" && v.trim().length > 0 ? v.trim() : void 0;
  app2.get("/api/admin/audit-events", requireAuth, isAdmin, async (req, res) => {
    try {
      const { rows, total } = await storage.listAuditEvents({
        actorType: pickString(req.query.actorType),
        actorId: pickString(req.query.actorId),
        action: pickString(req.query.action),
        resourceType: pickString(req.query.resourceType),
        resourceId: pickString(req.query.resourceId),
        limit: Math.min(parseIntSafe(req.query.limit, 50), 200),
        offset: parseIntSafe(req.query.offset, 0)
      });
      res.json({ rows, total });
    } catch (error) {
      logger.error({ err: error }, "Error listing audit events");
      res.status(500).json({ message: "Failed to list audit events" });
    }
  });
  app2.get("/api/admin/audit-events/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const event = await storage.getAuditEvent(req.params.id);
      if (!event) return res.status(404).json({ message: "Not found" });
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit event" });
    }
  });
  app2.get("/api/admin/llm-calls", requireAuth, isAdmin, async (req, res) => {
    try {
      const { rows, total } = await storage.listLlmCalls({
        userId: pickString(req.query.userId),
        guestOwnerId: pickString(req.query.guestOwnerId),
        projectId: pickString(req.query.projectId),
        stageId: pickString(req.query.stageId),
        provider: pickString(req.query.provider),
        model: pickString(req.query.model),
        task: pickString(req.query.task),
        status: pickString(req.query.status),
        limit: Math.min(parseIntSafe(req.query.limit, 50), 200),
        offset: parseIntSafe(req.query.offset, 0)
      });
      res.json({ rows, total });
    } catch (error) {
      logger.error({ err: error }, "Error listing LLM calls");
      res.status(500).json({ message: "Failed to list LLM calls" });
    }
  });
  app2.get("/api/admin/llm-calls/:id", requireAuth, isAdmin, async (req, res) => {
    try {
      const call = await storage.getLlmCall(req.params.id);
      if (!call) return res.status(404).json({ message: "Not found" });
      res.json(call);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LLM call" });
    }
  });
  app2.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.userId);
      const s = settings;
      const rawKey = typeof s?.llm_api_key === "string" && s.llm_api_key || typeof s?.llmApiKey === "string" && s.llmApiKey || null;
      const result = {
        llmProvider: s?.llmProvider ?? s?.llm_provider ?? "groq",
        llmModel: s?.llmModel ?? s?.llm_model ?? "openai/gpt-oss-120b",
        llmApiKeyMasked: rawKey ? `${rawKey.slice(0, 7)}...${rawKey.slice(-4)}` : null,
        platformKeysAvailable: {
          groq: Boolean(process.env.GROQ_API_KEY),
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY)
        }
      };
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });
  app2.post("/api/enhance-idea", async (req, res) => {
    try {
      const raw = typeof req.body?.idea === "string" ? req.body.idea : "";
      const idea = raw.trim();
      if (idea.length < 3) {
        return res.status(400).json({ message: "Idea must be at least 3 characters." });
      }
      if (idea.length > 2e3) {
        return res.status(400).json({ message: "Idea too long (max 2000 chars)." });
      }
      const userConfig = await getLLMConfig(req);
      const messages2 = [
        {
          role: "system",
          content: "You are a product-idea editor. Given a short product idea, rewrite it as a 2-3 sentence description. Keep the user's core concept. Add only obvious specifics (who it's for, what it does, the key value). Do not invent features the user didn't hint at. No headers, no markdown, no quotes \u2014 plain text only. Write in the same tone the user used. Keep it under 80 words."
        },
        { role: "user", content: idea }
      ];
      const result = await aiService.chat(messages2, "claude-sonnet", userConfig, "chat");
      const enhanced = (result.content || "").trim().replace(/^["']|["']$/g, "");
      if (!enhanced) {
        return res.status(502).json({ message: "Empty response from model." });
      }
      return res.json({ enhanced });
    } catch (error) {
      logger.warn({ err: error?.message }, "enhance-idea failed");
      return res.status(500).json({ message: "Failed to enhance idea." });
    }
  });
  app2.post("/api/clarify", async (req, res) => {
    try {
      const raw = typeof req.body?.idea === "string" ? req.body.idea : "";
      const idea = raw.trim();
      if (idea.length < 3) {
        return res.status(400).json({ message: "Idea must be at least 3 characters." });
      }
      if (idea.length > 2e3) {
        return res.status(400).json({ message: "Idea too long (max 2000 chars)." });
      }
      const priorAnswers = req.body?.priorAnswers && typeof req.body.priorAnswers === "object" ? req.body.priorAnswers : {};
      const userConfig = await getLLMConfig(req);
      const systemPrompt = `You are ProductPilot's clarification step. The user typed a product idea and is about to generate PRD/architecture/coding docs. Your job is to decide whether the idea is well-enough specified to generate good docs, and if not, to ask the 2\u20134 highest-leverage clarifying questions before generation starts.

Priority of missing information: audience \u2192 primary platform \u2192 scope (must-have v1) \u2192 budget/timeline \u2192 constraints.

You MUST return valid JSON only, matching this schema:
{
  "needsClarification": true,
  "summary": "One short sentence restating the idea in the user's own words.",
  "questions": [
    {
      "id": "audience",
      "question": "Short, single-focus question in plain English.",
      "chips": ["Concrete option 1", "Concrete option 2", "Concrete option 3", "Concrete option 4"]
    }
  ]
}

Rules:
- Ask 2\u20134 questions when needsClarification is true. Never only 1 \u2014 that wastes a turn. If you can only think of one, also ask about scope or primary platform.
- Each question must be answerable by tapping exactly one chip. Chips must be concrete, mutually exclusive, 3 or 4 per question, never longer than 4 words each.
- If the idea already names an audience, do NOT ask about audience \u2014 skip to the next missing slot.
- If the idea already names a platform, do NOT ask about platform \u2014 skip to scope or constraints.
- Never ask about team size, hiring, agencies, or staffing.
- Never echo the idea back as a question.
- If the idea is already strongly specified (names audience + platform + scope), return {"needsClarification": false, "summary": "<one sentence>", "questions": []}.`;
      const userPrompt = `Idea: "${idea}"

Prior answers from the user (may be empty): ${JSON.stringify(priorAnswers)}

Return the JSON now.`;
      const result = await aiService.generateStructuredOutput(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        "claude-sonnet",
        userConfig,
        "chat"
      );
      const questions = Array.isArray(result?.questions) ? result.questions.slice(0, 4).map((q, i) => ({
        id: typeof q?.id === "string" && q.id.trim() ? q.id.trim() : `q${i + 1}`,
        question: typeof q?.question === "string" ? q.question.slice(0, 180) : "",
        chips: Array.isArray(q?.chips) ? q.chips.filter((c) => typeof c === "string" && c.trim()).slice(0, 5).map((c) => c.slice(0, 32)) : []
      })).filter((q) => q.question && q.chips.length >= 2) : [];
      const FALLBACK_QUESTIONS = [
        {
          id: "platform",
          question: "What's the primary surface you want to ship on first?",
          chips: ["Web", "iOS", "Android", "Desktop"]
        },
        {
          id: "scope",
          question: "For a first version, which feels most important?",
          chips: ["Fast to ship", "Beautiful UI", "Power-user depth", "Rock-solid data"]
        },
        {
          id: "audience",
          question: "Who is this mostly for?",
          chips: ["Just me", "Small team", "A community", "Customers"]
        }
      ];
      const needs = Boolean(result?.needsClarification) && questions.length > 0;
      if (needs && questions.length === 1) {
        const takenIds = new Set(questions.map((q) => q.id.toLowerCase()));
        for (const fb of FALLBACK_QUESTIONS) {
          if (!takenIds.has(fb.id) && questions.length < 2) {
            questions.push(fb);
          }
        }
      }
      return res.json({
        needsClarification: needs,
        summary: typeof result?.summary === "string" ? result.summary.slice(0, 240) : "",
        questions
      });
    } catch (error) {
      logger.warn({ err: error?.message }, "clarify failed");
      return res.json({ needsClarification: false, summary: "", questions: [] });
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
init_logger();
import { Pool as Pool2 } from "pg";
import { drizzle as drizzle2 } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql as sql3 } from "drizzle-orm";
import path3 from "node:path";
import url from "node:url";

// server/lib/migrate-guard.ts
import fs2 from "node:fs";
import path2 from "node:path";
var SQL_FILE_PATTERN = /^(\d{4})_.*\.sql$/;
function scanMigrationJournal(migrationsFolder) {
  const journalPath = path2.join(migrationsFolder, "meta", "_journal.json");
  const journalRaw = fs2.readFileSync(journalPath, "utf-8");
  const journal = JSON.parse(journalRaw);
  const journaledTags = new Set(journal.entries.map((e) => e.tag));
  const dirEntries = fs2.readdirSync(migrationsFolder);
  const sqlFiles = dirEntries.filter((f) => SQL_FILE_PATTERN.test(f)).sort();
  const journaled = [];
  const unjournaled = [];
  for (const file of sqlFiles) {
    const tag = file.replace(/\.sql$/, "");
    if (journaledTags.has(tag)) {
      journaled.push(file);
    } else {
      unjournaled.push({ file, expectedTag: tag });
    }
  }
  return { journaled, unjournaled };
}
function assertJournalCoversAllMigrations(migrationsFolder) {
  const { unjournaled } = scanMigrationJournal(migrationsFolder);
  if (unjournaled.length === 0) return;
  const lines = unjournaled.map(
    (u) => `  - ${u.file} \u2192 expected entry with tag "${u.expectedTag}" in migrations/meta/_journal.json`
  ).join("\n");
  throw new Error(
    `Migration journal drift: ${unjournaled.length} SQL file(s) on disk are missing from _journal.json.
drizzle-orm's migrator iterates the journal, so these would be silently skipped at deploy.
Add a journal entry for each:
${lines}`
  );
}

// server/migrate.ts
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
function resolveMigrationsFolder() {
  try {
    const here = url.fileURLToPath(import.meta.url);
    let dir = path3.dirname(here);
    for (let i = 0; i < 6; i += 1) {
      const candidate = path3.join(dir, "migrations", "meta", "_journal.json");
      try {
        const fs3 = __require("node:fs");
        if (fs3.existsSync(candidate)) {
          return path3.join(dir, "migrations");
        }
      } catch {
      }
      const parent = path3.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
  }
  return path3.resolve(process.cwd(), "migrations");
}
async function stampPreExistingMigrations(pool2) {
  await pool2.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool2.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  const { rows: countRows } = await pool2.query(
    `SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations`
  );
  const existingRows = Number(countRows[0]?.count ?? "0");
  const { rows: probeRows } = await pool2.query(
    `SELECT to_regclass('public.audit_events')::text AS to_regclass`
  );
  const hasAuditEvents = Boolean(probeRows[0]?.to_regclass);
  if (existingRows === 0 && hasAuditEvents) {
    await pool2.query(
      `CREATE TABLE IF NOT EXISTS "rateLimit" (
         "key" text PRIMARY KEY NOT NULL,
         "count" integer NOT NULL,
         "last_request" bigint NOT NULL
       )`
    );
    const now = Date.now();
    await pool2.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
       VALUES ($1, $2), ($3, $4)`,
      [
        "0000_happy_thunderball",
        now - 1e3,
        "0001_consolidate_from_runtime",
        now
      ]
    );
    logger.info(
      "Detected pre-existing schema. Back-filled rateLimit if missing; stamped 0000 + 0001 as applied; migrator will resume from 0002."
    );
  }
}
async function runMigrations() {
  const dbUrl2 = getDatabaseUrl2();
  const connString2 = !dbUrl2.includes("sslmode=") ? dbUrl2 + (dbUrl2.includes("?") ? "&" : "?") + "sslmode=require" : dbUrl2;
  const pool2 = new Pool2({ connectionString: connString2 });
  try {
    logger.info("Running database migrations");
    const migrationsFolder = resolveMigrationsFolder();
    assertJournalCoversAllMigrations(migrationsFolder);
    await stampPreExistingMigrations(pool2);
    const db2 = drizzle2(pool2);
    await migrate(db2, { migrationsFolder });
    logger.info("Database migrations completed successfully");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Error running migrations");
    return false;
  } finally {
    await pool2.end();
  }
}

// server/lib/sentry.ts
import * as Sentry from "@sentry/node";
var initialized = false;
function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    profilesSampleRate: 0,
    // enable later if @sentry/profiling-node works
    // Serverless: don't fork worker threads
    // autoSessionTracking removed — not in @sentry/node NodeOptions type (serverless default is already off)
    // Don't capture these
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured"
    ]
  });
  initialized = true;
}

// server/api-entry/index.ts
init_logger();
initSentry();
var appInitialized = false;
var app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
async function ensureInitialized() {
  if (appInitialized) return;
  try {
    await runMigrations();
  } catch (error) {
    logger.warn({ err: error }, "Skipping migrations");
  }
  await registerRoutes(app);
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
    Sentry.captureException(err);
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
