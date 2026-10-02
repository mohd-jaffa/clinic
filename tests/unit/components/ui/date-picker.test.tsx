import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatePicker } from "@/components/ui/date-picker";

function Picker({
  start = "2026-09-20",
  onChange = vi.fn(),
  ...rest
}: { start?: string; onChange?: (value: string) => void } & Partial<Parameters<typeof DatePicker>[0]>) {
  const [value, setValue] = useState(start);
  return (
    <>
      <DatePicker
        label="Delivery day"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        {...rest}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

const control = () => screen.getByRole("button", { name: /^Delivery day/ });
const calendar = () => screen.getByRole("dialog", { name: "Delivery day: pick a day" });
const day = (name: string) => within(calendar()).getByRole("button", { name });
const month = () => within(calendar()).getByRole("grid").getAttribute("aria-labelledby");
const heading = () => document.getElementById(month() ?? "")?.textContent;

beforeEach(() => {
  // Today is Sunday 27 Sep 2026 in India.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-27T06:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DatePicker", () => {
  it("shows the day chosen beside a calendar mark, named for what it is", () => {
    render(<Picker />);
    expect(control()).toHaveAccessibleName("Delivery day 20 Sep 2026");
    expect(control()).toHaveAttribute("aria-haspopup", "dialog");
    expect(control()).toHaveAttribute("aria-expanded", "false");
  });

  it("says so while no day is chosen, in the words it is given", () => {
    const { unmount } = render(<Picker start="" />);
    expect(control()).toHaveAccessibleName("Delivery day Choose a date");
    unmount();
    render(<Picker start="" placeholder="Any day" />);
    expect(control()).toHaveAccessibleName("Delivery day Any day");
  });

  it("takes its name from a visible label when one names it", () => {
    render(
      <>
        <span id="when">When</span>
        <DatePicker label="When" labelledBy="when" value="2026-09-20" onChange={vi.fn()} />
      </>,
    );
    expect(screen.getByRole("button", { name: "When 20 Sep 2026" })).toBeInTheDocument();
  });

  it("opens on the chosen day's month, with the focus on that day, weeks from Monday, and today ringed", async () => {
    render(<Picker />);
    await userEvent.click(control());
    expect(control()).toHaveAttribute("aria-expanded", "true");
    expect(heading()).toBe("September 2026");
    expect(day("Sunday, 20 Sep 2026")).toHaveFocus();
    expect(day("Sunday, 20 Sep 2026").closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");
    expect(day("Sunday, 27 Sep 2026")).toHaveAttribute("aria-current", "date");
    expect(
      within(calendar())
        .getAllByRole("columnheader")
        .map((header) => header.getAttribute("aria-label")),
    ).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    // 1 September 2026 is a Tuesday: one empty cell before it.
    const [firstWeek] = within(calendar()).getAllByRole("row").slice(1);
    expect(within(firstWeek).getAllByRole("button")[0]).toHaveAccessibleName("Tuesday, 1 Sep 2026");
  });

  it("opens on today when no day is chosen", async () => {
    render(<Picker start="" />);
    await userEvent.click(control());
    expect(day("Sunday, 27 Sep 2026")).toHaveFocus();
  });

  it("takes a tapped day, closes, and hands the focus back", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await userEvent.click(control());
    await userEvent.click(day("Friday, 25 Sep 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-09-25");
    expect(control()).toHaveAccessibleName("Delivery day 25 Sep 2026");
    expect(control()).toHaveAttribute("aria-expanded", "false");
    expect(control()).toHaveFocus();
  });

  it("takes the day already chosen as no change", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await userEvent.click(control());
    await userEvent.click(day("Sunday, 20 Sep 2026"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("pages through the months, the focus following to the same date", async () => {
    render(<Picker start="2026-01-31" />);
    await userEvent.click(control());
    await userEvent.click(within(calendar()).getByRole("button", { name: "Next month" }));
    expect(heading()).toBe("February 2026");
    // 31 January is 28 February one month on.
    expect(day("Saturday, 28 Feb 2026")).toHaveFocus();
    await userEvent.click(within(calendar()).getByRole("button", { name: "Previous month" }));
    await userEvent.click(within(calendar()).getByRole("button", { name: "Previous month" }));
    expect(heading()).toBe("December 2025");
    expect(calendar()).toBeVisible();
  });

  it("moves by the keys a calendar takes, and Enter takes the day", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await userEvent.click(control());

    await userEvent.keyboard("{ArrowRight}");
    expect(day("Monday, 21 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(day("Saturday, 19 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(day("Saturday, 26 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(day("Saturday, 19 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(day("Monday, 14 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(day("Sunday, 20 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{PageDown}");
    expect(day("Tuesday, 20 Oct 2026")).toHaveFocus();
    await userEvent.keyboard("{PageUp}{PageUp}");
    expect(day("Thursday, 20 Aug 2026")).toHaveFocus();
    await userEvent.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(day("Friday, 20 Aug 2027")).toHaveFocus();
    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(day("Thursday, 20 Aug 2026")).toHaveFocus();

    // Any other key is the page's.
    await userEvent.keyboard("a");
    expect(day("Thursday, 20 Aug 2026")).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-08-20");
    expect(control()).toHaveFocus();
  });

  it("closes on Escape without the sheet it sits in, and on a second tap of the control", async () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && outer()}>
        <Picker />
      </div>,
    );
    await userEvent.click(control());
    await userEvent.keyboard("{Escape}");
    expect(control()).toHaveAttribute("aria-expanded", "false");
    expect(control()).toHaveFocus();
    expect(outer).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");
    expect(control()).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(control());
    expect(control()).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps days out of its bounds from being taken, and keeps the keys inside them", async () => {
    render(<Picker min="2026-09-10" max="2026-10-05" />);
    await userEvent.click(control());
    expect(day("Wednesday, 9 Sep 2026")).toBeDisabled();
    expect(day("Thursday, 10 Sep 2026")).toBeEnabled();
    expect(within(calendar()).getByRole("button", { name: "Previous month" })).toBeDisabled();

    await userEvent.keyboard("{PageUp}");
    expect(day("Thursday, 10 Sep 2026")).toHaveFocus();
    await userEvent.keyboard("{PageDown}");
    expect(day("Monday, 5 Oct 2026")).toHaveFocus();
    expect(within(calendar()).getByRole("button", { name: "Next month" })).toBeDisabled();
    expect(day("Tuesday, 6 Oct 2026")).toBeDisabled();
  });

  it("opens inside its bounds when the day chosen is outside them", async () => {
    render(<Picker start="2026-12-25" max="2026-10-05" />);
    await userEvent.click(control());
    expect(day("Monday, 5 Oct 2026")).toHaveFocus();
  });

  it("takes today from Today, unless today is out of bounds", async () => {
    const onChange = vi.fn();
    const { unmount } = render(<Picker onChange={onChange} />);
    await userEvent.click(control());
    await userEvent.click(within(calendar()).getByRole("button", { name: "Today" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-27");
    unmount();

    render(<Picker max="2026-09-26" />);
    await userEvent.click(control());
    expect(within(calendar()).getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("offers Clear only where the field may be empty, and only while a day is chosen", async () => {
    const onChange = vi.fn();
    const { unmount } = render(<Picker />);
    await userEvent.click(control());
    expect(within(calendar()).queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    unmount();

    render(<Picker clearable onChange={onChange} placeholder="Any day" />);
    await userEvent.click(control());
    await userEvent.click(within(calendar()).getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(control()).toHaveAccessibleName("Delivery day Any day");
    await userEvent.click(control());
    expect(within(calendar()).getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("closes once the focus leaves it, and says so to the form", async () => {
    const onBlur = vi.fn();
    render(<Picker onBlur={onBlur} />);
    await userEvent.click(control());
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    await waitFor(() => expect(control()).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(onBlur).toHaveBeenCalled());
  });

  it("stays open while the focus moves inside it, or back to its control", async () => {
    const onBlur = vi.fn();
    render(<Picker onBlur={onBlur} />);
    await userEvent.click(control());
    await userEvent.tab();
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(control()).toHaveAttribute("aria-expanded", "true");

    act(() => control().focus());
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(control()).toHaveAttribute("aria-expanded", "true");
    expect(onBlur).not.toHaveBeenCalled();
  });

  it("reads its field's message as its description, is marked for the well to show it, and can be turned off", () => {
    const { rerender } = render(
      <>
        <Picker invalid describedBy="why" />
        <p id="why">Choose a day.</p>
      </>,
    );
    expect(control()).toHaveAccessibleDescription("Choose a day.");
    expect(control()).toHaveAttribute("data-invalid", "true");
    rerender(<Picker disabled />);
    expect(control()).toBeDisabled();
  });

  it("hands its control to a ref, so a refused field can be focused", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<DatePicker ref={ref} label="Delivery day" value="" onChange={vi.fn()} />);
    expect(ref.current).toBe(control());
  });
});
