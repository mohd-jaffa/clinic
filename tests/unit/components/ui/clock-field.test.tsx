import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ClockField, type ClockValue } from "@/components/ui/clock-field";

const HOURS = ["09", "10", "11", "12", "13"];
const MINUTES = ["00", "15", "30", "45"];

function Clock({
  onChange = vi.fn(),
  ...rest
}: {
  onChange?: (value: ClockValue) => void;
  error?: string;
  hint?: string;
  opensAt?: string;
}) {
  const [value, setValue] = useState<ClockValue>({ hour: "", minute: "" });
  return (
    <ClockField
      label="Time"
      hourLabel="Hour"
      minuteLabel="Minutes"
      hours={HOURS}
      minutes={MINUTES}
      required
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...rest}
    />
  );
}

describe("ClockField (D146)", () => {
  it("chooses the hour and the minutes apart, each read with the field's name, and passes both on", async () => {
    const onChange = vi.fn();
    render(<Clock onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument();
    const hour = screen.getByRole("combobox", { name: "Time, Hour" });
    const minute = screen.getByRole("combobox", { name: "Time, Minutes" });
    expect(hour).toHaveTextContent("Hour");
    expect(minute).toHaveTextContent("Min");

    await userEvent.click(hour);
    expect(
      within(screen.getByRole("listbox", { name: "Time, Hour" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Hour", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM"]);
    await userEvent.click(screen.getByRole("option", { name: "1 PM" }));
    expect(onChange).toHaveBeenLastCalledWith({ hour: "13", minute: "" });

    await userEvent.click(minute);
    await userEvent.click(screen.getByRole("option", { name: ":45" }));
    expect(onChange).toHaveBeenLastCalledWith({ hour: "13", minute: "45" });
    expect(hour).toHaveTextContent("1 PM");
    expect(minute).toHaveTextContent(":45");
  });

  it("opens the hours on the one the screen names while none is chosen", async () => {
    render(<Clock opensAt="11" />);
    const hour = screen.getByRole("combobox", { name: "Time, Hour" });
    await userEvent.click(hour);
    expect(document.getElementById(hour.getAttribute("aria-activedescendant") ?? "")).toHaveTextContent("11 AM");
  });

  it("says its hint, or in its place what is wrong, read with both halves", () => {
    const { rerender } = render(<Clock hint="On the clinic's steps." />);
    const hint = screen.getByText("On the clinic's steps.");
    expect(screen.getByRole("combobox", { name: "Time, Hour" })).toHaveAttribute("aria-describedby", hint.id);
    rerender(<Clock error="Choose time." />);
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Choose time.");
    for (const half of screen.getAllByRole("combobox")) {
      expect(half).toHaveAttribute("aria-invalid", "true");
      expect(half).toHaveAttribute("aria-describedby", error.id);
    }
  });

  it("names its optional state, and hands its hour to a ref so a refused field is focused there", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <ClockField
        ref={ref}
        label="Time"
        optional
        hourLabel="Hour"
        minuteLabel="Minutes"
        hours={HOURS}
        minutes={MINUTES}
        value={{ hour: "10", minute: "30" }}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole("group", { name: /^Time/ })).toHaveTextContent("(Optional)");
    expect(ref.current).toBe(screen.getByRole("combobox", { name: "Time, Hour" }));
    expect(ref.current).toBeDisabled();
  });
});
