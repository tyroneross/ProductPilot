import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const SECRET_PREFIX = "enc:v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("DATA_ENCRYPTION_KEY or BETTER_AUTH_SECRET is required for secret encryption.");
  }

  return createHash("sha256").update(secret).digest();
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${SECRET_PREFIX}:`);
}

export function encryptSecret(value: string | null | undefined): string | null {
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

// ---------------------------------------------------------------------------
// Secret-scrub helpers (Phase 2 §"Security gates" — strip secret-shaped strings
// from productState before any provider call).
//
// We deliberately do NOT scrub on every shape that *could* be a secret — that
// degrades into false positives that strip user content. We scrub on:
//   1. The encrypted-secret marker `enc:v1:...` produced by encryptSecret.
//   2. Common API-key prefixes (Anthropic, OpenAI, Groq, GitHub, AWS).
//   3. `KEY_NAME=value` shapes where KEY_NAME contains "KEY", "TOKEN", "SECRET".
//
// Each replacement is a fixed sentinel — never the original char count — so the
// scrub itself does not encode the value via length.
//
// These patterns are conservative. We err on the side of scrubbing too eagerly
// inside productState (working memory) because that text flows to provider APIs.
// Phase 3 linter has its own redaction pass on user-visible output.
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp; replace: string }> = [
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
  { name: "kv-pair", regex: /[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*\S+/g, replace: "[REDACTED:kv-pair]" },
];

/**
 * Walk an arbitrary JSON-ish value and replace any secret-shaped string content
 * with a fixed sentinel. Returns a new object/array; does NOT mutate the input.
 *
 * Use this on productState before passing it to any provider API.
 *
 * Behavior:
 *   - Strings get scrubbed via SECRET_PATTERNS.
 *   - Numbers, booleans, nulls pass through unchanged.
 *   - Arrays and plain objects recurse.
 *   - Date/Map/Set/Buffer/etc. round-trip via JSON serialization (safe-ish for
 *     productState which is jsonb-backed; Phase 1 schema only stores JSON-safe
 *     types).
 */
export function scrubSecretsDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value) as unknown as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrubSecretsDeep(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubSecretsDeep(v);
  }
  return out as T;
}

export function scrubString(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern.regex, pattern.replace);
  }
  return out;
}

export function decryptSecret(value: string | null | undefined): string | null {
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
