import { logger } from "../lib/logger";

type AuthEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export function canSendAuthEmail() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_FROM_EMAIL);
}

function shouldLogAuthEmailBody() {
  return process.env.NODE_ENV !== "production";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendAuthEmail(payload: AuthEmailPayload): Promise<void> {
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send auth email (${response.status}): ${body}`);
  }
}

function escapeAuthUrl(url: string) {
  return escapeHtml(url);
}

export async function sendPasswordResetEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeAuthUrl(input.url);
  const subject = "Reset your ProductPilot password";
  const text = `${greeting}

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
    text,
  });
}

export async function sendMagicLinkEmail(input: {
  email: string;
  url: string;
}): Promise<void> {
  const subject = "Sign in to ProductPilot";
  const safeUrl = escapeAuthUrl(input.url);
  const text = `Click this link to sign in to ProductPilot:\n\n${input.url}\n\nThe link expires in 15 minutes. If you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#1a1714">
      <h2 style="margin:0 0 16px;color:#110f0d">Sign in to ProductPilot</h2>
      <p style="margin:0 0 24px;color:#4a3f38;line-height:1.5">Click the button below to sign in. The link expires in 15 minutes.</p>
      <a href="${safeUrl}" style="display:inline-block;background:#f0b65e;color:#110f0d;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to ProductPilot</a>
      <p style="margin:24px 0 0;color:#6b5d52;font-size:13px">If you didn't request this, you can ignore this email.</p>
    </div>
  `;
  await sendAuthEmail({ to: input.email, subject, html, text });
}

export async function sendVerificationEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeAuthUrl(input.url);
  const subject = "Verify your ProductPilot email";
  const text = `${greeting}

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
    text,
  });
}
