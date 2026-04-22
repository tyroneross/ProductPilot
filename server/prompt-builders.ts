import type { Message, Project, Stage } from "@shared/schema";

type ActiveCustomPrompt = {
  id: string;
  name: string;
  prompt: string;
  category: string;
  isActive: boolean;
};

const STAGE_SECTION_GUIDANCE: Record<number, string[]> = {
  1: [
    "Problem",
    "Target Users",
    "Core Jobs To Be Done",
    "MVP Scope",
    "Non-Goals",
    "Constraints",
    "Success Metrics",
    "Open Questions",
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
    "Non-Goals",
  ],
  // Stage 3 = Design Requirements. User flows + outcomes, not low-fi HTML.
  3: [
    "Key User Flows",
    "Critical Screens",
    "Interaction Requirements",
    "Target Outcomes",
    "Accessibility Requirements",
    "Responsive Requirements",
    "Open Questions",
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
    "Assumptions & Open Questions",
  ],
  5: [
    "Repo Bootstrap Prompt",
    "Schema Migration Prompt",
    "Backend Route Prompts",
    "Frontend Screen Prompts",
    "Smoke Test Prompt",
    "Deploy Prompt",
  ],
  6: [
    "Phases",
    "Milestones",
    "Workstreams",
    "Dependencies",
    "QA and Release Checklist",
    "Monitoring and Maintenance",
    "Open Risks",
  ],
};

const STAGE_DELIVERABLE_HINTS: Record<number, string> = {
  1: "Make the output crisp enough that product, design, and engineering align on scope.",
  2: "This is the North Star doc. Every later LLM call will reference it to decide what's in-scope. Capture pain, ICP, JTBD, and success crisply — no duplication with Stage 1's concrete scope.",
  3: "Specify design requirements — user flows, interaction patterns, target outcomes. Do NOT produce HTML. The output is read by AI coding tools that will choose their own component library.",
  4: "Produce build-grade artifacts a solo developer can paste into Claude Code / Cursor and ship. Include a runnable schema.sql DDL block, TypeScript types, and explicit API contracts with request/response JSON.",
  5: "Each prompt must reference Stage 4's data model / types / APIs and Stage 3's screens by name. Prompts are paste-ready — they include file paths, exact deps, env keys, and concrete commands.",
  6: "Produce an execution plan a solo builder can follow without a second translation pass. Commands over ceremony.",
};

function parseJsonField(field: unknown): Record<string, any> | null {
  if (!field) return null;
  if (typeof field === "object") return field as Record<string, any>;
  if (typeof field === "string") {
    try {
      return JSON.parse(field) as Record<string, any>;
    } catch {
      return null;
    }
  }
  return null;
}

export function buildProjectContext(project: Project): string {
  let projectContext = "";

  if (project.description) {
    projectContext += `\n\n=== PRODUCT IDEA ===\n${project.description}`;
  }

  const intake = parseJsonField(project.intakeAnswers);
  if (intake && Object.keys(intake).length > 0) {
    projectContext += `\n\n=== INTAKE SURVEY RESPONSES ===`;

    const intakeLabels: Record<string, string> = {
      intent: "What they're building",
      platform: "Platform/Type",
      aiFeatures: "AI Features",
      dataComplexity: "Data Complexity",
      qualityPriority: "Quality Priority",
      launchTimeline: "Launch Timeline",
      teamSize: "Team Size",
      budget: "Budget",
    };

    for (const [key, value] of Object.entries(intake)) {
      if (!value) continue;
      const label = intakeLabels[key] || key;
      projectContext += `\n- ${label}: ${value}`;
    }
  }

  const details = parseJsonField(project.minimumDetails);
  if (details && Object.keys(details).length > 0) {
    projectContext += `\n\n=== MINIMUM PRODUCT DETAILS ===`;

    if (details.problemStatement) {
      projectContext += `\nProblem Statement: ${details.problemStatement}`;
    }
    if (details.userGoals && Array.isArray(details.userGoals)) {
      const goals = details.userGoals.filter((goal: string) => goal.trim());
      if (goals.length > 0) {
        projectContext += `\nUser Goals: ${goals.join(", ")}`;
      }
    }
    if (details.goals && Array.isArray(details.goals)) {
      projectContext += `\nGoals: ${details.goals.join(", ")}`;
    }
    if (details.mainObjects && Array.isArray(details.mainObjects)) {
      const objects = details.mainObjects.filter((item: string) => item.trim());
      if (objects.length > 0) {
        projectContext += `\nCore Objects/Entities: ${objects.join(", ")}`;
      }
    }
    if (details.objects && Array.isArray(details.objects)) {
      projectContext += `\nCore Objects/Entities: ${details.objects.join(", ")}`;
    }
    if (details.mainActions && Array.isArray(details.mainActions)) {
      const actions = details.mainActions.filter((item: string) => item.trim());
      if (actions.length > 0) {
        projectContext += `\nKey Actions: ${actions.join(", ")}`;
      }
    }
    if (details.actions && Array.isArray(details.actions)) {
      projectContext += `\nKey Actions: ${details.actions.join(", ")}`;
    }
    if (details.v1Definition) {
      projectContext += `\nV1 Scope: ${details.v1Definition}`;
    }
    if (details.inspirationLink) {
      projectContext += `\nInspiration/Reference: ${details.inspirationLink}`;
    }
    if (details.mustUseTools) {
      projectContext += `\nMust Use: ${details.mustUseTools}`;
    }
    if (details.mustAvoidTools) {
      projectContext += `\nMust Avoid: ${details.mustAvoidTools}`;
    }
  }

  return projectContext;
}

export function buildStageRuntimeSystemPrompt(args: {
  basePrompt: string;
  projectContext: string;
  stageNumber: number;
  userMessageCount: number;
}): string {
  const { basePrompt, projectContext, stageNumber, userMessageCount } = args;
  let prompt = basePrompt;

  if (projectContext) {
    prompt += `\n\n<PROJECT_CONTEXT>${projectContext}\n\nUse this context to avoid re-asking for information that is already known. If context is incomplete, ask only for the highest-value missing detail.</PROJECT_CONTEXT>`;
  }

  if (stageNumber === 2 && userMessageCount < 6) {
    prompt += `\n\n<RUNTIME_RULES>You have received ${userMessageCount} user messages so far. Because this is still early discovery, ask exactly one focused follow-up question, keep the response under 300 characters, and do not generate PRD sections or formatted document output.</RUNTIME_RULES>`;
  }

  if (stageNumber === 3) {
    prompt += `\n\n<RUNTIME_RULES>Whenever you generate a deliverable response in this stage, include complete HTML wireframe code inside \`\`\`html blocks. Use inline CSS only and keep the output low-fidelity but viewable.</RUNTIME_RULES>`;
  }

  return prompt;
}

export function buildSurveyGenerationPrompt(args: {
  projectDescription: string;
  discoveryMessages: Message[];
}): string {
  const transcript =
    args.discoveryMessages.length > 0
      ? args.discoveryMessages.map((message) => `${message.role}: ${message.content}`).join("\n")
      : "No discovery transcript is available.";

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

export function buildDocumentGenerationPrompt(args: {
  stage: Stage;
  surveyDefinition: unknown;
  surveyResponses: unknown;
  detailLevel: "detailed" | "summary";
  activePrompts: ActiveCustomPrompt[];
  relevantPrompts: ActiveCustomPrompt[];
  productDescription: string;
}): string {
  const detailInstruction =
    args.detailLevel === "summary"
      ? "Generate the concise version. Under each heading, write only 1–2 lines of dense, decision-grade prose — the way a requirements definition reads. No padding, no restated context, no transitions. If a heading has nothing decided yet, write one line noting the gap and move on."
      : "Generate the detailed version. Be comprehensive and specific, but keep each subsection tight: short declarative sentences, bullet lists over paragraphs, no filler. A builder should be able to skim each heading in under 10 seconds and know what to do.";

  const allPromptContext =
    args.activePrompts.length > 0
      ? `\nActive custom prompts across the project:\n${args.activePrompts
          .map((prompt) => `- ${prompt.name} [${prompt.category}]: ${prompt.prompt}`)
          .join("\n")}`
      : "";

  const relevantPromptContext =
    args.relevantPrompts.length > 0
      ? `\nStage-specific custom prompts:\n${args.relevantPrompts
          .map((prompt) => `- ${prompt.name}: ${prompt.prompt}`)
          .join("\n")}`
      : "";

  const requiredSections = STAGE_SECTION_GUIDANCE[args.stage.stageNumber] || [
    "Overview",
    "Key Decisions",
    "Open Questions",
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

export function buildMinimumDetailsDocumentPrompt(args: {
  stage: Stage;
  minimalContext: string;
  appStyleSummary: string | null;
}): string {
  const requiredSections = STAGE_SECTION_GUIDANCE[args.stage.stageNumber] || [
    "Overview",
    "Key Decisions",
    "Open Questions",
  ];

  return `You are generating the "${args.stage.title}" deliverable from ProductPilot's minimum-details flow.

Context:
${args.minimalContext}${args.appStyleSummary ? `\n${args.appStyleSummary}` : ""}

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

export function buildProgressAssessmentPrompt(args: {
  messages: Array<{ role: string; content: string }>;
  stageGoals: string[];
}): string {
  return `Evaluate stage completion for ProductPilot.

Task:
- Estimate completion as an integer from 0 to 100 based on the user's conversation and the stated stage goals.

Context:
- Stage goals:
${args.stageGoals.map((goal) => `  - ${goal}`).join("\n")}
- Recent conversation:
${args.messages
  .slice(-10)
  .map((message) => `${message.role}: ${message.content}`)
  .join("\n")}

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
