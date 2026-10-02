import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertChip } from "@/components/ui/alert-chip";

describe("AlertChip", () => {
  it("marks an allergy in the danger tone, with a warning mark a screen reader skips", () => {
    render(<AlertChip label="Allergy: Penicillin" tone="danger" />);
    const chip = screen.getByText("Allergy: Penicillin").parentElement!;
    expect(chip).toHaveClass("text-coral");
    expect(chip.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps any other alert a quiet note", () => {
    render(<AlertChip label="Diabetic" />);
    expect(screen.getByText("Diabetic").parentElement).toHaveClass("text-ink");
  });
});
