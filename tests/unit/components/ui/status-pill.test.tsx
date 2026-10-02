import { render, screen } from "@testing-library/react";
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
});
