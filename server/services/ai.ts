import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "your-openai-key"
});

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

export class AIService {
  async chat(messages: AIMessage[], model: string = "gpt-4o"): Promise<AIResponse> {
    try {
      const response = await openai.chat.completions.create({
        model: this.normalizeModel(model),
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      return {
        content: response.choices[0].message.content || "",
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateStructuredOutput(messages: AIMessage[], model: string = "gpt-4o"): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: this.normalizeModel(model),
        messages,
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || "{}";
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`AI structured output error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private normalizeModel(model: string): string {
    switch (model.toLowerCase()) {
      case "claude-sonnet":
      case "chatgpt-4":
      case "gpt-4":
        return "gpt-4o"; // Use latest OpenAI model
      case "groq":
      case "groq-llama":
        // For now, fallback to OpenAI. In production, implement Groq integration
        return "gpt-4o";
      default:
        return "gpt-4o";
    }
  }

  async calculateProgress(messages: AIMessage[], stageGoals: string[]): Promise<number> {
    const progressPrompt = `
Based on the conversation history and stage goals, calculate completion percentage (0-100).

Stage Goals:
${stageGoals.join('\n')}

Conversation:
${messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

Respond with JSON: {"progress": number, "reasoning": "explanation"}
    `;

    try {
      const result = await this.generateStructuredOutput([
        { role: "system", content: "You are a progress assessment expert." },
        { role: "user", content: progressPrompt }
      ]);
      
      return Math.min(100, Math.max(0, result.progress || 0));
    } catch (error) {
      // Fallback: estimate based on message count and content length
      const meaningfulMessages = messages.filter(m => m.role === "user" && m.content.length > 20);
      return Math.min(75, meaningfulMessages.length * 15);
    }
  }
}

export const aiService = new AIService();
