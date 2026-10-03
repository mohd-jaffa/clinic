import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("is one thing on or off, named by its label, its line read as its description, the whole row to tap", async () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="I also see patients" hint="You’ll be one of the clinic’s doctors too." />);
    const box = screen.getByRole("checkbox", { name: "I also see patients" });

    expect(box).toHaveAccessibleDescription("You’ll be one of the clinic’s doctors too.");
    expect(ref.current).toBe(box);
    await userEvent.click(screen.getByText("You’ll be one of the clinic’s doctors too."));
    expect(box).toBeChecked();
  });

  it("goes without a line", () => {
    render(<Checkbox label="Remember" />);
    expect(screen.getByRole("checkbox", { name: "Remember" })).not.toHaveAttribute("aria-describedby");
  });
});
