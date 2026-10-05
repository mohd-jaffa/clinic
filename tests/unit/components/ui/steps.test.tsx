import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Steps } from "@/components/ui/steps";

describe("Steps (D131)", () => {
  it("lists the steps in order, saying which one the person is on", () => {
    render(<Steps label="Import steps" steps={["File", "Columns", "Check", "Import"]} current={1} />);
    const steps = within(screen.getByRole("list", { name: "Import steps" })).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual(["File", "2Columns", "3Check", "4Import"]);
    expect(steps.map((step) => step.getAttribute("aria-current"))).toEqual([null, "step", null, null]);
  });

  it("marks every step done once the last is", () => {
    render(<Steps label="Import steps" steps={["File", "Import"]} current={2} />);
    expect(screen.getAllByRole("listitem").every((step) => !step.hasAttribute("aria-current"))).toBe(true);
  });
});
