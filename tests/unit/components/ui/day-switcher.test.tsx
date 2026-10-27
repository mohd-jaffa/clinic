import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DaySwitcher } from "@/components/ui/day-switcher";

const draw = (day: string, max?: string) => {
  const onChange = vi.fn();
  render(
    <DaySwitcher
      label="Day"
      day={day}
      onChange={onChange}
      max={max}
      chooseLabel="Choose a day"
      previousLabel="Previous day"
      nextLabel="Next day"
    />,
  );
  return onChange;
};

describe("DaySwitcher (plan §18; D356)", () => {
  it("steps a day back or on, across a month's end, the day between opening the calendar", async () => {
    const onChange = draw("2026-10-31");
    const group = screen.getByRole("group", { name: "Day" });
    await userEvent.click(within(group).getByRole("button", { name: "Previous day" }));
    await userEvent.click(within(group).getByRole("button", { name: "Next day" }));
    expect(onChange.mock.calls).toEqual([["2026-10-30"], ["2026-11-01"]]);
    expect(within(group).getByRole("button", { name: "Choose a day 31 Oct 2026" })).toBeInTheDocument();
  });

  it("goes no further than its last day", async () => {
    const onChange = draw("2026-10-27", "2026-10-27");
    const next = screen.getByRole("button", { name: "Next day" });
    expect(next).toBeDisabled();
    await userEvent.click(next);
    expect(onChange).not.toHaveBeenCalled();
    draw("2026-10-26", "2026-10-27");
    expect(screen.getAllByRole("button", { name: "Next day" })[1]).toBeEnabled();
  });

  it("jumps to a day picked from the calendar", async () => {
    const onChange = draw("2026-10-27", "2026-10-27");
    await userEvent.click(screen.getByRole("button", { name: "Choose a day 27 Oct 2026" }));
    const calendar = screen.getByRole("dialog", { name: "Choose a day: pick a day" });
    await userEvent.click(within(calendar).getByRole("button", { name: "Tuesday, 20 Oct 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-10-20");
  });
});
