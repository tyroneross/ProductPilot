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
