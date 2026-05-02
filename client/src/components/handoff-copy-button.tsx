/**
 * HandoffCopyButton — Phase 5 (2026-05-02).
 *
 * Standalone button that fetches the project's coding-agent handoff via
 * GET /api/projects/:projectId/handoff.md and copies the response body to
 * the clipboard. Lives outside document-view.tsx so component tests can
 * exercise the copy + gating behavior without rendering the full page.
 *
 * Server returns 200 + text/markdown when all gates pass. Returns 409 with
 * {message, code} JSON when blocked. The button stays disabled when the
 * caller knows export is blocked (lint blockers, missing weights). Fetch
 * surfaces the server message inline via toast.
 *
 * Props are minimal so the page-level state and the test harness can both
 * drive it. The button is presentational; gating logic is the caller's.
 */

import { useState } from "react";
import { Code, Check } from "lucide-react";

export interface HandoffCopyButtonProps {
  projectId: string;
  /** True when the caller has determined export is blocked (e.g. lint failures). */
  blocked: boolean;
  /** Human-readable reason export is blocked — used for aria-label only. */
  blockedReason?: string;
  /**
   * Allows tests to inject a fake fetcher. Production passes `globalThis.fetch`.
   * The fetcher must accept a (path, init) pair and return a Response-like object.
   */
  fetcher?: typeof fetch;
  /**
   * Allows tests to inject a fake clipboard writer. Production passes
   * `navigator.clipboard.writeText`.
   */
  writeClipboard?: (text: string) => Promise<void>;
  /**
   * Toast handler — receives the server's failure message. Tests pass a spy.
   * Production wires this to the existing useToast() hook in the caller.
   */
  onError?: (message: string) => void;
  /** Called with the markdown body after successful copy. Tests assert on this. */
  onCopied?: (markdown: string) => void;
  /** Optional className passthrough. Defaults to inline header style. */
  className?: string;
}

/**
 * Default fetcher uses the global fetch. Defined outside the component so
 * the prop default reference is stable (avoids unnecessary re-renders).
 */
const defaultFetcher: typeof fetch = (...args) =>
  globalThis.fetch(...(args as Parameters<typeof fetch>));

const defaultWriteClipboard = async (text: string): Promise<void> => {
  // navigator.clipboard is undefined in jsdom by default; tests inject a
  // writer. Production browsers expose it.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard API unavailable");
};

export function HandoffCopyButton({
  projectId,
  blocked,
  blockedReason,
  fetcher = defaultFetcher,
  writeClipboard = defaultWriteClipboard,
  onError,
  onCopied,
  className,
}: HandoffCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const disabled = blocked || busy || !projectId;

  const handleClick = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const res = await fetcher(`/api/projects/${projectId}/handoff.md`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        let message = `Handoff request failed (${res.status}).`;
        try {
          const body = (await res.json()) as { message?: string; code?: string };
          if (body?.message) message = body.message;
        } catch {
          // server returned non-JSON; keep the status-based message
        }
        onError?.(message);
        return;
      }
      const markdown = await res.text();
      await writeClipboard(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopied?.(markdown);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Copy failed.";
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  const label = blocked
    ? blockedReason
      ? `Handoff blocked — ${blockedReason}`
      : "Handoff blocked"
    : busy
      ? "Preparing handoff…"
      : copied
        ? "Copied for Claude Code"
        : "Copy for Claude Code";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      data-testid="button-copy-handoff"
      data-blocked={blocked ? "true" : "false"}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        height: 30,
        border: "1px solid rgba(200,180,160,0.12)",
        borderRadius: 5,
        background: "transparent",
        color: disabled ? "#3d3228" : "#a89a8c",
        fontFamily: "inherit",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? <Check size={13} /> : <Code size={13} />}
      <span>
        {busy
          ? "Copying…"
          : copied
            ? "Copied"
            : blocked
              ? "Handoff blocked"
              : "Copy for Claude Code"}
      </span>
    </button>
  );
}

export default HandoffCopyButton;
