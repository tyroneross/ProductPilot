#!/usr/bin/env node
/**
 * Deterministic design-token check for the Warm Craft palette.
 *
 * Exists because three different error reds reached production without anyone
 * noticing — each looked correct in the file it lived in. A reviewer cannot see
 * palette drift by reading one page at a time; a script can see it instantly.
 *
 * Checks:
 *   1. off-palette hex values in client/src/pages and components
 *   2. more than one hex per semantic meaning (the drift that actually happened)
 *   3. interactive elements below the 44px touch floor
 *
 * Run: node scripts/check-design-tokens.mjs   (exit 1 on violations)
 * Pass --json for machine-readable output.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["client/src/pages", "client/src/components"];

// The sanctioned palette. Keep in sync with client/src/lib/theme.ts.
const PALETTE = new Set([
  "#110f0d", "#1a1714", "#231f1b",
  "#f5f0eb", "#a89a8c", "#6b5d52",
  "#f0b65e", "#d4a04e", "#1a1410",
  "#e07070", "#e0a458", "#7fb069",
  "#3d3228", "#c8b4a0", "#1a1208",
  // Sequential scale for graded values (confidence / validity). Deliberately
  // distinct from status: "low confidence" is not an error.
  "#9bd06f", "#f0a06e",
]);

// Files allowed to carry off-palette hex, with the reason. Anything not listed
// here must use a token.
const ALLOWLIST = new Map([
  // The visual-direction swatches ARE arbitrary colours by definition — they
  // preview what the user's generated app could look like, not our chrome.
  ["client/src/pages/details.tsx", "style-direction gradient swatches"],
]);

/**
 * Classify a hex as a "danger red" by its actual channels, not by string shape.
 *
 * A prefix regex flagged #e8e6e2 (a near-white grey) and #ea4335 (Google's
 * brand red on the sign-in button) as duplicate error colours. A checker that
 * cries wolf gets switched off, so this compares channels: red must clearly
 * dominate both other channels, and the colour must not be near-grey.
 */
function isDangerRed(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dominant = r - Math.max(g, b);
  return r > 120 && dominant > 40 && Math.abs(g - b) < 60;
}

// Third-party brand colours we do not control. Not palette drift.
// The sequential scale is reddish at its low end by design — "low confidence"
// must not be reported as a duplicate error colour.
const SCALE_EXEMPT = new Set(["#f0a06e", "#f0b65e", "#9bd06f"]);

const BRAND_EXEMPT = new Set([
  "#ea4335", // Google red — the Google sign-in button
  "#4285f4", // Google blue
  "#34a853", // Google green
  "#fbbc05", // Google yellow
]);

function walk(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const offPalette = [];
const smallTargets = [];
const dangerHexes = new Map();

for (const abs of files) {
  const rel = relative(ROOT, abs);
  const src = readFileSync(abs, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toLowerCase();
      if (!PALETTE.has(hex) && !ALLOWLIST.has(rel) && !BRAND_EXEMPT.has(hex)) {
        offPalette.push({ file: rel, line: i + 1, hex });
      }
      // Catch a SECOND danger colour appearing, classified by channels.
      if (isDangerRed(hex) && !BRAND_EXEMPT.has(hex) && !SCALE_EXEMPT.has(hex)) {
        if (!dangerHexes.has(hex)) dangerHexes.set(hex, []);
        dangerHexes.get(hex).push(rel);
      }
    }

    // Touch targets: only flag when an interactive element is nearby, and never
    // for icons rendered inside a button (width AND height both small).
    const sz = line.match(/(?:minHeight|height): *["']?(\d{2})(?:px)?["']?/);
    if (sz) {
      const px = Number(sz[1]);
      const ctx = lines.slice(Math.max(0, i - 8), i + 2).join("\n");
      const interactive = /<button|onClick=|role="button"|<Button/.test(ctx);
      const isIconGlyph = /width: *["']?\d{1,2}(px)?["']?,\s*height/.test(line) && px < 24;
      if (px < 44 && interactive && !isIconGlyph) {
        smallTargets.push({ file: rel, line: i + 1, px });
      }
    }
  });
}

const duplicateDanger = [...dangerHexes.entries()].filter(([h]) => h !== "#e07070");

const report = {
  offPalette,
  duplicateDanger: duplicateDanger.map(([hex, files]) => ({ hex, files: [...new Set(files)] })),
  smallTargets,
  ok: offPalette.length === 0 && duplicateDanger.length === 0 && smallTargets.length === 0,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  if (offPalette.length) {
    console.log(`\n✗ ${offPalette.length} off-palette hex value(s) — import from client/src/lib/theme.ts:`);
    for (const v of offPalette.slice(0, 20)) console.log(`   ${v.file}:${v.line}  ${v.hex}`);
    if (offPalette.length > 20) console.log(`   … and ${offPalette.length - 20} more`);
  }
  if (duplicateDanger.length) {
    console.log(`\n✗ more than one "danger" colour — there must be exactly one:`);
    for (const { hex, files } of report.duplicateDanger) console.log(`   ${hex} in ${files.join(", ")}`);
  }
  if (smallTargets.length) {
    console.log(`\n✗ ${smallTargets.length} interactive element(s) below the 44px touch floor:`);
    for (const v of smallTargets.slice(0, 20)) console.log(`   ${v.file}:${v.line}  ${v.px}px`);
    if (smallTargets.length > 20) console.log(`   … and ${smallTargets.length - 20} more`);
  }
  console.log(report.ok ? "\n✓ design tokens consistent\n" : "");
}

process.exit(report.ok ? 0 : 1);
