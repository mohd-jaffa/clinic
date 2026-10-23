import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthSwitcher } from "@/components/ui/month-switcher";

const draw = (latest?: boolean) => {
  const moves = { onPrevious: vi.fn(), onNext: vi.fn() };
  render(
    <MonthSwitcher
      label="Month"
      month="2026-10-01"
      previousLabel="Previous month"
      nextLabel="Next month"
      latest={latest}
      {...moves}
    />,
  );
  return moves;
};

describe("MonthSwitcher (plan §16; D330)", () => {
  it("names the month between its arrows, said as it changes, and moves either way", async () => {
    const { onPrevious, onNext } = draw();
    const group = screen.getByRole("group", { name: "Month" });
    expect(within(group).getByText("October 2026")).toHaveAttribute("aria-live", "polite");
    await userEvent.click(within(group).getByRole("button", { name: "Previous month" }));
    await userEvent.click(within(group).getByRole("button", { name: "Next month" }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("has no month after the latest to show", async () => {
    const { onNext } = draw(true);
    const next = screen.getByRole("button", { name: "Next month" });
    expect(next).toBeDisabled();
    await userEvent.click(next);
    expect(onNext).not.toHaveBeenCalled();
  });
});
