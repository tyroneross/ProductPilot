/**
 * Phase 5 — HandoffCopyButton component test.
 *
 * Asserts:
 *   - Disabled when blocked=true (export gated by lint or PII or weights upstream).
 *   - Enabled when blocked=false; click fetches the handoff and writes to clipboard.
 *   - Server 409 surfaces an inline error via onError, no clipboard write.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { HandoffCopyButton } from "../../client/src/components/handoff-copy-button";

afterEach(() => cleanup());

function makeFetcher(response: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  return vi.fn(async () => {
    const ok = response.ok ?? true;
    const status = response.status ?? (ok ? 200 : 409);
    return {
      ok,
      status,
      headers: new Headers(),
      json: response.json ?? (async () => ({})),
      text: response.text ?? (async () => ""),
    } as unknown as Response;
  });
}

describe("HandoffCopyButton", () => {
  it("renders disabled with blocked=true and shows the blocked label", () => {
    const onCopied = vi.fn();
    render(
      <HandoffCopyButton
        projectId="p1"
        blocked={true}
        blockedReason="2 unwaived lint blockers"
        fetcher={makeFetcher({ ok: true })}
        writeClipboard={async () => {}}
        onCopied={onCopied}
      />,
    );
    const btn = screen.getByTestId("button-copy-handoff") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-label")).toContain("2 unwaived lint blockers");
    expect(btn.textContent).toContain("Handoff blocked");
  });

  it("renders enabled with blocked=false and copies the response body on click", async () => {
    const writeClipboard = vi.fn(async () => {});
    const onCopied = vi.fn();
    const handoffMd = "# Coding Agent Handoff — TestApp\n\n## Build objective\nDoes a thing.\n";
    const fetcher = makeFetcher({
      ok: true,
      status: 200,
      text: async () => handoffMd,
    });
    render(
      <HandoffCopyButton
        projectId="p1"
        blocked={false}
        fetcher={fetcher as any}
        writeClipboard={writeClipboard}
        onCopied={onCopied}
      />,
    );
    const btn = screen.getByTestId("button-copy-handoff") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(writeClipboard).toHaveBeenCalledTimes(1));
    expect(writeClipboard).toHaveBeenCalledWith(handoffMd);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/p1/handoff.md",
      expect.objectContaining({ method: "GET" }),
    );
    expect(onCopied).toHaveBeenCalledWith(handoffMd);
  });

  it("surfaces server 409 message via onError and does not write clipboard", async () => {
    const writeClipboard = vi.fn(async () => {});
    const onError = vi.fn();
    const fetcher = makeFetcher({
      ok: false,
      status: 409,
      json: async () => ({
        message: "Export blocked: 1 unwaived blocker remains.",
        code: "unwaived_blocker_present",
      }),
    });
    render(
      <HandoffCopyButton
        projectId="p1"
        blocked={false}
        fetcher={fetcher as any}
        writeClipboard={writeClipboard}
        onError={onError}
      />,
    );
    const btn = screen.getByTestId("button-copy-handoff") as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith("Export blocked: 1 unwaived blocker remains.");
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("disables itself while a copy is in-flight", async () => {
    type Resolver = (r: Response) => void;
    let resolveFetch: Resolver = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve as Resolver;
        }),
    );
    render(
      <HandoffCopyButton
        projectId="p1"
        blocked={false}
        fetcher={fetcher as any}
        writeClipboard={async () => {}}
      />,
    );
    const btn = screen.getByTestId("button-copy-handoff") as HTMLButtonElement;
    fireEvent.click(btn);
    // After click, the button is disabled until fetch resolves.
    await waitFor(() => expect(btn.disabled).toBe(true));
    // Resolve to let the promise complete.
    resolveFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => "",
      json: async () => ({}),
    } as unknown as Response);
    await waitFor(() => expect(btn.disabled).toBe(false));
  });
});
