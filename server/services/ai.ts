import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { buildProgressAssessmentPrompt } from "../prompt-builders";
import { logger } from "../lib/logger";
import { Sentry } from "../lib/sentry";

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

// T2-4: classify LLM SDK errors into a small taxonomy the client can route
// to actionable copy. Returns { code, message, retryAfterSeconds? }. Both
// Anthropic and Groq SDKs throw errors with a numeric .status, sometimes a
// .headers map, and a .message that may or may not be machine-grep-friendly.
// We never lose the original message — it goes into `details`.
export type LlmErrorCode =
  | "rate_limit"
  | "invalid_key"
  | "billing_blocked"
  | "model_unavailable"
  | "provider_unavailable"
  | "timeout"
  | "context_too_large"
  | "unknown";

// Hard blocks are ACCOUNT states that retrying cannot clear — the org is
// switched off until a human changes a billing setting or a key. They are
// org-wide, so no in-app retry survives one. They exist here purely to be
// alerted on and explained honestly to the user.
const HARD_BLOCK_CODES: ReadonlySet<LlmErrorCode> = new Set<LlmErrorCode>([
  "billing_blocked",
  "invalid_key",
]);

// A MODEL state, not an account state — Groq retires models on a rolling basis
// (verified 2026-07-30: `mixtral-8x7b-32768` and `llama-3.1-70b-versatile` both
// return HTTP 400 `model_decommissioned`; an unknown id returns HTTP 404
// `model_not_found`). Unlike a hard block this IS recoverable inside the same
// account, by reissuing the request against a model that still exists.
const MODEL_FALLBACK_CODES: ReadonlySet<LlmErrorCode> = new Set<LlmErrorCode>([
  "model_unavailable",
]);

// Ordered fallback chain per tier. First entry that is not the failed model
// wins. Deliberately short: one hop, no cascading retries.
const GROQ_FALLBACK_CHAIN: Record<string, string[]> = {
  [GROQ_MODELS.reasoning]: [GROQ_MODELS.fast],
  [GROQ_MODELS.fast]: [GROQ_MODELS.reasoning],
  [GROQ_MODELS.safeguard]: [GROQ_MODELS.fast, GROQ_MODELS.reasoning],
};
// Used when the failed model is not in the chain at all (e.g. a stale id from
// a user's BYOK settings row, or a model we removed from GROQ_MODELS).
const GROQ_LAST_RESORT_MODEL = GROQ_MODELS.fast;

// Engagement record for the model fallback.
//
// `modelFallback.available` only ever proved the CONFIGURATION was present —
// keys set, kill switch off. It could report `true` for a path that had never
// executed even once, which is the same "assumed, not observed" trap that let
// a dormant failover ship earlier. These counters make the difference between
// "wired" and "exercised" visible in the deployed environment.
//
// Process-local by design: on serverless each instance reports its own view,
// so treat a non-zero count as proof the path RAN, never as a global total.
// Durable per-call history already lives in the `llm_calls` table.
let modelFallbackEngagements = 0;
let modelFallbackLastEngagedAt: string | null = null;

export function recordModelFallbackEngagement(now: Date): void {
  modelFallbackEngagements += 1;
  modelFallbackLastEngagedAt = now.toISOString();
}

export function getModelFallbackStats(): {
  engagements: number;
  lastEngagedAt: string | null;
} {
  return {
    engagements: modelFallbackEngagements,
    lastEngagedAt: modelFallbackLastEngagedAt,
  };
}

/** Test-only: reset the process-local counters between cases. */
export function __resetModelFallbackStats(): void {
  modelFallbackEngagements = 0;
  modelFallbackLastEngagedAt = null;
}

export interface ClassifiedLlmError {
  code: LlmErrorCode;
  message: string;
  retryAfterSeconds: number | null;
  details: string;
  status: number | null;
}

/**
 * Pull the provider's STRUCTURED error message and code out of an SDK error.
 *
 * Both SDKs stringify the upstream JSON body into `.message`, e.g.
 *   `400 {"error":{"message":"...","type":"...","code":"..."}}`
 * That body can also carry `failed_generation`, which echoes the user's own
 * prompt. Classifying against the raw string therefore lets user input drive
 * the classification. Returning only `error.message` and `error.code` keeps
 * echoed content out of every downstream regex.
 *
 * Falls back to the raw string when no JSON envelope is present, so plain
 * `Error("request timed out")` still classifies.
 */
function extractProviderError(
  rawMessage: string,
  topLevelCode: unknown,
): { message: string; code: string } {
  const codeFromError = typeof topLevelCode === "string" ? topLevelCode : "";
  const braceStart = rawMessage.indexOf("{");
  if (braceStart >= 0) {
    try {
      const parsed = JSON.parse(rawMessage.slice(braceStart)) as Record<string, any>;
      const errObj = (parsed?.error ?? parsed) as Record<string, any>;
      const message = typeof errObj?.message === "string" ? errObj.message : "";
      const code = typeof errObj?.code === "string" ? errObj.code : codeFromError;
      // Only trust the envelope when it actually yielded a message; a partial
      // or truncated body should not blank out the text we classify on.
      if (message) return { message, code };
      return { message: rawMessage, code };
    } catch {
      // Malformed / truncated JSON — fall through to the raw string.
    }
  }
  return { message: rawMessage, code: codeFromError };
}

/**
 * Safe user-facing message for a catch block that may or may not hold an LLM error.
 *
 * Outer route handlers catch everything — DB faults, validation, LLM SDK errors
 * that escaped an inner try. Interpolating `err.message` there leaks provider
 * JSON and stack detail to the browser. This returns the classified copy when
 * the error is a RECOGNIZED LLM failure, and a generic line otherwise, so a
 * non-LLM fault never gets mislabeled as a provider problem.
 */
export function toSafeUserMessage(
  err: unknown,
  provider: "anthropic" | "groq",
  fallback: string,
): { message: string; errorCode: LlmErrorCode | null; retryAfterSeconds: number | null } {
  const classified = classifyLlmError(err, provider);
  if (classified.code === "unknown") {
    return { message: fallback, errorCode: null, retryAfterSeconds: null };
  }
  return {
    message: classified.message,
    errorCode: classified.code,
    retryAfterSeconds: classified.retryAfterSeconds,
  };
}

export function classifyLlmError(err: unknown, provider: "anthropic" | "groq"): ClassifiedLlmError {
  const e = err as { status?: unknown; message?: unknown; headers?: Record<string, unknown> } | null | undefined;
  const status = typeof e?.status === "number" ? e.status : null;
  const rawMessage = typeof e?.message === "string" ? e.message : "";
  const lower = rawMessage.toLowerCase();

  // Retry-After can arrive as a header (string seconds, or HTTP date) or as a
  // top-level field; both Groq and Anthropic use seconds for rate-limit.
  let retryAfterSeconds: number | null = null;
  const retryRaw = (e?.headers?.["retry-after"] ?? e?.headers?.["Retry-After"]) as string | undefined;
  if (typeof retryRaw === "string") {
    const asInt = parseInt(retryRaw, 10);
    if (Number.isFinite(asInt)) retryAfterSeconds = asInt;
  }

  // Billing / spend block. Checked FIRST because it is the most specific and
  // most actionable state, and because retrying never clears it.
  //
  // Groq's published contract (console.groq.com/docs/spend-limits) is
  // HTTP 400 + code `blocked_api_access`, but production returns a `spend_*`
  // code with type `invalid_request_error` instead (verified by direct curl
  // during the 2026-07-29 outage). We match the documented code, the observed
  // code family, AND the message text so a third variant does not fall through
  // to the misleading generic branch. Anthropic's equivalent is a
  // credit-balance message with no code field at all.
  //
  // CRITICAL: match against the provider's STRUCTURED message/code, never the
  // raw blob. Groq returns a `failed_generation` field on json_validate_failed
  // and tool_use_failed errors that echoes the user's own prompt back. This
  // app's input is product briefs, so a user speccing a "billing dashboard" or
  // a "budget app with a spend limit" would otherwise have their own words
  // classified as an account block — and a context-length 400 for such a brief
  // would lose its correct `context_too_large` classification.
  const { message: providerMessage, code: providerCode } = extractProviderError(
    rawMessage,
    (e as { code?: unknown } | null | undefined)?.code,
  );

  // Codes that are definitively NOT billing, even if the surrounding text
  // (including echoed user input) mentions spend or billing.
  const NON_BILLING_CODES = new Set([
    "json_validate_failed",
    "tool_use_failed",
    "context_length_exceeded",
    "string_above_max_length",
    "insufficient_quota", // a quota/rate condition — clears without a billing change
  ]);

  const billingCodeHit =
    !NON_BILLING_CODES.has(providerCode) &&
    (providerCode === "blocked_api_access" ||
      providerCode.startsWith("spend_") ||
      providerCode === "billing_error");
  // Deliberately narrow: each phrase names an ACCOUNT STATE. A bare "billing"
  // or "budget" term is not enough — those appear constantly in user briefs.
  const billingTextHit =
    !NON_BILLING_CODES.has(providerCode) &&
    status !== 429 &&
    /blocked api access|has blocked api|spend (alert|limit)|spending limit|credit balance is too low|billing threshold/i.test(
      providerMessage,
    );
  if (billingCodeHit || billingTextHit) {
    const console_ =
      provider === "anthropic"
        ? "console.anthropic.com/settings/billing"
        : "console.groq.com/settings/billing";
    return {
      code: "billing_blocked",
      message:
        `Document generation is paused because the ${provider === "anthropic" ? "Anthropic" : "Groq"} account that powers it has hit its spending limit. ` +
        `This is not something retrying will fix. If this is your own API key, raise the limit at ${console_}; ` +
        `otherwise the ProductPilot team has been alerted and is restoring service.`,
      retryAfterSeconds: null,
      details: rawMessage,
      status,
    };
  }

  // Model retired or unknown. Checked before the generic 400/404 arms because
  // it is recoverable by switching models, and because it is the single most
  // likely scheduled breakage on a Groq-only deployment: models are retired on
  // a rolling basis and a pinned id stops working on a date we do not control.
  if (
    providerCode === "model_decommissioned" ||
    providerCode === "model_not_found" ||
    /has been decommissioned|does not exist or you do not have access/i.test(providerMessage)
  ) {
    return {
      code: "model_unavailable",
      message:
        "The model this request uses is no longer available from the provider. " +
        "We retried on a supported model automatically; if you are seeing this, that retry also failed.",
      retryAfterSeconds: null,
      details: rawMessage,
      status,
    };
  }

  // 401/403/key wording → invalid key. Never quote the key in the message.
  if (status === 401 || status === 403 || /invalid api key|authentication|unauthorized|no .* key/i.test(rawMessage)) {
    return {
      code: "invalid_key",
      message:
        provider === "anthropic"
          ? "Your Anthropic API key is missing or invalid. Update it in Settings, or remove your key to fall back to the platform default."
          : "Your Groq API key is missing or invalid. Update it in Settings, or remove your key to fall back to the platform default.",
      retryAfterSeconds: null,
      details: rawMessage,
      status,
    };
  }

  // 429 → rate limit. Surface retry-after when present.
  if (status === 429 || /rate limit|too many requests|quota/i.test(lower)) {
    const wait = retryAfterSeconds ? `Try again in ${retryAfterSeconds}s.` : "Try again in a minute.";
    return {
      code: "rate_limit",
      message: `${provider === "anthropic" ? "Anthropic" : "Groq"} is rate-limiting requests. ${wait}`,
      retryAfterSeconds,
      details: rawMessage,
      status,
    };
  }

  // Context length / token limit.
  if (status === 400 && /context|maximum.*token|prompt is too long|too many tokens/i.test(lower)) {
    return {
      code: "context_too_large",
      message: "Your request is larger than the model's context window. Try generating one document at a time, or shorten the survey responses.",
      retryAfterSeconds: null,
      details: rawMessage,
      status,
    };
  }

  // Timeout / abort.
  if (/timeout|timed out|aborted/i.test(lower)) {
    return {
      code: "timeout",
      message: `The ${provider === "anthropic" ? "Anthropic" : "Groq"} request timed out. The provider may be slow — try again.`,
      retryAfterSeconds: null,
      details: rawMessage,
      status,
    };
  }

  // 5xx or network — provider unavailable.
  if ((typeof status === "number" && status >= 500) || /ECONNREFUSED|ENOTFOUND|fetch failed|service unavailable|bad gateway/i.test(lower)) {
    return {
      code: "provider_unavailable",
      message: `${provider === "anthropic" ? "Anthropic" : "Groq"} is unavailable right now. Try again in a few minutes, or switch providers in Settings.`,
      retryAfterSeconds: null,
      details: rawMessage,
      status,
    };
  }

  return {
    code: "unknown",
    message:
      "The model couldn't finish your request. Try again — if it keeps failing, switch providers in Settings.",
    retryAfterSeconds: null,
    details: rawMessage,
    status,
  };
}

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
  /** Which provider actually served this response. */
  providerUsed?: LLMConfig['provider'];
  /** Which model actually served it — differs from the requested one after a fallback. */
  modelUsed?: string;
  /** True when the requested model was unavailable and a fallback model served this response. */
  failedOver?: boolean;
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

  /**
   * Decide whether a failed call should be retried on a DIFFERENT GROQ MODEL.
   *
   * This deployment is single-provider by choice. That makes an account-level
   * hard block (spend limit, revoked key) genuinely unrecoverable in code — it
   * is org-wide, so every model behind that key is off. Those are alerted on
   * and explained honestly instead of being retried.
   *
   * What IS recoverable is a MODEL-level failure. Groq retires models on a
   * rolling schedule, so any pinned id has an expiry date we do not control and
   * are not told about in advance. Reissuing against a model that still exists
   * turns a scheduled total outage into a logged quality downgrade.
   *
   * Returns the replacement config, or null to rethrow. Three conditions:
   *
   *  1. Not disabled by `LLM_MODEL_FALLBACK_DISABLED=1` (kill switch — force
   *     single-model behavior without a redeploy).
   *  2. The error is `model_unavailable`. Rate limits, 5xx, context overflows,
   *     and account blocks all resolve differently and must not land here.
   *  3. A fallback exists that is not the model which just failed.
   *
   * Applies to BYOK calls too, unlike the account-level case: switching models
   * inside the caller's own key spends only their credit, on the provider they
   * already chose, and the alternative is a hard failure they cannot act on.
   */
  private resolveModelFallback(config: LLMConfig, err: unknown): LLMConfig | null {
    if (process.env.LLM_MODEL_FALLBACK_DISABLED === '1') return null;
    if (config.provider !== 'groq') return null;

    const classified = classifyLlmError(err, 'groq');
    if (!MODEL_FALLBACK_CODES.has(classified.code)) return null;

    const failedModel = config.model ?? '';
    const candidates = GROQ_FALLBACK_CHAIN[failedModel] ?? [GROQ_LAST_RESORT_MODEL];
    const next = candidates.find((m) => m !== failedModel);
    if (!next) return null;

    return { ...config, model: next };
  }

  /**
   * Alert on a provider hard block.
   *
   * The 2026-07-29 outage was silent: `recordLlmCall` had been persisting the
   * status and error code to `llm_calls` the whole time, but the only consumer
   * was an admin page nobody was watching, so the first signal was a user
   * reporting a broken product. A hard block takes down every LLM feature at
   * once and cannot self-clear, which makes it the one class worth paging on.
   *
   * Fingerprinted by {provider, code} so a sustained outage is one alert, not
   * one per request. No-ops when SENTRY_DSN is unset, so this is inert until
   * the DSN is configured in the deployed environment.
   */
  private reportHardBlock(provider: string, classified: ClassifiedLlmError): void {
    if (!HARD_BLOCK_CODES.has(classified.code)) return;
    try {
      Sentry.captureMessage(`LLM hard block: ${provider} ${classified.code}`, {
        level: "fatal",
        fingerprint: ["llm-hard-block", provider, classified.code],
        tags: { provider, llm_error_code: classified.code },
        extra: { providerMessage: classified.details, status: classified.status },
      });
    } catch {
      // Never let telemetry failure mask the original provider error.
    }
    logger.error(
      { provider, code: classified.code, status: classified.status },
      "[llm-hard-block] every LLM feature is down until this is cleared",
    );
  }

  private dispatchChat(
    messages: AIMessage[],
    model: string,
    config: LLMConfig,
    task: LLMTask,
    context?: LLMCallContext,
  ): Promise<AIResponse> {
    switch (config.provider) {
      case 'groq':
        return this.chatWithGroq(messages, config.model || GROQ_MODELS.fast, config.apiKey, task, context);
      case 'anthropic':
        return this.chatWithClaude(messages, this.normalizeModel(model || config.model || 'claude-sonnet'), config.apiKey, task, context);
      default:
        return this.chatWithGroq(messages, GROQ_MODELS.fast, this.getDefaultConfig(task).apiKey, task, context);
    }
  }

  async chat(
    messages: AIMessage[],
    model: string = "claude-sonnet",
    userConfig?: LLMConfig | null,
    task: LLMTask = 'chat',
    context?: LLMCallContext,
  ): Promise<AIResponse> {
    const config = userConfig || this.getDefaultConfig(task);

    try {
      const response = await this.dispatchChat(messages, model, config, task, context);
      return { ...response, providerUsed: config.provider, modelUsed: config.model, failedOver: false };
    } catch (err) {
      if (config.provider === "groq" || config.provider === "anthropic") {
        this.reportHardBlock(config.provider, classifyLlmError(err, config.provider));
      }
      const fallback = this.resolveModelFallback(config, err);
      if (!fallback) throw err;

      recordModelFallbackEngagement(new Date());
      logger.warn(
        { from: config.model, to: fallback.model, task },
        "[llm-model-fallback] model unavailable — retrying on a supported model",
      );
      // Single attempt only. If the fallback also fails, its error propagates
      // and gets classified for the user like any other — no retry loop.
      // Pass the fallback's OWN model: dispatchChat resolves `model ||
      // config.model`, so handing it the caller's original model would discard
      // the substitution and reissue the same dead request.
      const response = await this.dispatchChat(messages, fallback.model!, fallback, task, context);
      return { ...response, providerUsed: fallback.provider, modelUsed: fallback.model, failedOver: true };
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

    // Retrying a stream is only safe BEFORE the first delta reaches the client
    // — once partial text is on screen, restarting on another model would
    // splice two different completions together. A model-unavailable error
    // throws at stream-open, so the pre-delta window is exactly where it lands.
    let emittedDelta = false;
    try {
      for await (const chunk of this.dispatchStream(messages, model, config, task, context)) {
        if (chunk.type === 'delta') emittedDelta = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (config.provider === "groq" || config.provider === "anthropic") {
        this.reportHardBlock(config.provider, classifyLlmError(err, config.provider));
      }
      if (emittedDelta) throw err;
      const fallback = this.resolveModelFallback(config, err);
      if (!fallback) throw err;

      recordModelFallbackEngagement(new Date());
      logger.warn(
        { from: config.model, to: fallback.model, task },
        "[llm-model-fallback] model unavailable at stream-open — retrying on a supported model",
      );
      // See chat() above — use the fallback's own model, not the caller's.
      yield* this.dispatchStream(messages, fallback.model!, fallback, task, context);
    }
  }

  private async *dispatchStream(
    messages: AIMessage[],
    model: string,
    config: LLMConfig,
    task: LLMTask,
    context?: LLMCallContext,
  ): AsyncGenerator<StreamChunk> {
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
      // Rethrow the ORIGINAL error. Wrapping it in a new Error() dropped
      // .status/.code/.headers, which made classifyLlmError blind: an
      // Anthropic credit block classified as `unknown` instead of
      // `billing_blocked`, and anthropic->groq failover could never fire.
      // streamClaude already rethrows raw; this matches it so the same fault
      // classifies identically on both paths.
      throw err;
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

    try {
      return await this.dispatchStructured(messages, model, config, task, context);
    } catch (err) {
      // The adaptive-intake and spec-linter entry point. It needs the same
      // model fallback chat() has, or a single retired model id takes the whole
      // intake surface down.
      if (config.provider === "groq" || config.provider === "anthropic") {
        this.reportHardBlock(config.provider, classifyLlmError(err, config.provider));
      }
      const fallback = this.resolveModelFallback(config, err);
      if (!fallback) throw err;

      recordModelFallbackEngagement(new Date());
      logger.warn(
        { from: config.model, to: fallback.model, task },
        "[llm-model-fallback] structured-output model unavailable — retrying on a supported model",
      );
      return await this.dispatchStructured(messages, fallback.model!, fallback, task, context);
    }
  }

  private async dispatchStructured(
    messages: AIMessage[],
    model: string,
    config: LLMConfig,
    task: LLMTask,
    context?: LLMCallContext,
  ): Promise<any> {
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
      // Rethrow the original — see chatWithClaude above. Wrapping destroyed
      // the SDK's .status/.code and broke billing classification.
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
