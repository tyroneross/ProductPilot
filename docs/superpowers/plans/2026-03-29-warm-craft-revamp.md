# Warm Craft UI/UX Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ProductPilot's blue/cyan light-mode aesthetic with Warm Craft (dark earthy, amber/gold), and streamline the flow from 7 steps to 4.

**Architecture:** CSS variable overhaul (single source of truth in index.css), then 4 page rewrites following approved mockups in `mockups/revamp-01` through `revamp-04`. Token-only updates on remaining 4 pages. Delete 2 obsolete pages.

**Tech Stack:** React 18, Wouter, Tailwind CSS 3, Radix UI (shadcn), DM Sans + JetBrains Mono fonts.

**Design spec:** `docs/superpowers/specs/2026-03-29-warm-craft-ui-revamp-design.md`

**Mockup references:** `mockups/revamp-01-landing.html` through `mockups/revamp-04-documents.html`

---

### Task 1: CSS Token Overhaul

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Replace `:root` CSS variables with Warm Craft tokens**

Replace the entire `:root` block (lines 5-34) with:

```css
:root {
  --background: #110f0d;
  --foreground: #f5f0eb;
  --muted: #1a1714;
  --muted-foreground: #6b5d52;
  --popover: #1a1714;
  --popover-foreground: #f5f0eb;
  --card: #1a1714;
  --card-foreground: #f5f0eb;
  --border: rgba(200,180,160,0.08);
  --input: rgba(200,180,160,0.12);
  --primary: #f0b65e;
  --primary-foreground: #110f0d;
  --secondary: #231f1b;
  --secondary-foreground: #f5f0eb;
  --accent: #f0b65e;
  --accent-foreground: #110f0d;
  --destructive: #e06356;
  --destructive-foreground: #f5f0eb;
  --ring: #f0b65e;
  --radius: 0.5rem;

  /* Warm Craft Design Tokens */
  --contrast-high: #f5f0eb;
  --contrast-medium: #a89a8c;
  --contrast-low: #6b5d52;
  --surface-primary: #1a1714;
  --surface-secondary: #0d0b0a;
  --surface-tertiary: #231f1b;
  --success: #7bc67e;
}
```

- [ ] **Step 2: Remove `.dark` block entirely**

Delete lines 36-64 (the entire `.dark { ... }` block). Warm Craft is dark-only.

- [ ] **Step 3: Update component utility classes**

Replace `.btn-primary` styles (lines 78-85):
```css
.btn-primary {
  @apply px-3 py-1.5 min-h-[44px] min-w-[44px] font-medium rounded-md transition-colors;
  background: #f0b65e;
  color: #110f0d;
}

.btn-primary:hover {
  background: #d4a04e;
}
```

Replace `.btn-secondary` styles (lines 87-94):
```css
.btn-secondary {
  @apply font-medium transition-colors;
  color: #a89a8c;
}

.btn-secondary:hover {
  color: #f0b65e;
}
```

Replace `.text-contrast-*` and `.bg-surface-*` classes (lines 100-146) — remove all `.dark` prefixed versions, update base values:
```css
.text-contrast-high { color: #f5f0eb; }
.text-contrast-medium { color: #a89a8c; }
.text-contrast-low { color: #6b5d52; }
.bg-surface-primary { background-color: #1a1714; }
.bg-surface-secondary { background-color: #0d0b0a; }
.bg-surface-tertiary { background-color: #231f1b; }
```

- [ ] **Step 4: Update body font to DM Sans**

Replace the body font-family in `@layer base` (line 73):
```css
body {
  @apply font-sans antialiased bg-background text-foreground;
  font-family: 'DM Sans', system-ui, sans-serif;
}
```

- [ ] **Step 5: Add Google Fonts import**

Add at the very top of `index.css`, before `@tailwind base`:
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
```

- [ ] **Step 6: Update PageLoader in App.tsx for dark theme**

In `client/src/App.tsx`, update the PageLoader spinner colors:
```tsx
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#110f0d' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(200,180,160,0.08)', borderTopColor: '#f0b65e' }} />
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `cd ~/Desktop/git-folder/ProductPilot && npm run build`
Expected: Clean build, no errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/index.css client/src/App.tsx
git commit -m "chore: replace design tokens with Warm Craft palette

Dark-only. DM Sans + JetBrains Mono. Amber/gold accent.
Remove .dark class variants. Update btn-primary/secondary."
```

---

### Task 2: Router Cleanup — Remove Obsolete Routes and Pages

**Files:**
- Modify: `client/src/App.tsx`
- Delete: `client/src/pages/style-picker.tsx`
- Delete: `client/src/pages/session-sections.tsx`

- [ ] **Step 1: Remove imports and routes for deleted pages**

In `client/src/App.tsx`, remove these lines:

```tsx
// Remove these imports:
const StylePickerPage = lazy(() => import("@/pages/style-picker"));
const SessionSectionsPage = lazy(() => import("@/pages/session-sections"));

// Remove these routes from <Switch>:
<Route path="/style" component={StylePickerPage} />
<Route path="/session/sections" component={SessionSectionsPage} />
```

- [ ] **Step 2: Delete page files**

```bash
cd ~/Desktop/git-folder/ProductPilot
rm client/src/pages/style-picker.tsx
rm client/src/pages/session-sections.tsx
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build. No missing import errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove style-picker and session-sections pages

Routes /style and /session/sections removed.
Style picker merged into /details. Session sections redundant with /documents."
```

---

### Task 3: Rewrite Landing Page

**Files:**
- Modify: `client/src/pages/welcome.tsx`

**Reference:** `mockups/revamp-01-landing.html`

- [ ] **Step 1: Read the current welcome.tsx**

Read `client/src/pages/welcome.tsx` to understand current structure and imports.

- [ ] **Step 2: Read the mockup for exact design**

Read `mockups/revamp-01-landing.html` — extract exact CSS values, layout, copy text.

- [ ] **Step 3: Rewrite welcome.tsx**

Full rewrite. The page should have:
- Sticky nav: "ProductPilot" wordmark left (amber diamond mark via inline SVG or CSS), "Projects" + "Sign In" links right
- Hero (centered, min-h-[calc(100vh-56px)], flex items-center justify-center):
  - Amber pill badge: "AI-Powered Product Development"
  - H1: "From idea to implementation docs in minutes" — text-4xl font-bold, warm white, amber text-shadow
  - Subtitle: one sentence, text-secondary
  - CTA: "Start Building →" — amber bg, dark text, h-12, onClick navigates to `/details`
  - Sub-label: "No account required" in text-muted
- Subtle radial gradient bg
- No feature grid, no draft resume (moved to /projects)

Remove the `/api/user/draft` query — draft resume moves to Projects page.

Use `useLocation` from wouter for navigation. Use Tailwind classes that reference the CSS variables (e.g., `bg-background`, `text-foreground`). For Warm-Craft-specific values not in Tailwind config, use inline styles or arbitrary values (e.g., `text-[#f0b65e]`).

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/welcome.tsx
git commit -m "feat: rewrite landing page with Warm Craft hero

Minimal hero with amber CTA. Remove feature grid and draft resume.
Draft resume moves to /projects dashboard."
```

---

### Task 4: Rewrite Describe & Style Page (Merged)

**Files:**
- Modify: `client/src/pages/details.tsx`

**Reference:** `mockups/revamp-02-describe.html`

- [ ] **Step 1: Read current details.tsx and the mockup**

Read both files to understand current form fields and the target design.

- [ ] **Step 2: Rewrite details.tsx**

Merge style picker + details into one page:
- Nav (same sticky nav as landing)
- H2: "What are you building?"
- Large textarea (5 rows, 16px font, amber focus ring) for product description
- Style selector: horizontal scrollable row of 6 compact style cards (gradient swatches, 120×80px). Selected = amber border. Pre-select "Minimal".
- 3 required inputs: "What problem does this solve?", "Who are the primary users?", "What does v1 look like?"
- Collapsible "More details (optional)" section with 3 fields
- Sticky CTA bar: "Continue to Survey →" (disabled until filled) + "Build Docs Now →" secondary

Preserve existing mutation logic (`POST /api/projects`, `POST /api/projects/:id/generate-docs-from-minimum`). Move style selection from sessionStorage pattern (previously in style-picker.tsx) into this page's local state, still written to sessionStorage on continue.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/details.tsx
git commit -m "feat: merge style picker into details page

Single page: describe idea + pick style + core details.
Collapsible optional fields. Two CTAs: survey or immediate generation."
```

---

### Task 5: Rewrite Progressive Survey Page

**Files:**
- Modify: `client/src/pages/session-survey.tsx`

**Reference:** `mockups/revamp-03-survey.html`

- [ ] **Step 1: Read current session-survey.tsx and the mockup**

Read both. The current page is the largest file (~60KB). Understand: survey definition shape from API, mutation flows, generation logic.

- [ ] **Step 2: Rewrite session-survey.tsx as step wizard**

Major rewrite. New layout:
- Left sidebar (w-64, sticky, surface-elevated): survey groups as steps with completion states, progress bar
- Main content (flex-1, max-w-2xl): questions grouped 2-4 per screen
- Question types: multi-select chips (3-col grid), single-select radio cards, text inputs
- Bottom bar: Back/Next navigation
- Last step: "Review & Generate" with doc selection toggles

Preserve all existing API interactions:
- `POST /api/projects` (auto-create draft)
- `GET /api/projects/:id` + `GET /api/projects/:id/stages`
- `POST /api/projects/:id/generate-survey`
- `PATCH /api/projects/:id` (auto-save responses)
- `POST /api/projects/:id/submit-survey`
- `POST /api/projects/:id/generate-docs-from-survey`
- Polling for generation completion (use pollIntervalRef from Phase 1 fix)

Mobile: sidebar collapses to top progress dots + hamburger drawer.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/session-survey.tsx
git commit -m "feat: rewrite survey as step wizard with sidebar

Progressive groups, multi-select chips, radio cards.
Mobile: sidebar collapses to progress dots + drawer.
Preserves all existing API mutations and generation flow."
```

---

### Task 6: Rewrite Documents Page

**Files:**
- Modify: `client/src/pages/documents.tsx`

**Reference:** `mockups/revamp-04-documents.html`

- [ ] **Step 1: Read current documents.tsx and the mockup**

Read both files.

- [ ] **Step 2: Rewrite documents.tsx as flat list**

Replace card grid with flat list:
- Header: back breadcrumb, H1, stat line (monospace)
- Generation progress bar (if generating): thin amber bar + stage name
- Flat list (single border, divide-y): each row = icon + title + one-line description + "View" link
- Completed rows: 2px amber left-border. Pending: skeleton shimmer.
- Bottom: "Refine with AI" (amber outline) + "Export All" (text link)

Preserve existing query logic (`GET /api/projects/:id`, `GET /api/projects/:id/stages`) and generation mutation.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/documents.tsx
git commit -m "feat: rewrite documents page as minimal flat list

One line per doc. Amber left-border for completed.
Generation progress bar. No cards, no verbose metadata."
```

---

### Task 7: Token Updates — Remaining Pages

**Files:**
- Modify: `client/src/pages/document-view.tsx`
- Modify: `client/src/pages/stage.tsx`
- Modify: `client/src/pages/projects.tsx`
- Modify: `client/src/pages/admin.tsx`
- Modify: `client/src/components/chat-interface.tsx`
- Modify: `client/src/components/stage-card.tsx`

- [ ] **Step 1: Read each file and identify hardcoded colors**

Search for: hardcoded `hsl(`, `#3b82f6`, `#2563eb`, `blue-`, `cyan-`, `text-blue`, `bg-blue`, `border-blue`, `text-gray-900`, `bg-white`, `bg-gray-` in each file. Also check for any `className="dark"` or dark-mode conditionals.

- [ ] **Step 2: Update document-view.tsx**

- Add warm prose styles for markdown content: `prose-invert` with amber link color
- Update header buttons to amber accent
- Replace any hardcoded blue/gray colors

- [ ] **Step 3: Update stage.tsx**

- Sidebar: `bg-surface-tertiary` (was gray)
- Progress ring: amber stroke
- Chat area: warm background
- Back button: amber hover

- [ ] **Step 4: Update projects.tsx**

- Add draft resume logic (moved from landing page): query `/api/user/draft`, show "Continue Draft" card if exists
- Update stage flow visualization to amber accents
- Card hover borders to warm

- [ ] **Step 5: Update admin.tsx**

- Replace any remaining blue/indigo references with amber
- Update badge colors to warm palette

- [ ] **Step 6: Update chat-interface.tsx**

- User message bubble: warm surface
- AI message bubble: slightly different warm surface
- Send button: amber accent

- [ ] **Step 7: Update stage-card.tsx**

- Progress bar: amber fill
- Card borders: warm

- [ ] **Step 8: Verify build**

Run: `npm run build`

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/document-view.tsx client/src/pages/stage.tsx client/src/pages/projects.tsx client/src/pages/admin.tsx client/src/components/chat-interface.tsx client/src/components/stage-card.tsx
git commit -m "chore: apply Warm Craft tokens to remaining pages and components

document-view, stage, projects, admin, chat-interface, stage-card.
Replace blue/cyan/gray with amber/warm palette."
```

---

### Task 8: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, all chunks generated.

- [ ] **Step 2: Check for stale color references**

```bash
cd ~/Desktop/git-folder/ProductPilot
grep -r "hsl(207\|hsl(220\|#3b82f6\|#2563eb\|bg-blue\|text-blue\|border-blue" client/src/ --include="*.tsx" --include="*.ts" -l
```
Expected: No matches (all blue references replaced).

- [ ] **Step 3: Check for .dark class references**

```bash
grep -r "\.dark\b\|className.*dark" client/src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
```
Expected: No matches (dark-only, no toggle).

- [ ] **Step 4: Run NavGator scan**

```bash
cd ~/Desktop/git-folder/ProductPilot && navgator scan
```
Expected: No broken connections from deleted pages.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final Warm Craft cleanup — remove stale color refs"
```
