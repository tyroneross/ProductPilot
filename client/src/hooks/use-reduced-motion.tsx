import * as React from "react";

/**
 * useReducedMotion()
 *
 * Returns true when the user has expressed a preference for reduced motion via
 * the OS-level "Reduce motion" setting (System Settings -> Accessibility on
 * macOS / Settings -> Accessibility -> Motion on iOS / Settings -> Ease of
 * Access -> Display on Windows). The CSS in index.css already strips
 * non-essential transitions for the same preference; this hook is for
 * JS-driven motion that CSS can't reach (e.g. View Transitions API opt-in,
 * sliding-underline transform measurements where snapping is preferred to
 * animating).
 *
 * Returns false in SSR / pre-mount; updates if the user toggles the setting
 * while the page is open.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    onChange();
    // addEventListener is the modern API; Safari < 14 used addListener but
    // we target evergreen browsers and the project already relies on
    // matchMedia.addEventListener elsewhere (use-mobile.tsx).
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
