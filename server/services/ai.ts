import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { buildProgressAssessmentPrompt } from "../prompt-builders";
import { logger } from "../lib/logger";

// Current Anthropic models (2026-04): claude-opus-4-7, claude-sonnet-4-5, claude-haiku-4-5.
// Current Groq models (2026-04): openai/gpt-oss-120b (reasoning, $0.15/$0.60), llama-3.1-8b-instant
// (fast chat, $0.05/$0.08). llama-3.3-70b-versatile is kept as a fallback alias but is ~4x more expensive
// than gpt-oss-120b for similar quality — prefer gpt-oss-120b.

const GROQ_MODELS = {
  // Reasoning / deliverables / complex tasks. Replaces the retired kimi-k2-instruct-0905.
  reasoning: 'openai/gpt-oss-120b',
  // Fast, cheap chat and classification. 12x cheaper input than llama-3.3-70b.
  fast: 'llama-3.1-8b-instant',
  // Safety classifier (not used today).
  safeguard: 'openai/gpt-oss-safeguard-20b',
} as const;

// Prices per 1M tokens in USD. Update this table when providers change pricing.
// Last verified: 2026-04-22
export const MODEL_COST_RATES: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }> = {
  // Anthropic
  "claude-opus-4-7":            { input: 5.00,  output: 25.00, cacheRead: 0.50,  cacheWrite: 6.25  },
  "claude-sonnet-4-5":          { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-haiku-4-5":           { input: 1.00,  output:  5.00, cacheRead: 0.10,  cacheWrite: 1.25  },
  // Groq
  "openai/gpt-oss-120b":        { input: 0.15,  output: 0.60  },
  "llama-3.1-8b-instant":       { input: 0.05,  output: 0.08  },
  "llama-3.3-70b-versatile":    { input: 0.59,  output: 0.79  },
  "openai/gpt-oss-safeguard-20b":{ input: 0.075, output: 0.30  },
};

function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): string | null {
  const rate = MODEL_COST_RATES[model];
  if (!rate) return null;
  const cost =
    (inputTokens / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output +
    (cacheReadTokens / 1_000_000) * (rate.cacheRead ?? 0) +
    (cacheWriteTokens / 1_000_000) * (rate.cacheWrite ?? 0);
  return cost.toFixed(6);
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Anthropic-compatible system block. Caller (server/prompt-builders.ts) places
 * a cache_control marker on the LAST stable block (project context, after
 * tenant scoping). Anything after the marker is per-call dynamic content and
 * is not cached.
 */
export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * Pure helper for the structured-output retry path. Extracted so unit tests
 * can exercise the loop without spinning up a real Anthropic client.
 *
 * Behavior:
 *   1. Invoke caller(blocks). If the response parses, return it.
 *   2. On parse failure: append a stricter schema-reminder block and retry
 *      ONCE. If that also fails, throw — never silently return {}.
 *
 * The reminder block's text matches what generateStructuredOutputWithBlocks
 * uses. Keeping it in one place so changing the wording updates both paths.
 */
export const STRUCTURED_RETRY_REMINDER: SystemBlock = {
  type: "text",
  text: "Your previous response was not valid JSON. Reply with ONLY a valid JSON object matching the SpecSchema. No markdown fences. No commentary. The first character of your response MUST be `{`.",
};

export async function runStructuredWithRetry(
  blocks: SystemBlock[],
  caller: (b: SystemBlock[]) => Promise<{ content: string }>,
  parser: (text: string) => any,
): Promise<{ json: any; raw: string; retried: boolean }> {
  const first = await caller(blocks);
  try {
    return { json: parser(first.content), raw: first.content, retried: false };
  } catch {
    const second = await caller([...blocks, STRUCTURED_RETRY_REMINDER]);
    // Throw on second-pass failure rather than masking with empty object.
    return { json: parser(second.content), raw: second.content, retried: true };
  }
}

/**
 * Module-level JSON extractor — exposed so the retry helper and unit tests
 * can call the same parsing logic the AIService uses internally.
 */
export function extractJSONFromText(text: string): any {
  try { return JSON.parse(text); } catch {}
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(text.slice(braceStart, braceEnd + 1)); } catch {}
  }
  throw new Error("Could not extract JSON from response");
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMConfig {
  provider: 'groq' | 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
}

// Task hint drives automatic provider+model selection when no userConfig is supplied.
// Cheap/fast for conversation, quality for deliverables, Haiku-tier for classification.
export type LLMTask = 'chat' | 'deliverable' | 'complex' | 'classification';

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; fullContent: string; usage?: AIResponse['usage'] };

export type LLMCallContext = {
  userId?: string | null;
  guestOwnerId?: string | null;
  projectId?: string | null;
  stageId?: string | null;
  requestId?: string | null;
};

export class AIService {
  private getDefaultConfig(task: LLMTask = 'chat'): LLMConfig {
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasGroq = Boolean(process.env.GROQ_API_KEY);

    if (!hasAnthropic && !hasGroq) {
      throw new Error("No LLM API key configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY.");
    }

    // 2026-05-02 routing override: Phase 3/4/5 alpha runs on Groq even when an
    // Anthropic key is present. Rationale: the user has GROQ_API_KEY and wants
    // alpha to ship on a single live provider. Anthropic stays reachable via
    // explicit BYOK (userConfig.provider='anthropic') so cache_control code
    // paths remain exercised when the caller opts in. The previous "both keys
    // → Anthropic for deliverable/complex/classification" rule is recorded in
    // git history (commit before this one) for the day Anthropic comes back.
    if (hasAnthropic && hasGroq) {
      switch (task) {
        case 'deliverable':
        case 'complex':
          return { provider: 'groq', apiKey: process.env.GROQ_API_KEY!, model: GROQ_MODELS.reasoning };
        case 'classification':
          return { provider: 'groq', apiKey: process.env.GROQ_API_KEY!, model: GROQ_MODELS.fast };
        case 'chat':
        default:
          return { provider: 'groq', apiKey: process.env.GROQ_API_KEY!, model: GROQ_MODELS.fast };
      }
    }

    // Only Anthropic — pick model by tier.
    if (hasAnthropic) {
      const model =
        task === 'complex' ? 'claude-opus-4-7' :
        task === 'classification' ? 'claude-haiku-4-5' :
        'claude-sonnet-4-5';
      return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY!, model };
    }

    // Only Groq — pick model by tier. gpt-oss-120b for reasoning/deliverables, 8b-instant for chat/classification.
    const groqModel =
      task === 'complex' || task === 'deliverable' ? GROQ_MODELS.reasoning :
      GROQ_MODELS.fast;
    return { provider: 'groq', apiKey: process.env.GROQ_API_KEY!, model: groqModel };
  }

  async chat(
    messages: AIMessage[],
    model: string = "claude-sonnet",
    userConfig?: LLMConfig | null,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): Promise<AIResponse> {
    const config = userConfig || this.getDefaultConfig(task);

    switch (config.provider) {
      case 'groq':
        return this.chatWithGroq(messages, config.model || GROQ_MODELS.fast, config.apiKey, task, context);
      case 'anthropic':
        return this.chatWithClaude(messages, this.normalizeModel(model || config.model || 'claude-sonnet'), config.apiKey, task, context);
      default:
        return this.chatWithGroq(messages, GROQ_MODELS.fast, this.getDefaultConfig(task).apiKey, task, context);
    }
  }

  /**
   * Streaming variant of chat(). Yields incremental text deltas, then a final event with the full content and usage.
   * Use for conversational stages where perceived latency matters.
   */
  async *chatStream(
    messages: AIMessage[],
    model: string = "claude-sonnet",
    userConfig?: LLMConfig | null,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): AsyncGenerator<StreamChunk> {
    const config = userConfig || this.getDefaultConfig(task);

    if (config.provider === 'anthropic') {
      yield* this.streamClaude(
        messages,
        this.normalizeModel(model || config.model || 'claude-sonnet'),
        config.apiKey,
        task,
        context,
      );
      return;
    }

    // Groq (default)
    yield* this.streamGroq(messages, config.model || GROQ_MODELS.fast, config.apiKey, task, context);
  }

  private async *streamGroq(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): AsyncGenerator<StreamChunk> {
    const startedAt = Date.now();
    let capturedUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;
    let errorCode: string | null = null;

    const groq = new Groq({ apiKey });
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = await groq.chat.completions.create({
      model,
      messages: [
        ...(systemMessage ? [{ role: 'system' as const, content: systemMessage.content }] : []),
        ...conversationMessages,
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: true,
    });

    let full = '';
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          yield { type: 'delta', text: delta };
        }
        // x_groq.usage arrives on the final chunk (verified: ChatCompletionChunk.XGroq.usage)
        if (chunk.x_groq?.usage) {
          capturedUsage = {
            prompt_tokens: chunk.x_groq.usage.prompt_tokens,
            completion_tokens: chunk.x_groq.usage.completion_tokens,
            total_tokens: chunk.x_groq.usage.total_tokens,
          };
        }
      }
    } catch (err) {
      errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
      throw err;
    } finally {
      if (!capturedUsage) {
        logger.warn({ model }, "[llm-telemetry] streamGroq: x_groq.usage not present on final chunk — token counts will be 0");
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
        context,
      });
    }

    yield {
      type: 'done',
      fullContent: full,
      usage: capturedUsage ?? undefined,
    };
  }

  private async *streamClaude(
    messages: AIMessage[],
    model: string,
    apiKey?: string,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): AsyncGenerator<StreamChunk> {
    const startedAt = Date.now();
    let capturedUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;
    let errorCode: string | null = null;

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('No Anthropic API key configured');

    const anthropic = new Anthropic({ apiKey: key });
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = anthropic.messages.stream({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemMessage?.content
        ? [{ type: 'text', text: systemMessage.content, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: conversationMessages,
    });

    let full = '';
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          full += event.delta.text;
          yield { type: 'delta', text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      capturedUsage = {
        prompt_tokens: final.usage.input_tokens,
        completion_tokens: final.usage.output_tokens,
        total_tokens: final.usage.input_tokens + final.usage.output_tokens,
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
        context,
      });
    }

    yield {
      type: 'done',
      fullContent: full,
      usage: capturedUsage ?? undefined,
    };
  }

  private async chatWithGroq(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): Promise<AIResponse> {
    const startedAt = Date.now();
    let response: AIResponse | null = null;
    let errorCode: string | null = null;

    try {
      const groq = new Groq({ apiKey });

      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const groqResponse = await groq.chat.completions.create({
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system' as const, content: systemMessage.content }] : []),
          ...conversationMessages,
        ],
        max_tokens: 4096,
        temperature: 0.7,
      });

      const content = groqResponse.choices[0]?.message?.content || '';
      response = {
        content,
        usage: groqResponse.usage
          ? {
              prompt_tokens: groqResponse.usage.prompt_tokens,
              completion_tokens: groqResponse.usage.completion_tokens,
              total_tokens: groqResponse.usage.total_tokens,
            }
          : undefined,
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
        context,
      });
    }
  }

  private async chatWithClaude(
    messages: AIMessage[],
    model: string,
    apiKey?: string,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): Promise<AIResponse> {
    const startedAt = Date.now();
    let response: AIResponse | null = null;
    let errorCode: string | null = null;

    try {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("No Anthropic API key configured");

      const anthropic = new Anthropic({ apiKey: key });

      const systemMessage = messages.find(m => m.role === "system");
      const conversationMessages = messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }));

      const claudeResponse = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.7,
        system: systemMessage?.content
          ? [{ type: "text", text: systemMessage.content, cache_control: { type: "ephemeral" } }]
          : undefined,
        messages: conversationMessages,
      });

      const firstBlock = claudeResponse.content?.[0];
      const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

      response = {
        content,
        usage: {
          prompt_tokens: claudeResponse.usage.input_tokens,
          completion_tokens: claudeResponse.usage.output_tokens,
          total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
        },
      };
      return response;
    } catch (err) {
      errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
      throw new Error(`Claude API error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
        context,
      });
    }
  }

  async generateStructuredOutput(
    messages: AIMessage[],
    model: string = "claude-sonnet",
    userConfig?: LLMConfig | null,
    task: LLMTask = 'classification',
    context?: LLMCallContext,
  ): Promise<any> {
    const config = userConfig || this.getDefaultConfig(task);

    if (config.provider === 'groq') {
      // Use Groq for structured output — extract JSON from response.
      // Default to reasoning-tier (gpt-oss-120b) for structured gen; caller can override via config.model.
      const groqModel = config.model || (task === 'classification' ? GROQ_MODELS.fast : GROQ_MODELS.reasoning);
      const response = await this.chatWithGroq(messages, groqModel, config.apiKey, task, context);
      try { return this.extractJSON(response.content); } catch { return {}; }
    }

    // Anthropic path — use config.model if set (from task-based routing), else normalize caller's model.
    const targetModel = config.model || this.normalizeModel(model);
    return this.generateStructuredWithClaude(messages, this.normalizeModel(targetModel), config.apiKey, task, context);
  }

  private async generateStructuredWithClaude(
    messages: AIMessage[],
    model: string,
    apiKey?: string,
    task: LLMTask = 'classification',
    context?: LLMCallContext,
  ): Promise<any> {
    const startedAt = Date.now();
    let capturedUsage: { prompt_tokens: number; completion_tokens: number } | null = null;
    let errorCode: string | null = null;

    try {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("No Anthropic API key configured");

      const anthropic = new Anthropic({ apiKey: key });

      const systemMessage = messages.find(m => m.role === "system");
      const conversationMessages = messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }));

      const systemPrompt = systemMessage?.content
        ? `${systemMessage.content}\n\nIMPORTANT: You must respond with valid JSON only. Do not include any text before or after the JSON object.`
        : "You must respond with valid JSON only. Do not include any text before or after the JSON object.";

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.3,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: conversationMessages,
      });

      capturedUsage = {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
      };

      const firstBlock = response.content?.[0];
      const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "{}";
      return this.extractJSON(content);
    } catch (err) {
      errorCode = err instanceof Error ? err.message.slice(0, 120) : "unknown";
      throw new Error(`Claude structured output error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
        context,
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
  async generateStructuredOutputWithBlocks(args: {
    systemBlocks: SystemBlock[];
    userMessages: AIMessage[];
    model?: string;
    apiKey?: string;
    task?: LLMTask;
    context?: LLMCallContext;
    maxTokens?: number;
  }): Promise<{ json: any; raw: string; retried: boolean }> {
    const startedAt = Date.now();
    const model = this.normalizeModel(args.model || "claude-sonnet-4-5");
    const key = args.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("No Anthropic API key configured");

    const anthropic = new Anthropic({ apiKey: key });
    const conversationMessages = args.userMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const callOnce = async (blocks: SystemBlock[]) => {
      const resp = await anthropic.messages.create({
        model,
        max_tokens: args.maxTokens ?? 4096,
        temperature: 0.3,
        system: blocks,
        messages: conversationMessages,
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
    let errorCode: string | null = null;

    try {
      let { resp, content } = await callOnce(args.systemBlocks);
      totalInput += resp.usage.input_tokens;
      totalOutput += resp.usage.output_tokens;
      // Anthropic returns cache token counts on usage when caching is active.
      // The TS SDK exposes them as `cache_creation_input_tokens` / `cache_read_input_tokens`.
      totalCacheRead += (resp.usage as any).cache_read_input_tokens ?? 0;
      totalCacheWrite += (resp.usage as any).cache_creation_input_tokens ?? 0;

      try {
        return { json: this.extractJSON(content), raw: content, retried };
      } catch {
        // Retry once with a sharper schema reminder appended to the dynamic block.
        retried = true;
        const remindered: SystemBlock[] = [
          ...args.systemBlocks,
          {
            type: "text",
            text: "Your previous response was not valid JSON. Reply with ONLY a valid JSON object matching the SpecSchema. No markdown fences. No commentary. The first character of your response MUST be `{`.",
          },
        ];
        const second = await callOnce(remindered);
        totalInput += second.resp.usage.input_tokens;
        totalOutput += second.resp.usage.output_tokens;
        totalCacheRead += (second.resp.usage as any).cache_read_input_tokens ?? 0;
        totalCacheWrite += (second.resp.usage as any).cache_creation_input_tokens ?? 0;
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
        context: args.context,
      });
    }
  }

  /**
   * Extract JSON from LLM response that may include markdown fences or extra text.
   */
  private extractJSON(text: string): any {
    // Try direct parse first
    try { return JSON.parse(text); } catch {}
    // Try extracting from ```json ... ``` fences
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1]); } catch {}
    }
    // Try finding first { ... } block
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try { return JSON.parse(text.slice(braceStart, braceEnd + 1)); } catch {}
    }
    throw new Error("Could not extract JSON from response");
  }

  private normalizeModel(model: string): string {
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

  async calculateProgress(
    messages: AIMessage[],
    stageGoals: string[],
    userConfig?: LLMConfig | null,
    context?: LLMCallContext,
  ): Promise<number> {
    const progressPrompt = buildProgressAssessmentPrompt({
      messages,
      stageGoals,
    });

    try {
      // Classification task — routes to Haiku 4.5 when Anthropic key present, else Groq llama.
      const result = await this.generateStructuredOutput(
        [
          { role: "system", content: "You are a progress assessment expert." },
          { role: "user", content: progressPrompt },
        ],
        "claude-haiku",
        userConfig,
        'classification',
        context,
      );

      return Math.min(100, Math.max(0, result.progress || 0));
    } catch (error) {
      const meaningfulMessages = messages.filter(m => m.role === "user" && m.content.length > 20);
      return Math.max(0, Math.min(75, meaningfulMessages.length * 15));
    }
  }

  private async recordLlmCall(args: {
    provider: string;
    model: string;
    task: LLMTask;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number | null;
    cacheWriteTokens: number | null;
    latencyMs: number;
    status: string;
    errorCode: string | null;
    streamed: boolean;
    byok: boolean;
    context?: LLMCallContext;
  }): Promise<void> {
    try {
      const { storage } = await import("../storage-hybrid");
      await storage.createLlmCall({
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
          args.cacheWriteTokens ?? 0,
        ),
        latencyMs: args.latencyMs,
        status: args.status,
        errorCode: args.errorCode,
        streamed: args.streamed,
        byok: args.byok,
        requestId: args.context?.requestId ?? null,
      });
    } catch (err) {
      logger.error({ err }, "[llm-telemetry] Failed to record call");
    }
  }
}

export const aiService = new AIService();
