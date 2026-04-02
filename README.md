# ProductPilot

AI-powered product development tool that generates PRDs, wireframes, architecture docs, and coding prompts through guided conversation.

## Stack

- **Frontend:** React 18, Vite 5, Wouter, Radix UI (shadcn), Tailwind CSS
- **Backend:** Express 4, Node.js
- **Database:** Neon PostgreSQL, Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/neon-js`), Google OAuth, email/password
- **AI:** Groq (Llama 3.3 70B free demo), Anthropic Claude, OpenAI (BYOK)

## Setup

### 1. Environment

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_URL=postgresql://...@ep-xxx.us-west-2.aws.neon.tech/neondb?sslmode=require
NEON_AUTH_URL=https://ep-xxx.neonauth...
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth...
GROQ_API_KEY=gsk_xxx
```

Get credentials from [Neon Console](https://console.neon.tech).

### 2. Google OAuth (optional)

1. Create OAuth 2.0 credentials at [Google Cloud Console](https://console.cloud.google.com)
2. Add Google as a social provider in Neon Dashboard > Authentication
3. Copy the redirect URI from Neon back to Google's authorized redirect URIs

### 3. Install & Run

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. Database migrations run automatically on startup.

### 4. Local HTTPS (optional, for auth cookies)

```bash
mkdir .certs
mkcert -install
mkcert -key-file .certs/localhost-key.pem -cert-file .certs/localhost.pem localhost
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (loads `.env.local`) |
| `npm run build` | Build for production |
| `npm run check` | TypeScript type check |
| `npm run db:push` | Push schema to database |

## Architecture

```
client/src/          React frontend
  pages/             Route pages (welcome, login, projects, stage, settings, admin)
  hooks/             useAuth, useRequireAuth, useToast
  lib/               Auth client, query client, utilities
  components/ui/     shadcn/Radix primitives

server/              Express backend
  auth/              JWT verification (jose + JWKS)
  services/          AI service (multi-provider routing)
  routes.ts          API endpoints
  db.ts              Neon PostgreSQL connection
  storage-hybrid.ts  DB storage with in-memory fallback

shared/              Shared between client and server
  schema.ts          Drizzle tables, Zod validators
  models/auth.ts     User and session tables
```

## Design

Warm Craft theme — dark earthy palette, amber/gold accents, DM Sans + JetBrains Mono.
