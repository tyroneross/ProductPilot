/**
 * Phase 4 — AdaptiveIntake terminal allocator step.
 *
 * Asserts:
 *   - Renders 6 sliders + 6 numeric inputs + 6 unacceptable-tradeoff radio chips.
 *   - Live total updates when a slider changes.
 *   - Submit is disabled while sum !== 100, enabled when sum === 100.
 *   - Submit hits /intake/finalize with the assembled tradeoffWeights body and
 *     calls onFinalize with the response.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdaptiveIntake, {
  type IntakeAction,
  TRADEOFF_AXES,
} from "../../client/src/components/adaptive-intake";

afterEach(() => cleanup());

function makeFetcher(responses: Record<string, unknown>) {
  return vi.fn(async (method: string, url: string, _body?: unknown) => {
    const key = `${method} ${url.replace(/^.*\/api/, "/api")}`;
    if (key in responses) return responses[key];
    throw new Error(`Unmocked: ${key}`);
  });
}

const ALLOCATE_ACTION: IntakeAction = {
  action: "allocate_tradeoffs",
  axes: TRADEOFF_AXES,
  reason: "No structural gaps remain — collect 100-point tradeoff allocation before finalizing.",
};

describe("AdaptiveIntake — TradeoffAllocator render + interaction", () => {
  it("renders 6 sliders, 6 numeric inputs, and 6 unacceptable-tradeoff chips", async () => {
    const fetcher = makeFetcher({
      "POST /api/projects/p1/intake/next": ALLOCATE_ACTION,
    });
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);
    await waitFor(() => screen.getByTestId("adaptive-intake-allocator"));

    for (const axis of TRADEOFF_AXES) {
      expect(screen.getByTestId(`adaptive-intake-allocator-row-${axis}`)).toBeTruthy();
      expect(screen.getByTestId(`adaptive-intake-allocator-slider-${axis}`)).toBeTruthy();
      expect(screen.getByTestId(`adaptive-intake-allocator-input-${axis}`)).toBeTruthy();
      expect(screen.getByTestId(`adaptive-intake-allocator-unacceptable-${axis}`)).toBeTruthy();
    }
  });

  it("displays the live total — initial split sums to exactly 100, badge shows the check mark", async () => {
    const fetcher = makeFetcher({
      "POST /api/projects/p1/intake/next": ALLOCATE_ACTION,
    });
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);
    await waitFor(() => screen.getByTestId("adaptive-intake-allocator-total"));

    const total = screen.getByTestId("adaptive-intake-allocator-total");
    // Initial allocation: 100 distributed across 6 axes (16+16+16+16+16+20 = 100).
    expect(total.textContent).toContain("100 / 100");
    expect(total.textContent).toContain("✓");
  });

  it("disables submit when sum !== 100, re-enables when restored to 100", async () => {
    const fetcher = makeFetcher({
      "POST /api/projects/p1/intake/next": ALLOCATE_ACTION,
    });
    render(<AdaptiveIntake projectId="p1" fetcher={fetcher as any} />);
    await waitFor(() => screen.getByTestId("adaptive-intake-allocator-submit"));

    const submit = screen.getByTestId("adaptive-intake-allocator-submit") as HTMLButtonElement;
    // Initial state — sum===100, button enabled.
    expect(submit.disabled).toBe(false);

    // Change one axis so sum != 100 (set speed_to_alpha to 0; original was 20 → sum becomes 80).
    const speedInput = screen.getByTestId("adaptive-intake-allocator-input-speed_to_alpha") as HTMLInputElement;
    fireEvent.change(speedInput, { target: { value: "0" } });
    await waitFor(() => {
      const totalDiv = screen.getByTestId("adaptive-intake-allocator-total");
      expect(totalDiv.textContent).toContain("80 / 100");
    });
    expect((screen.getByTestId("adaptive-intake-allocator-submit") as HTMLButtonElement).disabled).toBe(true);

    // Restore so sum===100 again.
    fireEvent.change(speedInput, { target: { value: "20" } });
    await waitFor(() => {
      const totalDiv = screen.getByTestId("adaptive-intake-allocator-total");
      expect(totalDiv.textContent).toContain("100 / 100");
    });
    expect((screen.getByTestId("adaptive-intake-allocator-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("submit posts tradeoffWeights to /intake/finalize and surfaces the result via onFinalize", async () => {
    const finalizeResponse = {
      spec: { id: "spec-p1", productName: "X", productDescription: "y" },
      renderedMarkdown: "# Brief\n\n…",
    };
    const responses: Record<string, unknown> = {
      "POST /api/projects/p1/intake/next": ALLOCATE_ACTION,
      "POST /api/projects/p1/intake/finalize": finalizeResponse,
    };
    const fetcher = makeFetcher(responses);
    const onFinalize = vi.fn();

    render(
      <AdaptiveIntake projectId="p1" fetcher={fetcher as any} onFinalize={onFinalize} />,
    );
    await waitFor(() => screen.getByTestId("adaptive-intake-allocator-submit"));

    // Pick "speed_to_alpha" as the unacceptable axis (default is the first axis = speed_to_alpha,
    // but we click again to assert the chip is interactive).
    const unacceptableChip = screen.getByTestId("adaptive-intake-allocator-unacceptable-cost");
    fireEvent.click(unacceptableChip);
    expect(unacceptableChip.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByTestId("adaptive-intake-allocator-submit"));

    await waitFor(() => expect(onFinalize).toHaveBeenCalledTimes(1));

    // Inspect the finalize call.
    const finalizeCall = (fetcher as any).mock.calls.find(
      (c: any[]) => typeof c[1] === "string" && c[1].includes("/intake/finalize"),
    );
    expect(finalizeCall).toBeDefined();
    const sentBody = finalizeCall[2] as { tradeoffWeights: Record<string, unknown> };
    expect(sentBody.tradeoffWeights.unacceptable_tradeoff).toBe("cost");
    // sum===100 invariant on the wire too.
    const sum =
      (sentBody.tradeoffWeights.speed_to_alpha as number) +
      (sentBody.tradeoffWeights.scalability as number) +
      (sentBody.tradeoffWeights.ux_polish as number) +
      (sentBody.tradeoffWeights.maintainability as number) +
      (sentBody.tradeoffWeights.cost as number) +
      (sentBody.tradeoffWeights.security as number);
    expect(sum).toBe(100);

    expect(onFinalize).toHaveBeenCalledWith(finalizeResponse);
  });
});
