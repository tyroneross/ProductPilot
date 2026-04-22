import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { buildProgressAssessmentPrompt } from "../prompt-builders";

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

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

export class AIService {
  private getDefaultConfig(task: LLMTask = 'chat'): LLMConfig {
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasGroq = Boolean(process.env.GROQ_API_KEY);

    if (!hasAnthropic && !hasGroq) {
      throw new Error("No LLM API key configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY.");
    }

    // With both keys: deliverables + classification + complex go to Anthropic; chat stays on Groq.
    if (hasAnthropic && hasGroq) {
      switch (task) {
        case 'deliverable':
          return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-sonnet-4-5' };
        case 'complex':
          return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-opus-4-7' };
        case 'classification':
          return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-haiku-4-5' };
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
  ): Promise<AIResponse> {
    const config = userConfig || this.getDefaultConfig(task);

    switch (config.provider) {
      case 'groq':
        return this.chatWithGroq(messages, config.model || GROQ_MODELS.fast, config.apiKey);
      case 'anthropic':
        return this.chatWithClaude(messages, this.normalizeModel(model || config.model || 'claude-sonnet'), config.apiKey);
      default:
        return this.chatWithGroq(messages, GROQ_MODELS.fast, this.getDefaultConfig(task).apiKey);
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
  ): AsyncGenerator<StreamChunk> {
    const config = userConfig || this.getDefaultConfig(task);

    if (config.provider === 'anthropic') {
      yield* this.streamClaude(
        messages,
        this.normalizeModel(model || config.model || 'claude-sonnet'),
        config.apiKey,
      );
      return;
    }

    // Groq (default)
    yield* this.streamGroq(messages, config.model || GROQ_MODELS.fast, config.apiKey);
  }

  private async *streamGroq(messages: AIMessage[], model: string, apiKey: string): AsyncGenerator<StreamChunk> {
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
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        yield { type: 'delta', text: delta };
      }
    }
    yield { type: 'done', fullContent: full };
  }

  private async *streamClaude(messages: AIMessage[], model: string, apiKey?: string): AsyncGenerator<StreamChunk> {
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
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        full += event.delta.text;
        yield { type: 'delta', text: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    yield {
      type: 'done',
      fullContent: full,
      usage: {
        prompt_tokens: final.usage.input_tokens,
        completion_tokens: final.usage.output_tokens,
        total_tokens: final.usage.input_tokens + final.usage.output_tokens,
      },
    };
  }

  private async chatWithGroq(messages: AIMessage[], model: string, apiKey: string): Promise<AIResponse> {
    const groq = new Groq({ apiKey });

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await groq.chat.completions.create({
      model,
      messages: [
        ...(systemMessage ? [{ role: 'system' as const, content: systemMessage.content }] : []),
        ...conversationMessages,
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';
    return { content };
  }

  private async chatWithClaude(messages: AIMessage[], model: string, apiKey?: string): Promise<AIResponse> {
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

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.7,
        system: systemMessage?.content
          ? [{ type: "text", text: systemMessage.content, cache_control: { type: "ephemeral" } }]
          : undefined,
        messages: conversationMessages,
      });

      const firstBlock = response.content?.[0];
      const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

      return {
        content,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateStructuredOutput(
    messages: AIMessage[],
    model: string = "claude-sonnet",
    userConfig?: LLMConfig | null,
    task: LLMTask = 'classification',
  ): Promise<any> {
    const config = userConfig || this.getDefaultConfig(task);

    if (config.provider === 'groq') {
      // Use Groq for structured output — extract JSON from response.
      // Default to reasoning-tier (gpt-oss-120b) for structured gen; caller can override via config.model.
      const groqModel = config.model || (task === 'classification' ? GROQ_MODELS.fast : GROQ_MODELS.reasoning);
      const response = await this.chatWithGroq(messages, groqModel, config.apiKey);
      try { return this.extractJSON(response.content); } catch { return {}; }
    }

    // Anthropic path — use config.model if set (from task-based routing), else normalize caller's model.
    const targetModel = config.model || this.normalizeModel(model);
    return this.generateStructuredWithClaude(messages, this.normalizeModel(targetModel), config.apiKey);
  }

  private async generateStructuredWithClaude(messages: AIMessage[], model: string, apiKey?: string): Promise<any> {
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

      const firstBlock = response.content?.[0];
      const content = firstBlock && firstBlock.type === "text" ? firstBlock.text : "{}";
      return this.extractJSON(content);
    } catch (error) {
      throw new Error(`Claude structured output error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async calculateProgress(messages: AIMessage[], stageGoals: string[], userConfig?: LLMConfig | null): Promise<number> {
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
      );

      return Math.min(100, Math.max(0, result.progress || 0));
    } catch (error) {
      const meaningfulMessages = messages.filter(m => m.role === "user" && m.content.length > 20);
      return Math.max(0, Math.min(75, meaningfulMessages.length * 15));
    }
  }
}

export const aiService = new AIService();
