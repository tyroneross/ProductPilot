/**
 * Warm Craft design tokens — the single source for ProductPilot's palette.
 *
 * WHY THIS FILE EXISTS
 * Every page hard-coded its own hex values inline, bypassing the token system
 * in tailwind.config.ts entirely. The result was drift that only shows up when
 * you look across pages at once: THREE different error reds
 * (#e57373 in documents/projects, #e06356 in login/reset-password, #e07070 in
 * admin) and two different greens. Each looked fine in isolation; together they
 * read as three different products.
 *
 * Import from here rather than typing a hex. `npm run check:design` fails the
 * build on off-palette values so this cannot quietly drift again.
 */

export const warmCraft = {
  /** Page ground. */
  bg: "#110f0d",
  /** Raised panels and headers sitting on the ground. */
  bgRaised: "#1a1714",
  /** Deeper wells — inputs, code blocks, nested surfaces. */
  bgSunken: "#231f1b",
  /** Translucent surface for cards over the ground. */
  surface: "rgba(255,255,255,0.03)",
  /** The single border value. One border per group, dividers between members. */
  border: "rgba(200,180,160,0.08)",
  /** Stronger border for focus and selected states. */
  borderStrong: "rgba(240,182,94,0.32)",

  /** Primary reading text. */
  text: "#f5f0eb",
  /** Descriptions and labels — the second line of the hierarchy. */
  textSecondary: "#a89a8c",
  /** Metadata and hints — the third line. */
  textMuted: "#6b5d52",

  /** Amber accent. Actions, focus, emphasis. */
  accent: "#f0b65e",
  /** Pressed / hovered accent. */
  accentDeep: "#d4a04e",
  /** Text placed ON the accent — dark, for contrast. */
  onAccent: "#1a1410",
} as const;

/**
 * Semantic status colours.
 *
 * One value per meaning. Calm Precision renders status as TEXT COLOUR, never as
 * a background badge — a coloured box competes with content for attention while
 * carrying the same single bit of information.
 */
export const status = {
  /** Something failed and needs attention. */
  danger: "#e07070",
  /** Degraded, at risk, or approaching a limit. */
  warning: "#e0a458",
  /** Healthy, complete, attached. */
  success: "#7fb069",
  /** Neutral / inactive — same as muted text by design. */
  neutral: warmCraft.textMuted,
} as const;

/**
 * Minimum interactive sizes.
 *
 * 44px is the mobile touch-target floor. It applies to anything a finger
 * targets — buttons, inputs, icon buttons — not to icons rendered INSIDE a
 * button, and not to non-interactive decoration like loading skeletons.
 */
export const touch = {
  /** Primary action height. */
  primary: 48,
  /** Standard interactive minimum. */
  min: 44,
  /** Square icon button. */
  icon: 44,
} as const;

/**
 * Sequential scale for graded values — confidence, coverage, priority.
 *
 * Deliberately NOT the status colours. A "low confidence" reading is not an
 * error; collapsing it into danger-red would tell the user something is broken
 * when the system is merely less sure. These read as one ramp, so the eye
 * orders them without a legend.
 */
export const scale = {
  high: "#9bd06f",
  medium: "#f0b65e",
  low: "#f0a06e",
} as const;

export type WarmCraftToken = keyof typeof warmCraft;
export type StatusToken = keyof typeof status;
export type ScaleToken = keyof typeof scale;
