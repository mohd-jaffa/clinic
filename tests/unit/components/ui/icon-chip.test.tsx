import { render } from "@testing-library/react";
import { Trash2, Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconChip } from "@/components/ui/icon-chip";

describe("IconChip", () => {
  it("draws the icon in a round chip, out of the screen reader's way: the row's title says what it is", () => {
    const { container } = render(<IconChip icon={Wallet} />);
    const chip = container.firstElementChild!;
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(chip.querySelector("svg")).toBeInTheDocument();
    expect(chip).toHaveClass("bg-ground", "text-ink");
  });

  it("is coral for a row whose screen holds what cannot be undone", () => {
    const { container } = render(<IconChip icon={Trash2} tone="attention" />);
    expect(container.firstElementChild).toHaveClass("bg-coral-soft", "text-coral");
  });
});
