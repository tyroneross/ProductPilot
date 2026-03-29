# Neon Auth + Per-User LLM Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Replit OIDC with Neon Auth. Groq (Llama 3.3 70B) as free demo LLM for all users. BYOK (Bring Your Own Key) for signed-in users who want Anthropic, OpenAI, or their own Groq key.

**Architecture:** Neon Auth client SDK on frontend (`@neondatabase/neon-js/auth`), JWT verification via `jose` on Express backend. User LLM preferences stored in a `user_settings` table. AI service routes to Groq by default, user's provider+key if BYOK configured.

**Tech Stack:** `@neondatabase/neon-js` (auth client), `jose` (JWT verify), `groq-sdk` (demo LLM), Drizzle ORM (user_settings table), existing Express + React.

**Design spec:** `docs/superpowers/specs/2026-03-29-warm-craft-ui-revamp-design.md` (Warm Craft tokens)

---

### Task 1: Install Dependencies + Environment Setup

**Files:**
- Modify: `package.json`
- Create: `.env.example`

- [ ] **Step 1: Install Neon Auth + JWT packages**

```bash
cd ~/Desktop/git-folder/ProductPilot
npm install @neondatabase/neon-js jose groq-sdk
```

- [ ] **Step 2: Create .env.example with required variables**

Create `.env.example`:
```bash
# Database (Neon Postgres)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Neon Auth
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.us-east-2.aws.neon.build/neondb/auth
NEON_AUTH_URL=https://ep-xxx.neonauth.us-east-2.aws.neon.build/neondb/auth

# Demo LLM — Groq (Llama 3.3 70B) for all unauthenticated users
GROQ_API_KEY=gsk_xxx

# Optional: Anthropic key for admin/testing
ANTHROPIC_API_KEY=sk-ant-xxx
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add Neon Auth and jose dependencies

@neondatabase/neon-js for auth client SDK
jose for JWT verification on Express backend"
```

---

### Task 2: Database Schema — User Settings Table

**Files:**
- Modify: `shared/schema.ts`
- Create: `server/migrate-settings.ts` (or add to existing migrate.ts)

- [ ] **Step 1: Add user_settings table to schema.ts**

Add after the existing table definitions in `shared/schema.ts`:

```typescript
export const userSettings = pgTable("user_settings", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 255 }).notNull().unique(), // Neon Auth user ID (UUID)
  llmProvider: text("llm_provider").default("anthropic"), // anthropic, openai, etc.
  llmApiKey: text("llm_api_key"), // encrypted or plain (user's own key)
  llmModel: text("llm_model").default("claude-sonnet"), // preferred model
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  llmProvider: true,
  llmApiKey: true,
  llmModel: true,
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
```

- [ ] **Step 2: Add migration for user_settings table**

Add to `server/migrate.ts` (the existing migration runner):

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  llm_provider TEXT DEFAULT 'anthropic',
  llm_api_key TEXT,
  llm_model TEXT DEFAULT 'claude-sonnet',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts server/migrate.ts
git commit -m "feat: add user_settings table for per-user LLM config

Stores provider, API key, and model preference per Neon Auth user."
```

---

### Task 3: Server Auth Middleware — JWT Verification

**Files:**
- Create: `server/auth/neon-auth.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Create Neon Auth middleware**

Create `server/auth/neon-auth.ts`:

```typescript
import * as jose from 'jose';
import type { RequestHandler } from 'express';

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;

// Create JWKS client for token verification
const JWKS = NEON_AUTH_URL
  ? jose.createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`))
  : null;

/**
 * Auth middleware — extracts and verifies Neon Auth JWT.
 * Sets req.userId if valid. Does NOT block unauthenticated requests.
 */
export const extractUser: RequestHandler = async (req: any, _res, next) => {
  req.userId = null;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || !JWKS) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: NEON_AUTH_URL ? new URL(NEON_AUTH_URL).origin : undefined,
    });
    req.userId = payload.sub || null;
  } catch {
    // Invalid token — treat as unauthenticated
  }

  next();
};

/**
 * Strict auth — blocks unauthenticated requests with 401.
 */
export const requireAuth: RequestHandler = async (req: any, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};
```

- [ ] **Step 2: Wire into routes.ts**

In `server/routes.ts`:
- Import `extractUser` from `./auth/neon-auth`
- Apply `extractUser` as global middleware early in the chain (before routes)
- Replace the existing `authMiddleware` / `noAuth` pattern with `extractUser` (permissive) and `requireAuth` (strict) where needed
- Admin routes: use `requireAuth` + admin check
- Settings routes: use `requireAuth`
- Project/stage/message routes: use `extractUser` (permissive — demo users allowed)

- [ ] **Step 3: Remove Replit auth**

- Remove the `setupAuth` / `registerAuthRoutes` imports and calls
- Remove `isAuthenticated` middleware usage
- Keep `ADMIN_USERS` list but check against `req.userId`
- Delete `server/replit_integrations/` directory

- [ ] **Step 4: Commit**

```bash
git add server/auth/neon-auth.ts server/routes.ts
git rm -r server/replit_integrations/
git commit -m "feat: replace Replit OIDC with Neon Auth JWT verification

extractUser middleware sets req.userId from Bearer token.
requireAuth blocks unauthenticated requests.
Remove Replit OpenID Connect integration entirely."
```

---

### Task 4: Multi-Provider AI Service (Groq Default + BYOK)

**Files:**
- Modify: `server/services/ai.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Add Groq support to AI service**

Modify `server/services/ai.ts` to support multiple providers:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";

interface LLMConfig {
  provider: 'groq' | 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
}

export class AIService {
  // Default: Groq Llama 3.3 70B (demo)
  private getDefaultConfig(): LLMConfig {
    return {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY || '',
      model: 'llama-3.3-70b-versatile',
    };
  }

  async chat(messages: AIMessage[], model?: string, userConfig?: LLMConfig | null): Promise<AIResponse> {
    const config = userConfig || this.getDefaultConfig();

    switch (config.provider) {
      case 'groq':
        return this.chatWithGroq(messages, config.model || 'llama-3.3-70b-versatile', config.apiKey);
      case 'anthropic':
        return this.chatWithClaude(messages, this.normalizeModel(model || config.model || 'claude-sonnet'), config.apiKey);
      case 'openai':
        return this.chatWithOpenAI(messages, config.model || 'gpt-4o', config.apiKey);
      default:
        return this.chatWithGroq(messages, 'llama-3.3-70b-versatile', this.getDefaultConfig().apiKey);
    }
  }

  private async chatWithGroq(messages: AIMessage[], model: string, apiKey: string): Promise<AIResponse> {
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
      temperature: 0.7,
    });
    return { content: response.choices[0]?.message?.content || '' };
  }

  // Keep existing chatWithClaude, add chatWithOpenAI similarly
}
```

- [ ] **Step 2: Add settings lookup in routes**

In message-sending and doc-generation routes, look up user's LLM config:

```typescript
// Helper to get LLM config for request
async function getLLMConfig(req: any): Promise<LLMConfig | null> {
  if (!req.userId) return null; // Use demo (Groq)
  const settings = await storage.getUserSettings(req.userId);
  if (!settings?.llmApiKey) return null; // Use demo
  return {
    provider: settings.llmProvider as any,
    apiKey: settings.llmApiKey,
    model: settings.llmModel || undefined,
  };
}

// In the message endpoint:
const userConfig = await getLLMConfig(req);
const aiResponse = await aiService.chat(aiMessages, modelToUse, userConfig);
```

- [ ] **Step 3: Add storage methods for user settings**

In `server/storage-hybrid.ts`, add to the IStorage interface and both implementations:

```typescript
getUserSettings(userId: string): Promise<UserSettings | undefined>;
upsertUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings>;
```

- [ ] **Step 4: Commit**

```bash
git add server/services/ai.ts server/routes.ts server/storage-hybrid.ts
git commit -m "feat: per-user LLM routing with demo fallback

AI service accepts optional API key override.
Routes look up user settings, fall back to DEMO_ANTHROPIC_API_KEY.
Storage methods for user_settings CRUD."
```

---

### Task 5: Settings API Endpoints

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Add settings endpoints**

```typescript
// GET /api/settings — get current user's LLM settings
app.get("/api/settings", requireAuth, async (req: any, res) => {
  const settings = await storage.getUserSettings(req.userId);
  // Never expose the full API key — mask it
  if (settings?.llmApiKey) {
    settings.llmApiKey = settings.llmApiKey.slice(0, 7) + '...' + settings.llmApiKey.slice(-4);
  }
  res.json(settings || { llmProvider: 'anthropic', llmModel: 'claude-sonnet', llmApiKey: null });
});

// PUT /api/settings — update LLM settings
app.put("/api/settings", requireAuth, async (req: any, res) => {
  const { llmProvider, llmApiKey, llmModel } = req.body;
  const settings = await storage.upsertUserSettings(req.userId, {
    llmProvider, llmApiKey, llmModel
  });
  res.json({ message: 'Settings updated', provider: settings.llmProvider });
});

// DELETE /api/settings/key — remove custom API key (revert to demo)
app.delete("/api/settings/key", requireAuth, async (req: any, res) => {
  await storage.upsertUserSettings(req.userId, { llmApiKey: null });
  res.json({ message: 'API key removed. Using demo key.' });
});
```

- [ ] **Step 2: Commit**

```bash
git add server/routes.ts
git commit -m "feat: add settings API endpoints

GET/PUT /api/settings for per-user LLM config.
API keys are masked in GET responses.
DELETE /api/settings/key reverts to demo key."
```

---

### Task 6: Client Auth Setup

**Files:**
- Create: `client/src/lib/auth.ts`
- Modify: `client/src/hooks/use-auth.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create auth client**

Create `client/src/lib/auth.ts`:

```typescript
import { createAuthClient } from '@neondatabase/neon-js/auth';

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);
```

- [ ] **Step 2: Rewrite use-auth.ts hook**

Replace Replit auth hook with Neon Auth:

```typescript
import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUser(data?.user || null);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const signIn = (email: string, password: string) =>
    authClient.signIn.email({ email, password });

  const signUp = (email: string, password: string, name: string) =>
    authClient.signUp.email({ email, password, name });

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
  };

  // Get Bearer token for API calls
  const getToken = async (): Promise<string | null> => {
    const { data } = await authClient.getSession();
    return data?.session?.token || null;
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    getToken,
  };
}
```

- [ ] **Step 3: Update queryClient to include auth token**

In `client/src/lib/queryClient.ts`, update `apiRequest` to include Bearer token:

```typescript
// Add token parameter to apiRequest
export async function apiRequest(method: string, url: string, data?: any, token?: string | null) {
  const headers: Record<string, string> = {};
  if (data) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });
  // ... existing error handling
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/auth.ts client/src/hooks/use-auth.ts client/src/lib/queryClient.ts
git commit -m "feat: client-side Neon Auth integration

Auth client, useAuth hook with sign-in/up/out + token getter.
apiRequest includes Bearer token in headers."
```

---

### Task 7: Settings Page (Client)

**Files:**
- Create: `client/src/pages/settings.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create settings page**

Create `client/src/pages/settings.tsx` with Warm Craft styling:

Layout:
- Nav (same sticky nav as other pages)
- H1: "Settings" (text-2xl, font-bold)
- **Auth section**: If not signed in, show sign-in/sign-up form (Warm Craft styled). If signed in, show user info + sign out.
- **LLM Configuration section** (only when signed in):
  - Provider selector: dropdown (Anthropic, OpenAI)
  - Model selector: dropdown (claude-sonnet, claude-haiku, gpt-4o, etc.)
  - API Key input: password field with show/hide toggle
  - "Save Settings" button (amber, disabled until changes made)
  - "Remove Custom Key" link (reverts to demo)
  - Status line: "Using demo key" or "Using your Anthropic key (sk-ant...xxxx)"
- **Demo info** (always visible): "Demo mode uses a shared Claude API key with rate limits. Add your own key for unlimited usage."

- [ ] **Step 2: Add route to App.tsx**

Add lazy import and route:
```tsx
const SettingsPage = lazy(() => import("@/pages/settings"));
// In Switch:
<Route path="/settings" component={SettingsPage} />
```

- [ ] **Step 3: Add Settings link to nav**

Update the nav component (used across pages) to include "Settings" link next to "Projects" and "Sign In".

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/settings.tsx client/src/App.tsx
git commit -m "feat: add settings page for LLM configuration

Sign in/up with Neon Auth. Configure LLM provider + API key.
Demo mode for unauthenticated users."
```

---

### Task 8: Auth State in Landing + Admin Pages

**Files:**
- Modify: `client/src/pages/welcome.tsx`
- Modify: `client/src/pages/admin.tsx`

- [ ] **Step 1: Update landing page nav**

Replace "Sign In" text link with conditional:
- If authenticated: show user name + "Settings" link
- If not: show "Sign In" link → `/settings`

- [ ] **Step 2: Update admin page auth**

Replace the Replit auth check with Neon Auth:
- Use `useAuth()` hook
- Sign-in redirects to `/settings` instead of `/api/login`
- Admin check: compare `user.id` against `ADMIN_USERS` list (or use a `role` field from Neon Auth)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/welcome.tsx client/src/pages/admin.tsx
git commit -m "feat: integrate Neon Auth into landing and admin pages

Conditional nav (signed in vs anonymous).
Admin uses Neon Auth user ID for access control."
```

---

### Task 9: Final Verification

- [ ] **Step 1: Full build**

Run: `npm run build`

- [ ] **Step 2: Test demo mode** (no auth)

- Landing page loads
- Can create project, fill details, generate docs
- AI uses `DEMO_ANTHROPIC_API_KEY`

- [ ] **Step 3: Test auth flow** (requires Neon Auth URL)

- Sign up with email
- Sign in
- Settings page shows LLM config
- Set custom API key
- Generate docs — uses custom key

- [ ] **Step 4: Commit if cleanup needed**

---

## Environment Setup Checklist

Before running this plan, you need:
1. **Neon project** with Neon Auth enabled (Dashboard → Auth → Enable)
2. **Auth URL** from Neon Auth Configuration tab
3. **DATABASE_URL** from Neon connection settings
4. **Demo Anthropic API key** — the key for unauthenticated users (you said you'll provide)
5. Set all vars in `.env.local`

## Sources

- [Neon Auth Overview](https://neon.com/docs/auth/overview)
- [React Quick Start](https://neon.com/docs/auth/quick-start/react)
- [Custom Backend JWT Verification](https://neon.com/guides/react-neon-auth-hono)
- [@neondatabase/neon-js on npm](https://www.npmjs.com/package/@neondatabase/neon-js)
- [Groq Pricing](https://groq.com/pricing)
- [Anthropic OAuth Ban (Feb 2026)](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/)
- [LLM API Pricing Comparison 2026](https://www.tldl.io/resources/llm-api-pricing-2026)
