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
    console.info("[auth] Email provider not configured. Logging email instead.", {
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
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
