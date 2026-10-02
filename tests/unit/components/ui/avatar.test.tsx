import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, initials } from "@/components/ui/avatar";

describe("initials", () => {
  it("takes the first letters of the first and last words", () => {
    expect(initials("Priya Menon")).toBe("PM");
    expect(initials("  rohan  kumar mehta ")).toBe("RM");
    expect(initials("Asha")).toBe("A");
  });

  it("keeps a whole letter, not half of one", () => {
    expect(initials("मीना शर्मा")).toBe("मीश");
  });

  it("is empty for no name", () => {
    expect(initials("   ")).toBe("");
  });
});

describe("Avatar", () => {
  it("is the initials, hidden from a screen reader since the name is beside it", () => {
    const { container } = render(<Avatar name="Abdul Rahman" />);
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveTextContent("AR");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveClass("bg-land");
  });

  it("is an ink chip on the land, at the size asked", () => {
    const { container } = render(<Avatar name="Abdul Rahman" on="land" size="lg" />);
    expect(container.firstElementChild).toHaveClass("bg-chip", "size-14");
  });
});
