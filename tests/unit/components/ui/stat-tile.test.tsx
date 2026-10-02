import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatGrid, StatTile } from "@/components/ui/stat-tile";

describe("StatTile", () => {
  it("is a label and its figure in a description list, the figure big on the land", () => {
    render(
      <StatGrid>
        <StatTile label="Waiting" value="4" on="land" />
        <StatTile label="Collected" value="₹12,400" />
      </StatGrid>,
    );
    const waiting = screen.getByText("Waiting");
    expect(waiting.tagName).toBe("DT");
    expect(waiting).toHaveClass("text-land-muted");
    expect(screen.getByText("4")).toHaveClass("text-display");
    expect(screen.getByText("₹12,400")).toHaveClass("text-heading");
    expect(screen.getByText("Collected").parentElement).toHaveClass("bg-surface");
  });

  it("opens where the figure is looked into, from the whole tile", () => {
    render(
      <StatGrid>
        <StatTile label="Outstanding" value="₹2,500" href="/billing" note="3 overdue" />
      </StatGrid>,
    );
    expect(screen.getByRole("link", { name: "Outstanding" })).toHaveAttribute("href", "/billing");
    expect(screen.getByText("3 overdue")).toHaveClass("text-coral");
  });

  it("makes a note a coral capsule on the land, where coral words would not stand out", () => {
    render(
      <StatGrid>
        <StatTile label="To bill" value="3" on="land" note="1 since yesterday" />
      </StatGrid>,
    );
    expect(screen.getByText("1 since yesterday")).toHaveClass("bg-coral", "text-on-coral");
  });
});
