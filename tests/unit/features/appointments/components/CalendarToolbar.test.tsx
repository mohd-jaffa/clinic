import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarToolbar, stripDays } from "@/features/appointments/components/CalendarToolbar";

const doctors = [
  { id: "d-1", name: "Maya Rao" },
  { id: "d-2", name: "Arun Sen" },
];

beforeEach(() => {
  // Today, in Kochi: Sunday 11 October 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("stripDays (D157)", () => {
  it("reaches a week back and four weeks ahead of today, or of a day chosen outside that", () => {
    const days = stripDays("2026-10-13");
    expect(days[0]).toBe("2026-10-04");
    expect(days.at(-1)).toBe("2026-11-08");
    expect(days).toHaveLength(36);
    expect(stripDays("2027-01-20")[0]).toBe("2027-01-13");
    expect(stripDays("2026-09-01").at(-1)).toBe("2026-09-29");
  });
});

describe("CalendarToolbar (plan §11.5)", () => {
  const props = () => ({
    view: "DAY" as const,
    onView: vi.fn(),
    day: "2026-10-13",
    onDay: vi.fn(),
    doctorId: "",
    onDoctor: vi.fn(),
    doctors,
  });

  it("chooses every doctor or one, the day or the week, and the day by the strip, the arrows or Today", async () => {
    const handlers = props();
    render(<CalendarToolbar {...handlers} />);
    const doctor = screen.getByRole("combobox", { name: "Doctor" });
    expect(doctor).toHaveTextContent("All doctors");
    await userEvent.click(doctor);
    await userEvent.click(screen.getByRole("option", { name: "Arun Sen" }));
    expect(handlers.onDoctor).toHaveBeenCalledWith("d-2");

    await userEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(handlers.onView).toHaveBeenCalledWith("WEEK");

    expect(screen.getByRole("heading", { name: "Tuesday, 13 Oct 2026" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-14");
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-12");
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-11");
    await userEvent.click(screen.getByRole("radio", { name: "Thursday, 15 Oct 2026" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-15");
  });

  it("keeps a week to one doctor, and steps it a week at a time", async () => {
    const handlers = props();
    render(<CalendarToolbar {...handlers} view="WEEK" doctorId="d-1" />);
    await userEvent.click(screen.getByRole("combobox", { name: "Doctor" }));
    expect(screen.queryByRole("option", { name: "All doctors" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: "12 – 18 Oct" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-20");
    await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-06");
  });

  it("goes to any day through its calendar", async () => {
    const handlers = props();
    render(<CalendarToolbar {...handlers} />);
    await userEvent.click(screen.getByRole("button", { name: /^Choose a day/ }));
    await userEvent.click(screen.getByRole("button", { name: "Wednesday, 21 Oct 2026" }));
    expect(handlers.onDay).toHaveBeenLastCalledWith("2026-10-21");
  });
});
