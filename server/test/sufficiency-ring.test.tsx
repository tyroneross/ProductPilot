/**
 * SufficiencyRing — the Face-ID enrollment meter for discovery intake.
 *
 * Asserts the ring renders one arc per section with the right per-state color
 * binding, shows the covered count while collecting, and flips to the closed
 * green "done" state (check, no count) once `enough`.
 */

import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SufficiencyRing from "../../client/src/components/sufficiency-ring";
import { SECTIONS, type IntakeSufficiency } from "../../shared/intake-sections";

afterEach(() => cleanup());

function sections(states: IntakeSufficiency["sections"][number]["state"][]): IntakeSufficiency["sections"] {
  return SECTIONS.map((s, i) => ({ key: s.key, label: s.short, state: states[i] ?? "open" }));
}

describe("SufficiencyRing", () => {
  it("renders one arc per section with its state", () => {
    const secs = sections(["covered", "covered", "inferred", "open", "open", "open"]);
    const { container } = render(<SufficiencyRing sections={secs} enough={false} />);
    const arcs = container.querySelectorAll("circle[data-section]");
    expect(arcs).toHaveLength(SECTIONS.length);
    expect(container.querySelector('circle[data-section="brief"]')?.getAttribute("data-state")).toBe("covered");
    expect(container.querySelector('circle[data-section="architecture"]')?.getAttribute("data-state")).toBe("open");
  });

  it("shows the covered count while collecting", () => {
    const secs = sections(["covered", "covered", "open", "open", "open", "open"]);
    render(<SufficiencyRing sections={secs} enough={false} />);
    expect(screen.getByTestId("sufficiency-ring").getAttribute("data-enough")).toBe("false");
    expect(screen.getByTestId("sufficiency-count").textContent).toContain("2");
  });

  it("closes to the green check (no count) when enough", () => {
    const secs = sections(["covered", "covered", "covered", "inferred", "inferred", "inferred"]);
    render(<SufficiencyRing sections={secs} enough />);
    expect(screen.getByTestId("sufficiency-ring").getAttribute("data-enough")).toBe("true");
    expect(screen.queryByTestId("sufficiency-count")).toBeNull();
  });
});
