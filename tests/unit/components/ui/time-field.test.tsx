import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { timesBetween, TimeField } from "@/components/ui/time-field";

describe("timesBetween", () => {
  it("steps from the first time to the last, both included where the step lands on it", () => {
    expect(timesBetween("09:00", "10:00", 30)).toEqual(["09:00", "09:30", "10:00"]);
    expect(timesBetween("09:00", "09:50", 20)).toEqual(["09:00", "09:20", "09:40"]);
  });

  it("covers the whole day every quarter of an hour", () => {
    const day = timesBetween("00:00", "23:59", 15);
    expect(day).toHaveLength(96);
    expect(day.at(-1)).toBe("23:45");
  });
});

describe("TimeField", () => {
  it("offers the times as a person reads them, and passes the chosen one on as the database holds it", async () => {
    const onChange = vi.fn();
    render(<TimeField label="Time" required value="" onChange={onChange} from="09:00" to="11:00" step={30} />);
    const control = screen.getByRole("combobox", { name: "Time" });
    expect(control).toHaveTextContent("Choose a time");

    await userEvent.click(control);
    const list = screen.getByRole("listbox", { name: "Time" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a time", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM"]);
    await userEvent.click(within(list).getByRole("option", { name: "10:30 AM" }));
    expect(onChange).toHaveBeenCalledWith("10:30");
  });

  it("keeps a time between the steps, offered in its place", async () => {
    render(<TimeField label="Time" value="09:40" onChange={vi.fn()} from="09:00" to="10:00" step={30} />);
    const control = screen.getByRole("combobox", { name: "Time" });
    expect(control).toHaveTextContent("9:40 AM");

    await userEvent.click(control);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "9:00 AM",
      "9:30 AM",
      "9:40 AM",
      "10:00 AM",
    ]);
  });

  it("offers the whole day by default, and reads its message with it", () => {
    render(<TimeField label="Time" value="18:30" onChange={vi.fn()} error="Choose a later time." />);
    const control = screen.getByRole("combobox", { name: "Time" });
    expect(control).toHaveTextContent("6:30 PM");
    expect(control).toHaveAccessibleDescription("Choose a later time.");
  });
});
