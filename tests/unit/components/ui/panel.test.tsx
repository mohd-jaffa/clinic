import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

describe("Panel", () => {
  it("is a section named by its title, its body on a surface card, and what it saves at the card's foot", () => {
    render(
      <Panel title="Vitals" className="md:col-start-1" footer={<Button label="Save vitals" />}>
        <p>Pulse 72</p>
      </Panel>,
    );
    const section = screen.getByRole("region", { name: "Vitals" });
    expect(section).toHaveClass("md:col-start-1");
    expect(within(section).getByRole("heading", { name: "Vitals" })).toBeInTheDocument();
    expect(within(section).getByText("Pulse 72").parentElement).toHaveClass("bg-surface");
    expect(within(section).getByRole("button", { name: "Save vitals" })).toBeInTheDocument();
  });

  it("ends with nothing when it has nothing to save", () => {
    render(
      <Panel title="Follow-up" footer={false}>
        <p>No follow-up</p>
      </Panel>,
    );
    const card = screen.getByText("No follow-up").parentElement!;
    expect(card.children).toHaveLength(1);
  });
});
