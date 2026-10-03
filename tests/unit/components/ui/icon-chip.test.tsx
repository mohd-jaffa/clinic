import { render } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconChip } from "@/components/ui/icon-chip";

describe("IconChip", () => {
  it("draws the icon in a round chip, out of the screen reader's way: the row's title says what it is", () => {
    const { container } = render(<IconChip icon={Wallet} />);
    const chip = container.firstElementChild!;
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(chip.querySelector("svg")).toBeInTheDocument();
  });
});
