// UI/UX Preference catalog + types + preset-derived defaults.
// Consumed by the focused /preferences wizard and the silent preset-seeding
// path in /style. Output is a DesignProfile that gets passed to
// buildPromptPack() (shared/prompt-pack.ts) and merged into projects.appStyle.

export type Platform = "ios";

export type ProfileSource = "focused" | "preset-derived";

export interface QuestionState {
  selectedIds: string[];
  ranked: boolean;
  rankOrder: string[];
  context: Record<string, string>;
  notes: string;
}

export interface DesignProfile {
  source: ProfileSource;
  presetId: string;
  platform: Platform;
  categories: Record<string, QuestionState>;
  updatedAt: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  desc: string;
  specLines: string[];
  whenToUse: string;
  previewId: string;
}

export interface Category {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  options: CategoryOption[];
  allowMulti: boolean;
}

export const EMPTY_QUESTION_STATE: QuestionState = {
  selectedIds: [],
  ranked: false,
  rankOrder: [],
  context: {},
  notes: "",
};

// ---------------------------------------------------------------------------
// V1 category catalog (7 iOS-focused categories)
// ---------------------------------------------------------------------------

export const CATEGORIES: Category[] = [
  {
    id: "navigation",
    title: "Navigation pattern",
    subtitle: "How users move between core sections",
    group: "Structure",
    allowMulti: true,
    options: [
      {
        id: "tab-bar",
        label: "Tab bar",
        desc: "Bottom-anchored persistent tabs for 3–5 destinations",
        specLines: [
          "Use a bottom tab bar with 3–5 primary destinations.",
          "Keep tab labels short (1 word) and icon + text together.",
          "Persist the tab bar across all top-level screens.",
        ],
        whenToUse: "Always for primary navigation",
        previewId: "nav-tab-bar",
      },
      {
        id: "stacked-large-title",
        label: "Stacked + large title",
        desc: "Push-based nav with large titles that collapse on scroll",
        specLines: [
          "Use stacked push navigation with large titles that collapse to compact on scroll.",
          "Back button uses previous screen title (iOS default).",
        ],
        whenToUse: "Content-forward screens, settings, detail views",
        previewId: "nav-large-title",
      },
      {
        id: "sidebar",
        label: "Sidebar",
        desc: "Persistent or swipe-revealed side menu",
        specLines: [
          "Prefer a sidebar on regular-width layouts (iPad).",
          "On compact widths, collapse to an icon button that reveals a modal drawer.",
        ],
        whenToUse: "Deep hierarchy, iPad / landscape",
        previewId: "nav-sidebar",
      },
    ],
  },
  {
    id: "color",
    title: "Color system",
    subtitle: "Palette character and contrast",
    group: "Look",
    allowMulti: true,
    options: [
      {
        id: "monochrome",
        label: "Monochrome",
        desc: "Neutral greys with one accent",
        specLines: [
          "Restrict the palette to neutral greys plus a single accent hue.",
          "Use the accent only for primary actions and active state.",
        ],
        whenToUse: "Always",
        previewId: "color-mono",
      },
      {
        id: "warm-neutral",
        label: "Warm neutral",
        desc: "Cream, sand, soft earth tones",
        specLines: [
          "Use warm off-white backgrounds (#faf7f5-range) with muted earth accents.",
          "Avoid pure blacks; prefer deep espresso (#292524) for text.",
        ],
        whenToUse: "Always",
        previewId: "color-warm",
      },
      {
        id: "vibrant",
        label: "Vibrant",
        desc: "Saturated gradients and accent colors",
        specLines: [
          "Use a saturated primary (violet / pink / orange) with gradient fills on CTAs.",
          "Pair with soft tinted backgrounds on feature cards.",
        ],
        whenToUse: "Key screens, empty-state illustrations",
        previewId: "color-vibrant",
      },
      {
        id: "high-contrast",
        label: "High contrast",
        desc: "Pure black on white, strong edges",
        specLines: [
          "Use pure #000 on pure #fff with 2px+ borders on interactive elements.",
          "Accent with one saturated highlight color (yellow or red).",
        ],
        whenToUse: "Always",
        previewId: "color-contrast",
      },
    ],
  },
  {
    id: "typography",
    title: "Typography scale",
    subtitle: "Font family and hierarchy character",
    group: "Look",
    allowMulti: true,
    options: [
      {
        id: "system",
        label: "System",
        desc: "SF Pro / system-ui, neutral and efficient",
        specLines: [
          "Use the platform system font (SF Pro on iOS).",
          "Default to -apple-system / system-ui stacks on web.",
          "Tight letter-spacing on headlines; default tracking elsewhere.",
        ],
        whenToUse: "Always",
        previewId: "type-system",
      },
      {
        id: "serif-editorial",
        label: "Serif editorial",
        desc: "Georgia / New York for headlines, grotesque body",
        specLines: [
          "Use a serif (Georgia, New York, or similar) for headlines and display text.",
          "Body copy stays in a clean sans for legibility.",
        ],
        whenToUse: "Article screens, marketing surfaces",
        previewId: "type-serif",
      },
      {
        id: "geometric",
        label: "Geometric sans",
        desc: "Sharp, even-width letterforms",
        specLines: [
          "Use a geometric sans (Inter, Manrope, Space Grotesk) with slightly tight tracking.",
          "Prefer medium weight for titles; regular for body.",
        ],
        whenToUse: "Always",
        previewId: "type-geometric",
      },
      {
        id: "rounded",
        label: "Rounded humanist",
        desc: "Friendly, soft terminals",
        specLines: [
          "Use a rounded sans (SF Rounded, Nunito) to reinforce a warm, approachable tone.",
        ],
        whenToUse: "Always",
        previewId: "type-rounded",
      },
    ],
  },
  {
    id: "motion",
    title: "Motion & transitions",
    subtitle: "Timing and character of animation",
    group: "Feel",
    allowMulti: true,
    options: [
      {
        id: "minimal",
        label: "Minimal",
        desc: "150–200ms ease-out, subtle cross-fades",
        specLines: [
          "Use 150–200ms ease-out transitions for most state changes.",
          "Avoid overshoot or bounce. Prefer simple opacity + translate cross-fades.",
        ],
        whenToUse: "Always",
        previewId: "motion-minimal",
      },
      {
        id: "spring",
        label: "Spring physics",
        desc: "Natural snap with light overshoot",
        specLines: [
          "Apply spring physics (stiffness ~300, damping ~28) to sheet presentation and drag interactions.",
          "Other transitions remain 200ms ease-out for consistency.",
        ],
        whenToUse: "Sheets, drag, pull-to-refresh",
        previewId: "motion-spring",
      },
      {
        id: "dramatic",
        label: "Dramatic",
        desc: "Long easings, scale transforms, parallax",
        specLines: [
          "Use 400–500ms eased transitions with scale or parallax on key transitions.",
          "Reserve dramatic motion for hero moments; keep routine transitions fast.",
        ],
        whenToUse: "Hero transitions only",
        previewId: "motion-dramatic",
      },
    ],
  },
  {
    id: "sheets",
    title: "Sheets & modals",
    subtitle: "How secondary flows appear",
    group: "Structure",
    allowMulti: true,
    options: [
      {
        id: "bottom-sheet",
        label: "Bottom sheet",
        desc: "Partial-height modal with drag handle",
        specLines: [
          "Present secondary flows as bottom sheets with detents (medium / large).",
          "Include a visible drag handle at the top.",
        ],
        whenToUse: "Short tasks, pickers",
        previewId: "sheet-bottom",
      },
      {
        id: "full-modal",
        label: "Full modal",
        desc: "Full-screen modal with explicit close",
        specLines: [
          "Present focused flows as full-screen modals with a Cancel action top-left and primary action top-right.",
        ],
        whenToUse: "Multi-step forms, composition",
        previewId: "sheet-full",
      },
      {
        id: "inline-expand",
        label: "Inline expand",
        desc: "Content expands in place, no overlay",
        specLines: [
          "Prefer inline expanding rows or disclosure cells for lightweight detail views.",
          "Avoid a modal if the interaction fits within the current screen's context.",
        ],
        whenToUse: "Lightweight detail, settings",
        previewId: "sheet-inline",
      },
    ],
  },
  {
    id: "loading-empty",
    title: "Loading & empty states",
    subtitle: "What the user sees during waits or zero-data",
    group: "Feel",
    allowMulti: true,
    options: [
      {
        id: "skeleton",
        label: "Skeleton",
        desc: "Greyed placeholder blocks matching final layout",
        specLines: [
          "Use skeleton placeholders that mirror the final layout shape.",
          "Pulse opacity 1s ease-in-out; never use spinners for anything over 300ms.",
        ],
        whenToUse: "Loads over 300ms",
        previewId: "load-skeleton",
      },
      {
        id: "spinner",
        label: "Spinner",
        desc: "Indeterminate circular progress",
        specLines: [
          "Use a centered spinner only for short, indeterminate operations under 1 second.",
        ],
        whenToUse: "Short actions only",
        previewId: "load-spinner",
      },
      {
        id: "progressive",
        label: "Progressive",
        desc: "Content streams in as it becomes available",
        specLines: [
          "Render above-the-fold content first; defer below-fold blocks with their own local loaders.",
        ],
        whenToUse: "Long lists, feeds",
        previewId: "load-progressive",
      },
      {
        id: "illustrated-empty",
        label: "Illustrated empty",
        desc: "Friendly illustration + primary CTA on empty state",
        specLines: [
          "Empty states pair a light illustration, a single-sentence explanation, and a primary CTA.",
          "Never show a blank screen on zero-data.",
        ],
        whenToUse: "First-run, empty collections",
        previewId: "load-empty",
      },
    ],
  },
  {
    id: "gestures",
    title: "Gestures",
    subtitle: "Touch interactions beyond tap",
    group: "Feel",
    allowMulti: true,
    options: [
      {
        id: "tap-only",
        label: "Tap-only",
        desc: "All actions surfaced as visible buttons",
        specLines: [
          "All destructive and primary actions must be reachable by tap — never hidden behind a gesture.",
          "Avoid swipe-to-delete on high-stakes objects.",
        ],
        whenToUse: "Always",
        previewId: "gesture-tap",
      },
      {
        id: "swipe-rich",
        label: "Swipe-rich",
        desc: "Swipe-to-action on list rows, edge-swipe back",
        specLines: [
          "Use swipe-to-action on list rows for common secondary actions (archive, star).",
          "Support edge-swipe back on all pushed screens.",
        ],
        whenToUse: "List-heavy screens",
        previewId: "gesture-swipe",
      },
      {
        id: "long-press",
        label: "Long-press menus",
        desc: "Context menus via long-press",
        specLines: [
          "Use long-press to reveal a context menu with secondary actions.",
          "Preview the target with a subtle scale + haptic on press-begin.",
        ],
        whenToUse: "Collections, grids",
        previewId: "gesture-long",
      },
    ],
  },
];

export const CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id);

// ---------------------------------------------------------------------------
// Preset-derived defaults
// Each of the 10 style presets (plus "custom") maps to a starter
// DesignProfile used silently in the regular flow. User sees no new UI.
// ---------------------------------------------------------------------------

type PresetCategoryMap = Record<string, Partial<QuestionState>>;

const PRESET_SEEDS: Record<string, PresetCategoryMap> = {
  "clean-minimal": {
    navigation: { selectedIds: ["stacked-large-title", "tab-bar"] },
    color: { selectedIds: ["monochrome"] },
    typography: { selectedIds: ["system", "geometric"] },
    motion: { selectedIds: ["minimal"] },
    sheets: { selectedIds: ["bottom-sheet"] },
    "loading-empty": { selectedIds: ["skeleton", "illustrated-empty"] },
    gestures: { selectedIds: ["tap-only"] },
  },
  "soft-rounded": {
    navigation: { selectedIds: ["tab-bar"] },
    color: { selectedIds: ["warm-neutral"] },
    typography: { selectedIds: ["rounded"] },
    motion: { selectedIds: ["spring"] },
    sheets: { selectedIds: ["bottom-sheet"] },
    "loading-empty": { selectedIds: ["skeleton", "illustrated-empty"] },
    gestures: { selectedIds: ["tap-only"] },
  },
  "bold-editorial": {
    navigation: { selectedIds: ["stacked-large-title"] },
    color: { selectedIds: ["high-contrast"] },
    typography: { selectedIds: ["serif-editorial"] },
    motion: { selectedIds: ["minimal"] },
    sheets: { selectedIds: ["full-modal"] },
    "loading-empty": { selectedIds: ["progressive"] },
    gestures: { selectedIds: ["tap-only"] },
  },
  glassmorphic: {
    navigation: { selectedIds: ["tab-bar"] },
    color: { selectedIds: ["vibrant"] },
    typography: { selectedIds: ["geometric"] },
    motion: { selectedIds: ["dramatic", "spring"] },
    sheets: { selectedIds: ["bottom-sheet"] },
    "loading-empty": { selectedIds: ["skeleton"] },
    gestures: { selectedIds: ["swipe-rich"] },
  },
  neubrutalist: {
    navigation: { selectedIds: ["stacked-large-title"] },
    color: { selectedIds: ["high-contrast"] },
    typography: { selectedIds: ["geometric"] },
    motion: { selectedIds: ["minimal"] },
    sheets: { selectedIds: ["full-modal"] },
    "loading-empty": { selectedIds: ["illustrated-empty"] },
    gestures: { selectedIds: ["tap-only"] },
  },
  "dark-luxury": {
    navigation: { selectedIds: ["stacked-large-title"] },
    color: { selectedIds: ["monochrome", "high-contrast"] },
    typography: { selectedIds: ["serif-editorial", "geometric"] },
    motion: { selectedIds: ["dramatic"] },
    sheets: { selectedIds: ["full-modal"] },
    "loading-empty": { selectedIds: ["progressive"] },
    gestures: { selectedIds: ["tap-only"] },
  },
  "material-elevated": {
    navigation: { selectedIds: ["tab-bar", "sidebar"] },
    color: { selectedIds: ["vibrant"] },
    typography: { selectedIds: ["geometric"] },
    motion: { selectedIds: ["minimal"] },
    sheets: { selectedIds: ["bottom-sheet", "full-modal"] },
    "loading-empty": { selectedIds: ["skeleton", "illustrated-empty"] },
    gestures: { selectedIds: ["swipe-rich"] },
  },
  "vibrant-playful": {
    navigation: { selectedIds: ["tab-bar"] },
    color: { selectedIds: ["vibrant"] },
    typography: { selectedIds: ["rounded", "geometric"] },
    motion: { selectedIds: ["spring"] },
    sheets: { selectedIds: ["bottom-sheet"] },
    "loading-empty": { selectedIds: ["illustrated-empty"] },
    gestures: { selectedIds: ["tap-only", "long-press"] },
  },
  "organic-natural": {
    navigation: { selectedIds: ["stacked-large-title"] },
    color: { selectedIds: ["warm-neutral"] },
    typography: { selectedIds: ["serif-editorial", "rounded"] },
    motion: { selectedIds: ["minimal"] },
    sheets: { selectedIds: ["inline-expand", "bottom-sheet"] },
    "loading-empty": { selectedIds: ["illustrated-empty"] },
    gestures: { selectedIds: ["tap-only"] },
  },
  "retro-nostalgic": {
    navigation: { selectedIds: ["tab-bar"] },
    color: { selectedIds: ["vibrant"] },
    typography: { selectedIds: ["geometric"] },
    motion: { selectedIds: ["dramatic"] },
    sheets: { selectedIds: ["bottom-sheet"] },
    "loading-empty": { selectedIds: ["illustrated-empty"] },
    gestures: { selectedIds: ["long-press"] },
  },
  custom: {
    // Custom style gets no preset seed — user-defined style may not map to
    // any canonical preference set. The focused flow is recommended.
  },
};

export function buildEmptyProfile(presetId: string): DesignProfile {
  const categories: Record<string, QuestionState> = {};
  for (const cat of CATEGORIES) {
    categories[cat.id] = { ...EMPTY_QUESTION_STATE, context: {} };
  }
  return {
    source: "preset-derived",
    presetId,
    platform: "ios",
    categories,
    updatedAt: new Date().toISOString(),
  };
}

export function deriveFromPreset(presetId: string): DesignProfile {
  const profile = buildEmptyProfile(presetId);
  const seed = PRESET_SEEDS[presetId];
  if (!seed) return profile;
  for (const [categoryId, partial] of Object.entries(seed)) {
    profile.categories[categoryId] = {
      ...profile.categories[categoryId],
      ...partial,
      context: { ...profile.categories[categoryId].context, ...(partial.context ?? {}) },
    };
  }
  return profile;
}

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getOption(categoryId: string, optionId: string): CategoryOption | undefined {
  return getCategory(categoryId)?.options.find((o) => o.id === optionId);
}

export function categoriesWithMultiPicks(profile: DesignProfile): string[] {
  return Object.entries(profile.categories)
    .filter(([, state]) => state.selectedIds.length >= 2)
    .map(([id]) => id);
}
