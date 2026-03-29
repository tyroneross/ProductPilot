# ProductPilot — Warm Craft UI/UX Revamp

## Purpose

ProductPilot is an AI tool that generates PRDs, wireframes, architecture docs, and coding prompts from a conversation. The current UI is functional but generic (blue/cyan Replit-origin aesthetic, 7-step flow, scattered navigation). This revamp:

1. **Streamlines** the flow from 7 steps to 4 (Landing → Describe+Style → Survey → Documents)
2. **Elevates** the aesthetic with Warm Craft design system (dark earthy tones, amber/gold accents)
3. **Simplifies** each page to reduce cognitive load per calm-precision principles

## Design Direction: Warm Craft

Dark-only. Warm, confident, artisanal. Approved mockups in `mockups/revamp-01` through `revamp-04`.

### Design Tokens

```css
--bg: #110f0d;
--surface-primary: #1a1714;
--surface-secondary: #0d0b0a;
--surface-elevated: #231f1b;
--border: rgba(200,180,160,0.08);
--border-hover: rgba(200,180,160,0.16);
--text-primary: #f5f0eb;
--text-secondary: #a89a8c;
--text-muted: #6b5d52;
--accent: #f0b65e;
--accent-hover: #d4a04e;
--accent-subtle: rgba(240,182,94,0.1);
--success: #7bc67e;
--destructive: #e06356;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
```

**Typography:** DM Sans (display + body), JetBrains Mono (code, metadata, stats).

**Dark-only:** Remove light mode CSS variables and `.dark` class toggles. Single theme.

---

## Pages

### 1. Landing (`/`)

**Reference:** `mockups/revamp-01-landing.html`

**Replaces:** Current welcome page (hero + 4-column feature grid + "Continue Draft").

**Layout:**
- Sticky nav: "ProductPilot" wordmark (amber diamond mark) left, "Projects" + "Sign In" right
- Hero centered in viewport (min-h-[calc(100vh-56px)], flex center):
  - Amber pill badge: "AI-Powered Product Development"
  - H1: "From idea to implementation docs in minutes" (clamp 28-44px, -0.03em tracking)
  - Subtitle: one sentence, text-secondary
  - CTA: "Start Building →" (amber bg, dark text, h-12)
  - Sub-label: "No account required" in text-muted
- Subtle radial gradient bg (amber at 4% opacity)
- No feature grid, no cards

**Navigation:** CTA → `/details` (merged describe+style page)

**Draft resume:** Moves to `/projects` page (not landing). Remove `/api/user/draft` call from landing.

### 2. Describe & Style (`/details`)

**Reference:** `mockups/revamp-02-describe.html`

**Replaces:** Style Picker (`/style`) + Details page (`/details`) — merged into one page.

**Layout** (max-w-2xl, centered, scrollable):
- Nav (same sticky nav)
- H2: "What are you building?"
- Large textarea (5 rows, 16px font, amber focus ring)
- **Style selector:** Horizontal scrollable row of 6 compact style cards (120×80px gradient swatches). Selected = amber border. Pre-select "Minimal".
- **Core details** (3 required inputs): "What problem does this solve?", "Who are the primary users?", "What does v1 look like?"
- **Optional details** (collapsible): Main features, Tech constraints, Inspiration link
- **Sticky CTA bar:** "Continue to Survey →" (disabled until description + 3 required fields filled). Secondary: "Build Docs Now →" (skip survey, generate immediately)

**Route:** `/style` removed. `/details` serves both functions.

**State:** Writes to sessionStorage: `productIdea` (textarea), `appStyle` (selected style), `minimumDetails` (3 required + optionals).

### 3. Progressive Survey (`/session/survey`)

**Reference:** `mockups/revamp-03-survey.html`

**Replaces:** Current session-survey page (single long form with all questions at once).

**Layout** (full viewport, sidebar + main):
- **Left sidebar** (w-64, sticky, surface-elevated):
  - Back arrow + "ProductPilot" mini wordmark
  - Product name (truncated)
  - Survey groups as steps (vertical list):
    - Concept → Audience → Platform & Tech → Features → Priorities → Review & Generate
  - Completed: amber checkmark. Active: amber dot + amber left-border. Locked: text-muted.
  - Bottom: progress bar "3 of 6" with amber fill
- **Main content** (flex-1, max-w-2xl centered, py-12):
  - Step label + H2 group title + description
  - Questions grouped 2-4 per screen:
    - Multi-select chips (3-col grid): selected = amber border + amber bg 8%
    - Single-select radio cards (vertical, full-width): selected = amber left-border + filled dot
    - Text inputs with helpers
  - **Power-user expansion:** "Show advanced options" toggle below questions (reveals deeper questions per group)
- **Bottom bar** (sticky, border-top): "Back" left, "Next: [Group] →" right (amber button)

**Mobile:** Sidebar collapses to top progress dots + hamburger drawer.

**Question source:** AI-generated `surveyDefinition` from `/api/projects/:id/generate-survey` (already exists). Groups are the `sections` from the survey definition.

**Generation trigger:** Last step "Review & Generate" shows doc selection toggles + "Generate Documents" CTA. Replaces the current complex dialog flow.

### 4. Documents (`/documents/:projectId`)

**Reference:** `mockups/revamp-04-documents.html`

**Replaces:** Current documents page (6 card grid with verbose metadata).

**Layout** (max-w-4xl centered):
- Nav + breadcrumb ("My Product" ← back)
- H1: "Your Documents"
- Stat line: "6 documents · Generated 2 min ago" (monospace, text-muted)
- **Generation progress** (if generating): thin amber bar + "Generating Architecture... (4 of 6)"
- **Flat list** (single border, divide-y between items):
  - Each row: icon + **Title** (text-sm, font-medium) + **one-line description** (text-sm, text-secondary) + "View" link (amber)
  - Completed: 2px amber left-border
  - Pending: skeleton shimmer on description, muted "View" link
- **Bottom:** "Refine with AI" (amber outline) + "Export All" (text link)

**"Refine with AI"** opens the stage chat page (`/stage/:stageId`) for the selected doc — this is the power-user path.

### 5. Document View (`/document/:projectId/:stageId`)

**Changes:** Apply Warm Craft tokens to existing page. Already has markdown rendering (ReactMarkdown). Add warm-tinted prose styles. No layout changes needed.

### 6. Stage Chat (`/stage/:stageId`)

**Changes:** Apply Warm Craft tokens. Sidebar gets surface-elevated bg. Chat bubbles get warm tinting. Progress ring gets amber accent. No layout changes — this is the power-user drill-down, accessed from Documents "Refine" action.

### 7. Projects Dashboard (`/projects`)

**Changes:** Apply Warm Craft tokens. Keep existing layout (project list + stage flow visualization). Add amber accents to progress indicators. Draft resume functionality moved here from landing page.

### 8. Admin Panel (`/admin`)

**Already redesigned** with calm-precision (commit DD5DAF2). Apply Warm Craft tokens on top — currently uses the old blue/gray palette.

---

## Pages Removed

| Page | Reason |
|------|--------|
| `/style` (Style Picker) | Merged into `/details` |
| `/session/sections` | Redundant with Documents + Stage Chat |
| `/intake` redirect | Dead code, already deleted |
| `/interview/:projectId` redirect | Dead code, already deleted |
| `/session/interview` redirect | Dead code, already deleted |

---

## Route Changes

| Before | After | Change |
|--------|-------|--------|
| `/` | `/` | Simplified hero, remove feature grid |
| `/style` → `/details` | `/details` | Merged into single page |
| `/session/survey` | `/session/survey` | Redesigned as step wizard |
| `/documents/:id` | `/documents/:id` | Flat list, less noise |
| `/document/:id/:sid` | `/document/:id/:sid` | Warm Craft tokens only |
| `/stage/:id` | `/stage/:id` | Warm Craft tokens only |
| `/projects` | `/projects` | Warm Craft tokens + draft resume |
| `/admin` | `/admin` | Warm Craft tokens on existing redesign |
| `/session/sections` | REMOVED | — |

---

## Implementation Scope

### Files to Modify

**CSS (theme overhaul):**
- `client/src/index.css` — Replace all CSS variables with Warm Craft tokens. Remove `.dark` class variants. Add DM Sans + JetBrains Mono imports.

**Pages (rewrite):**
- `client/src/pages/welcome.tsx` — Full rewrite (new hero layout)
- `client/src/pages/details.tsx` — Full rewrite (merged describe+style)
- `client/src/pages/session-survey.tsx` — Full rewrite (step wizard with sidebar)
- `client/src/pages/documents.tsx` — Full rewrite (flat list)

**Pages (token update only):**
- `client/src/pages/document-view.tsx` — Warm prose styles
- `client/src/pages/stage.tsx` — Warm tokens
- `client/src/pages/projects.tsx` — Warm tokens + draft resume
- `client/src/pages/admin.tsx` — Warm tokens

**Router:**
- `client/src/App.tsx` — Remove `/style` route, remove `/session/sections` route

**Components (token update):**
- `client/src/components/chat-interface.tsx` — Warm chat bubble colors
- `client/src/components/stage-card.tsx` — Warm card styling
- `client/src/components/insights-panel.tsx` — Warm sidebar

**Files to Delete:**
- `client/src/pages/style-picker.tsx`
- `client/src/pages/session-sections.tsx`

### Files NOT Modified
- `server/*` — No backend changes
- `shared/schema.ts` — No schema changes
- `client/src/components/ui/*` — Radix components inherit from CSS variables, no direct edits needed

---

## Verification

1. `npm run build` — clean build, no errors
2. Each mockup file in `mockups/revamp-*` should match its implemented page
3. All routes navigate correctly (no dead links)
4. Mobile responsive: test at 375px, 768px, 1024px widths
5. Run IBR audit when dev server available (needs DB)
6. Run NavGator scan to verify no broken connections
