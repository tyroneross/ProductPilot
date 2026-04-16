// CSS-only mini previews, one per CategoryOption.previewId.
// Same idiom as the MiniCleanMinimal etc. components in style-picker.tsx.

import type { JSX } from "react";

const frame: React.CSSProperties = {
  width: "100%",
  height: "100%",
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "system-ui, sans-serif",
  overflow: "hidden",
};

// ---------- Navigation ----------
const NavTabBar = () => (
  <div style={{ ...frame, background: "#fff" }}>
    <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6 }} />
    <div style={{ display: "flex", gap: 4, height: 22, borderTop: "1px solid #e5e7eb", paddingTop: 4 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? "#111" : "#d1d5db" }} />
          <div style={{ width: 14, height: 2, background: i === 0 ? "#111" : "#d1d5db", borderRadius: 1 }} />
        </div>
      ))}
    </div>
  </div>
);

const NavLargeTitle = () => (
  <div style={{ ...frame, background: "#fff" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <div style={{ height: 3, width: 16, background: "#3b82f6", borderRadius: 1 }} />
      <div style={{ height: 3, width: 10, background: "#d1d5db", borderRadius: 1 }} />
    </div>
    <div style={{ height: 10, width: "70%", background: "#111", borderRadius: 2 }} />
    <div style={{ height: 3, width: "50%", background: "#9ca3af", borderRadius: 1 }} />
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 4, width: `${80 - i * 10}%`, background: "#e5e7eb", borderRadius: 1 }} />
      ))}
    </div>
  </div>
);

const NavSidebar = () => (
  <div style={{ ...frame, background: "#fff", flexDirection: "row", padding: 8, gap: 6 }}>
    <div style={{ width: 34, background: "#1f2937", borderRadius: 4, padding: 4, display: "flex", flexDirection: "column", gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ height: 4, background: i === 0 ? "#fff" : "#4b5563", borderRadius: 1 }} />
      ))}
    </div>
    <div style={{ flex: 1, background: "#f9fafb", borderRadius: 4, padding: 6, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ height: 5, width: "60%", background: "#111", borderRadius: 1 }} />
      <div style={{ height: 3, width: "80%", background: "#d1d5db", borderRadius: 1 }} />
      <div style={{ height: 3, width: "70%", background: "#d1d5db", borderRadius: 1 }} />
    </div>
  </div>
);

// ---------- Color ----------
const ColorMono = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 5 }}>
      {["#111", "#6b7280", "#d1d5db", "#f3f4f6"].map((c, i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c }} />
      ))}
    </div>
    <div style={{ marginTop: 8, width: 30, height: 6, borderRadius: 3, background: "#3b82f6" }} />
  </div>
);

const ColorWarm = () => (
  <div style={{ ...frame, background: "#faf7f5", justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 5 }}>
      {["#292524", "#a78b72", "#d6c4ab", "#faf7f5"].map((c, i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: c === "#faf7f5" ? "1px solid #e5e7eb" : "none" }} />
      ))}
    </div>
  </div>
);

const ColorVibrant = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 5 }}>
      {["#8b5cf6", "#ec4899", "#f59e0b", "#10b981"].map((c, i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c }} />
      ))}
    </div>
    <div style={{ marginTop: 8, width: 40, height: 8, borderRadius: 4, background: "linear-gradient(90deg, #8b5cf6, #ec4899)" }} />
  </div>
);

const ColorContrast = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 5 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#000" }} />
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", border: "2px solid #000" }} />
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#facc15", border: "2px solid #000" }} />
    </div>
  </div>
);

// ---------- Typography ----------
const TypeBlock = (font: string, label: string) => () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", fontFamily: font, gap: 3 }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: "#111", lineHeight: 1 }}>Aa</div>
    <div style={{ fontSize: 9, color: "#6b7280" }}>{label}</div>
  </div>
);

const TypeSystem = TypeBlock("system-ui, -apple-system, sans-serif", "System");
const TypeSerif = TypeBlock("'Georgia', serif", "Serif");
const TypeGeometric = TypeBlock("'Inter', 'Helvetica Neue', sans-serif", "Geometric");
const TypeRounded = TypeBlock("'SF Pro Rounded', 'Nunito', sans-serif", "Rounded");

// ---------- Motion ----------
const MotionMinimal = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", gap: 6 }}>
    <div style={{ height: 3, width: 50, background: "#e5e7eb", borderRadius: 2, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "60%", background: "#111", borderRadius: 2, animation: "mini-fade 2s ease-out infinite" }} />
    </div>
    <div style={{ fontSize: 8, color: "#6b7280" }}>200ms ease-out</div>
    <style>{`@keyframes mini-fade { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
  </div>
);

const MotionSpring = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", gap: 6 }}>
    <div style={{ width: 20, height: 20, borderRadius: 6, background: "#111", animation: "mini-spring 1.8s cubic-bezier(0.2, 1.4, 0.3, 1) infinite" }} />
    <div style={{ fontSize: 8, color: "#6b7280" }}>Spring</div>
    <style>{`@keyframes mini-spring { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>
  </div>
);

const MotionDramatic = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", gap: 6 }}>
    <div style={{ width: 20, height: 20, borderRadius: 4, background: "linear-gradient(135deg,#8b5cf6,#ec4899)", animation: "mini-dramatic 2.4s ease-in-out infinite" }} />
    <div style={{ fontSize: 8, color: "#6b7280" }}>Dramatic</div>
    <style>{`@keyframes mini-dramatic { 0%,100%{transform:scale(1) rotate(0)} 50%{transform:scale(1.3) rotate(20deg)} }`}</style>
  </div>
);

// ---------- Sheets ----------
const SheetBottom = () => (
  <div style={{ ...frame, background: "#e5e7eb", padding: 6, gap: 2, justifyContent: "flex-end" }}>
    <div style={{ background: "#fff", borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 6, height: 50 }}>
      <div style={{ width: 20, height: 3, background: "#d1d5db", borderRadius: 2, margin: "0 auto 4px" }} />
      <div style={{ height: 4, width: "70%", background: "#111", borderRadius: 1, marginBottom: 3 }} />
      <div style={{ height: 3, width: "60%", background: "#d1d5db", borderRadius: 1 }} />
    </div>
  </div>
);

const SheetFull = () => (
  <div style={{ ...frame, background: "#e5e7eb", padding: 4, gap: 2 }}>
    <div style={{ background: "#fff", borderRadius: 6, flex: 1, padding: 6, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ height: 3, width: 14, background: "#6b7280", borderRadius: 1 }} />
        <div style={{ height: 3, width: 14, background: "#3b82f6", borderRadius: 1 }} />
      </div>
      <div style={{ height: 5, width: "60%", background: "#111", borderRadius: 1 }} />
      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 3 }} />
    </div>
  </div>
);

const SheetInline = () => (
  <div style={{ ...frame, background: "#fff", gap: 3 }}>
    <div style={{ padding: 4, background: "#f9fafb", borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ height: 3, width: 30, background: "#111", borderRadius: 1 }} />
      <div style={{ fontSize: 9, color: "#6b7280" }}>▾</div>
    </div>
    <div style={{ padding: 6, background: "#f3f4f6", borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ height: 3, width: "80%", background: "#6b7280", borderRadius: 1 }} />
      <div style={{ height: 3, width: "60%", background: "#9ca3af", borderRadius: 1 }} />
      <div style={{ height: 3, width: "70%", background: "#9ca3af", borderRadius: 1 }} />
    </div>
  </div>
);

// ---------- Loading / Empty ----------
const LoadSkeleton = () => (
  <div style={{ ...frame, background: "#fff", gap: 4 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, background: "#f3f4f6", animation: "mini-pulse 1.4s ease-in-out infinite" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ height: 3, width: `${60 + i * 10}%`, background: "#f3f4f6", borderRadius: 1, animation: "mini-pulse 1.4s ease-in-out infinite" }} />
          <div style={{ height: 3, width: `${40 + i * 5}%`, background: "#f3f4f6", borderRadius: 1, animation: "mini-pulse 1.4s ease-in-out infinite" }} />
        </div>
      </div>
    ))}
    <style>{`@keyframes mini-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
  </div>
);

const LoadSpinner = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center" }}>
    <div style={{ width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#111", borderRadius: "50%", animation: "mini-spin 0.9s linear infinite" }} />
    <style>{`@keyframes mini-spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

const LoadProgressive = () => (
  <div style={{ ...frame, background: "#fff", gap: 3 }}>
    <div style={{ height: 6, background: "#111", borderRadius: 1, width: "60%" }} />
    <div style={{ height: 3, background: "#e5e7eb", borderRadius: 1, width: "80%" }} />
    <div style={{ flex: 1, background: "#f9fafb", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 14, height: 14, border: "2px solid #e5e7eb", borderTopColor: "#6b7280", borderRadius: "50%", animation: "mini-spin 0.9s linear infinite" }} />
    </div>
  </div>
);

const LoadEmpty = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", gap: 4 }}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#dbeafe,#e0e7ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14 }}>✨</div>
    </div>
    <div style={{ height: 3, width: 40, background: "#6b7280", borderRadius: 1 }} />
    <div style={{ height: 10, width: 50, background: "#111", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ height: 2, width: 20, background: "#fff", borderRadius: 1 }} />
    </div>
  </div>
);

// ---------- Gestures ----------
const GestureTap = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", gap: 6 }}>
    <div style={{ position: "relative", width: 36, height: 36 }}>
      <div style={{ position: "absolute", inset: 0, border: "2px solid #111", borderRadius: 8 }} />
      <div style={{ position: "absolute", inset: 8, borderRadius: "50%", background: "#111", opacity: 0.1, animation: "mini-tap 1.4s ease-out infinite" }} />
    </div>
    <div style={{ fontSize: 8, color: "#6b7280" }}>Tap</div>
    <style>{`@keyframes mini-tap { 0%{transform:scale(.5);opacity:.6} 100%{transform:scale(1.8);opacity:0} }`}</style>
  </div>
);

const GestureSwipe = () => (
  <div style={{ ...frame, background: "#fff", gap: 3 }}>
    <div style={{ height: 12, background: "#f3f4f6", borderRadius: 3, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 20, background: "#ef4444", animation: "mini-swipe 2s ease-in-out infinite" }} />
    </div>
    <div style={{ height: 12, background: "#f3f4f6", borderRadius: 3 }} />
    <div style={{ height: 12, background: "#f3f4f6", borderRadius: 3 }} />
    <div style={{ fontSize: 8, color: "#6b7280", textAlign: "center" }}>Swipe →</div>
    <style>{`@keyframes mini-swipe { 0%,100%{transform:translateX(100%)} 50%{transform:translateX(0)} }`}</style>
  </div>
);

const GestureLong = () => (
  <div style={{ ...frame, background: "#fff", justifyContent: "center", alignItems: "center", gap: 4, position: "relative" }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#111", animation: "mini-long 2s ease-in-out infinite" }} />
    <div style={{ fontSize: 8, color: "#6b7280" }}>Long-press</div>
    <style>{`@keyframes mini-long { 0%,100%{transform:scale(1)} 40%,60%{transform:scale(1.08)} }`}</style>
  </div>
);

// ---------- Registry ----------
export const MINI_PREVIEWS: Record<string, () => JSX.Element> = {
  "nav-tab-bar": NavTabBar,
  "nav-large-title": NavLargeTitle,
  "nav-sidebar": NavSidebar,
  "color-mono": ColorMono,
  "color-warm": ColorWarm,
  "color-vibrant": ColorVibrant,
  "color-contrast": ColorContrast,
  "type-system": TypeSystem,
  "type-serif": TypeSerif,
  "type-geometric": TypeGeometric,
  "type-rounded": TypeRounded,
  "motion-minimal": MotionMinimal,
  "motion-spring": MotionSpring,
  "motion-dramatic": MotionDramatic,
  "sheet-bottom": SheetBottom,
  "sheet-full": SheetFull,
  "sheet-inline": SheetInline,
  "load-skeleton": LoadSkeleton,
  "load-spinner": LoadSpinner,
  "load-progressive": LoadProgressive,
  "load-empty": LoadEmpty,
  "gesture-tap": GestureTap,
  "gesture-swipe": GestureSwipe,
  "gesture-long": GestureLong,
};

export function MiniPreview({ id }: { id: string }) {
  const Component = MINI_PREVIEWS[id];
  if (!Component) {
    return <div style={{ width: "100%", height: "100%", background: "#f3f4f6" }} />;
  }
  return <Component />;
}
