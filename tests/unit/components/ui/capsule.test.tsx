import { render, screen } from "@testing-library/react";
import { Check, Clock } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Capsule, CapsuleChip, capsuleClasses } from "@/components/ui/capsule";

const chipOf = (container: HTMLElement) => container.querySelector("[data-chip]")!;

describe("Capsule", () => {
  it("says where something stands, its chip on the trailing edge while it waits", () => {
    const { container } = render(<Capsule label="Waiting" icon={Clock} />);
    expect(screen.getByText("Waiting")).not.toHaveAttribute("data-live");
    expect(chipOf(container)).toHaveAttribute("data-chip", "trailing");
  });

  it("sends the chip to the leading edge once the thing is live, the words saying so too", () => {
    const { container } = render(<Capsule label="With the doctor" icon={Check} live tone="action" size="md" />);
    expect(screen.getByText("With the doctor")).toHaveAttribute("data-live", "true");
    expect(chipOf(container)).toHaveAttribute("data-chip", "leading");
    expect(chipOf(container).querySelector("svg")).not.toBeNull();
  });

  it("makes room for the chip on whichever side it rides", () => {
    expect(capsuleClasses({ tone: "action", size: "md", at: "trailing" })).toContain("pr-[49px]");
    expect(capsuleClasses({ tone: "action", size: "md", at: "leading" })).toContain("pl-[49px]");
    expect(capsuleClasses({ tone: "danger", size: "sm", at: "trailing" })).toContain("bg-coral");
  });
});

describe("CapsuleChip", () => {
  it("spins while the work is on its way, and is hidden from a screen reader", () => {
    const { container } = render(<CapsuleChip tone="action" size="sm" at="trailing" icon={Check} busy />);
    expect(chipOf(container)).toHaveAttribute("aria-hidden", "true");
    expect(chipOf(container).querySelector("svg")).toHaveClass("animate-spin");
  });

  it("holds its icon while nothing is on its way", () => {
    const { container } = render(<CapsuleChip tone="surface" size="md" at="leading" icon={Clock} />);
    expect(chipOf(container).querySelector("svg")).not.toHaveClass("animate-spin");
  });
});
