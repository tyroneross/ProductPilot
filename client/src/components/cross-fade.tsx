import * as React from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface CrossFadeProps {
  /**
   * Identity of the current content. When this changes, the outgoing children
   * fade out and the incoming children fade in. Use the same value you'd put
   * on a `key` prop — anything that uniquely identifies "what's currently
   * showing" (e.g. tab id, route id, stage id).
   */
  keyId: string | number;
  /**
   * Single transition half-life in ms. Default 150 — outgoing fades for
   * `duration` ms, then incoming fades in for `duration` ms (total ~2x).
   * Skipped entirely when prefers-reduced-motion is set.
   */
  duration?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * CrossFade — fade outgoing content out, then fade incoming content in,
 * keyed by `keyId`. No external deps. Falls back to instant swap when the
 * user prefers reduced motion.
 *
 * Implementation notes:
 *  - We track three pieces of state: the currently-displayed children, the
 *    currently-displayed keyId, and a phase ("idle" | "out" | "in").
 *  - On a new keyId, we kick off the "out" phase (opacity → 0). After
 *    `duration` ms, we swap the children to the new ones and enter "in"
 *    (opacity → 1). After another `duration` ms, we land back in "idle".
 *  - This is intentionally not a stacked-render strategy. Stacking would
 *    require both A and B mounted simultaneously, which doubles work for
 *    complex tab content (markdown renderers, scroll containers, mutation
 *    observers). Sequential fade keeps a single tree mounted.
 */
export function CrossFade({ keyId, duration = 150, children, className }: CrossFadeProps) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = React.useState<{ keyId: string | number; node: React.ReactNode }>(() => ({
    keyId,
    node: children,
  }));
  const [phase, setPhase] = React.useState<"idle" | "out" | "in">("idle");

  React.useEffect(() => {
    // Same identity — adopt the latest children silently (parent re-rendered
    // with fresh data for the same tab).
    if (keyId === shown.keyId) {
      setShown((s) => ({ ...s, node: children }));
      return;
    }

    // Reduced motion: snap.
    if (reducedMotion) {
      setShown({ keyId, node: children });
      setPhase("idle");
      return;
    }

    // Begin fade-out of the currently-shown content.
    setPhase("out");
    const outTimer = window.setTimeout(() => {
      // Swap to the new content while invisible.
      setShown({ keyId, node: children });
      setPhase("in");
      // Schedule fade-in completion.
      const inTimer = window.setTimeout(() => setPhase("idle"), duration);
      // Stash the in-phase timer on the closure so cleanup catches both.
      cleanupRef.current = () => window.clearTimeout(inTimer);
    }, duration);

    cleanupRef.current = () => window.clearTimeout(outTimer);
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId, reducedMotion]);

  const cleanupRef = React.useRef<(() => void) | null>(null);

  const opacity = phase === "out" ? 0 : 1;

  return (
    <div
      className={`transition-opacity ${className ?? ""}`}
      style={{ opacity, transitionDuration: `${duration}ms` }}
      data-cross-fade-phase={phase}
    >
      {shown.node}
    </div>
  );
}
