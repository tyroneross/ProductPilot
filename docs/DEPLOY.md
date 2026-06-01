# Deploy — ProductPilot

## Production URL (canonical)

**https://productpilot-puce.vercel.app** ← this is prod. Public, no SSO.

⚠️ **`productpilot.vercel.app` is NOT this app.** The bare `<project>.vercel.app` subdomain is
squatted by an unrelated Spanish-language placeholder ("Tu Copiloto de IA"). Do not test or
link it. Vercel only auto-assigns the bare name when it's free; it wasn't, so our production
alias got a random suffix (`-puce`). **The prod URL is not derivable from the project name —
always look it up, never guess.**

Stable production aliases (all re-point to each new prod deploy):
- `productpilot-puce.vercel.app` — **public**, use this
- `productpilot-tyrone-ross-projects.vercel.app` — protected (Vercel SSO → 401 to curl)
- `productpilot-git-main-tyrone-ross-projects.vercel.app` — protected (401 to curl)

## How to find the prod URL authoritatively (when this file is missing/stale)

```bash
vercel ls productpilot --prod              # newest Ready prod deployment
vercel inspect <deployment-url> | grep -A6 Aliases   # the stable public alias(es)
```
`.vercel/project.json` holds only IDs (`projectId`/`orgId`/`projectName`) — **not the public URL.**

## Deploy

Git-integration: **push to `main` → Vercel auto-deploys production.** No CLI deploy needed.

```bash
git checkout main && git merge --ff-only <branch> && git push origin main
vercel ls productpilot --prod              # watch until ● Ready (~23s build)
```

## Post-deploy verification (against the public alias)

```bash
B=https://productpilot-puce.vercel.app
curl -s "$B" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.(js|css)'   # must match local dist/public/assets
curl -s -o /dev/null -w '%{http_code}\n' "$B/api/projects"        # 200
curl -s -o /dev/null -w '%{http_code}\n' "$B/api/auth/get-session" # 200 (better-auth endpoint is get-session, NOT session)
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/projects/x/spec/lint" # 401 (auth-gated)
```
Better-auth 404s any unrecognized `/api/auth/*` path by design — `/api/auth/session` and
`/api/me` 404 on purpose; that is not breakage.

## Rollback

```bash
vercel rollback <previous-prod-deployment-url>   # instant alias re-point
# or: git revert + push main
```

## Vercel build (vercel.json)

`buildCommand`: `npm run build && npm run build:api` — regenerates `api/index.mjs` from source
on every deploy, so the committed `api/index.mjs` can be stale without affecting prod.
`outputDirectory`: `dist/public`. Function `api/index.mjs` maxDuration 60s, region iad1.
