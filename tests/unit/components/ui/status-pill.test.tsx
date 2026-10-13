import { render, screen } from "@testing-library/react";
import { Siren } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "@/components/ui/status-pill";

describe("StatusPill", () => {
  it("says the status in words, quiet unless told otherwise", () => {
    render(<StatusPill label="Invited" />);
    expect(screen.getByText("Invited")).toHaveClass("text-muted");
  });

  it("repeats a live status in green and one needing attention in coral", () => {
    render(
      <>
        <StatusPill label="Active" tone="live" />
        <StatusPill label="View only" tone="attention" />
      </>,
    );
    expect(screen.getByText("Active")).toHaveClass("text-action");
    expect(screen.getByText("View only")).toHaveClass("text-coral");
  });

  it("carries its own mark in place of the dot, when given one", () => {
    const { container } = render(<StatusPill label="Urgent" tone="attention" icon={Siren} />);
    expect(screen.getByText("Urgent")).toHaveClass("text-coral");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".rounded-full.size-1\\.5")).toBeNull();
  });
});
