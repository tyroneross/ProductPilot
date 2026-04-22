import { logger } from "../lib/logger";

type AuthEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

function canSendWithResend() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_FROM_EMAIL);
}

export async function sendAuthEmail(payload: AuthEmailPayload): Promise<void> {
  if (!canSendWithResend()) {
    logger.info({ to: payload.to, subject: payload.subject, text: payload.text }, "[auth] Email provider not configured. Logging email instead.");
    return;
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

export async function sendPasswordResetEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const subject = "Reset your ProductPilot password";
  const text = `${greeting}

You (or someone with your email) requested a password reset. Click the link below to set a new password:
${input.url}

The link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;

  const html = `<p>${greeting}</p>
<p>You (or someone with your email) requested a password reset.</p>
<p><a href="${input.url}">Reset your password</a></p>
<p>If the button does not work, open this link:</p>
<p>${input.url}</p>
<p>The link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`;

  await sendAuthEmail({
    to: input.email,
    subject,
    html,
    text,
  });
}

export async function sendVerificationEmail(input: {
  email: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const subject = "Verify your ProductPilot email";
  const text = `${greeting}

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
    text,
  });
}
