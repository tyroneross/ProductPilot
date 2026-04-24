# ProductPilot auth setup

As of 2026-04-24 the app supports 4 sign-in methods, all optional. Users can mix and match; same email = same account (Better Auth account linking with `allowDifferentEmails: false`).

| Method | Status | Provider vars needed |
|---|---|---|
| Email + password | ✅ always on | none for sign-in; `RESEND_API_KEY` + `AUTH_FROM_EMAIL` to send verification/reset email |
| Magic link | ✅ always on | `RESEND_API_KEY` + `AUTH_FROM_EMAIL` outside local development |
| Google OAuth | conditional | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| Reset password | ✅ always on | same as magic link |

`requireEmailVerification` is **false** — new sign-ups get a session immediately.

## Resend (email delivery) — 5 minutes

### 1. Create a Resend account
1. Sign up at https://resend.com (free tier: 3,000 emails/month, 100/day)
2. Skip the onboarding "Add Domain" for now — you can start with the sandbox `onboarding@resend.dev` sender

### 2. Get your API key
- Dashboard → API Keys → Create API Key
- Scope: "Sending access" + "Full access" (for the domain verify step)
- Copy the `re_...` token

### 3. Pick a sender address
- For testing: `onboarding@resend.dev` works immediately
- For production: add + verify your own domain (requires DNS TXT + MX records, takes ~5 min)

### 4. Set Vercel env vars
From repo root:
```bash
echo "re_YOUR_KEY_HERE" | vercel env add RESEND_API_KEY production
echo 'ProductPilot <onboarding@resend.dev>' | vercel env add AUTH_FROM_EMAIL production
```

Or via Vercel dashboard → Project → Settings → Environment Variables.

### 5. Redeploy
```bash
vercel --prod --force
```

After redeploy, verification emails + magic links + password-reset emails land in actual inboxes. In production, auth links are not logged when email delivery is missing; the email-dependent flow fails closed instead.

## Google OAuth — 5 minutes

1. https://console.cloud.google.com/apis/credentials → Create OAuth client ID → "Web application"
2. Authorized redirect URI: `https://productpilot-puce.vercel.app/api/auth/callback/google`
3. Copy the client ID + secret
4. Set Vercel env vars:
   ```bash
   echo "xxx.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID production
   echo "GOCSPX-xxx" | vercel env add GOOGLE_CLIENT_SECRET production
   ```
5. Redeploy.

## Already-signed-up users without verification

Because `requireEmailVerification` is false, existing users already have active accounts. To manually verify someone in the DB (e.g. for the dash plugin which may check `emailVerified`):

```sql
UPDATE "user" SET email_verified = true WHERE email = 'user@example.com';
```

## Account linking

If a user signs up with email+password first and later clicks "Sign in with Google" using the same email, Better Auth merges the two accounts. Different emails = linking blocked. This is controlled by `account.accountLinking` in `server/auth/index.ts`.

Better Auth's email/password provider ID is `credential`. Google-first users who later want an email/password credential should use the password-reset flow for the same email; a normal sign-up attempt with that email is treated as an existing user.

## Troubleshooting

**"I signed up but got no email."**
Without `RESEND_API_KEY`, auth emails only log to stdout in local development. Production refuses to log URLs or tokens; configure Resend and redeploy.

**"Magic link says expired."**
TTL is 15 min. Click fast, or request a new one.

**"Google sign-in fails on /login."**
`googleEnabled` in `server/auth/index.ts` returns false when either Google var is missing. Check `vercel env ls production` for both keys.
