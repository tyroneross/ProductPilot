/**
 * Persona-aware flow panel checks.
 *
 * Build-loop/IBR lens: the side panel should orient the user by showing which
 * product-spec surface the current question feeds. These cases cover the
 * different adaptive-intake flows a user persona panel needs to explain:
 * JTBD, QFD, Pugh, and agent-system intake.
 */

import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import IntakeProgressPane from "../../client/src/components/intake-progress-pane";

afterEach(() => cleanup());

describe("IntakeProgressPane — persona-aware flow routing", () => {
  it.each([
    {
      flow: "JTBD persona trigger",
      specPath: "personas[*].trigger",
      topic: "missing_persona_trigger",
      section: "North Star",
    },
    {
      flow: "QFD persona × need × feature weight",
      specPath: "features[*].acceptanceCriteria",
      topic: "qfd_feature_weight",
      section: "North Star",
    },
    {
      flow: "Pugh architecture decision",
      specPath: "adrs[*].cites",
      topic: "pending_architecture_decisions:2",
      section: "Architecture",
    },
    {
      flow: "Agent delivery scale",
      specPath: "agentSystem.builderScale",
      topic: "agent_delivery_scale",
      section: "Architecture",
    },
    {
      flow: "Agent UI and research protocol",
      specPath: "agentSystem.uiProtocol",
      topic: "agent_ui_research_protocol",
      section: "UX & Wireframes",
    },
    {
      flow: "Agent evaluation readiness",
      specPath: "agentSystem.evaluations",
      topic: "agent_evaluation_readiness",
      section: "Coding Prompts",
    },
  ])("maps $flow to $section", ({ specPath, topic, section }) => {
    render(
      <IntakeProgressPane
        intakeAnswers={[]}
        currentSpecPath={specPath}
        currentTopic={topic}
      />,
    );

    expect(screen.getByText(new RegExp(`${section}.*${specPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeTruthy();
  });

  it("counts answered persona, architecture, and eval flow rows in the panel", () => {
    render(
      <IntakeProgressPane
        intakeAnswers={[
          {
            metadata: {
              topic: "primary_persona_and_trigger",
              extracts_into: { spec_path: "personas[*].name" },
            },
          },
          {
            metadata: {
              topic: "agent_delivery_scale",
              extracts_into: { spec_path: "agentSystem.builderScale" },
            },
          },
          {
            metadata: {
              topic: "pending_architecture_decisions:2",
              extracts_into: { spec_path: "adrs[*].cites" },
            },
          },
          {
            metadata: {
              topic: "agent_evaluation_readiness",
              extracts_into: { spec_path: "agentSystem.evaluations" },
            },
          },
        ]}
        currentSpecPath="agentSystem.evaluations"
        currentTopic="agent_evaluation_readiness"
      />,
    );

    expect(screen.getByTestId("intake-progress-section-north-star").textContent).toContain("1");
    expect(screen.getByTestId("intake-progress-section-architecture").textContent).toContain("2");
    expect(screen.getByTestId("intake-progress-section-coding-prompts").textContent).toContain("1");
    expect(screen.getByText(/Coding Prompts.*agentSystem\.evaluations/)).toBeTruthy();
  });
});
