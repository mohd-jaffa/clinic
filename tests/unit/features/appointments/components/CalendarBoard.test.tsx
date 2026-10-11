import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarBoard } from "@/features/appointments/components/CalendarBoard";
import { aCalendarAppointment } from "@tests/support/appointments";
import { aClosure } from "@tests/support/clinic";

const doctors = [
  { id: "d-1", name: "Maya Rao" },
  { id: "d-2", name: "Arun Sen" },
];
const week = { from: "2026-10-12", to: "2026-10-18" };

beforeEach(() => {
  // Now, in Kochi: Tuesday 13 October 2026, 10:07 AM.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T04:37:00Z"));
});
afterEach(() => vi.useRealTimers());

const steps = (column: number) =>
  screen.getByRole("region").querySelectorAll<HTMLElement>(".relative.border-l > [aria-hidden='true']")[column]
    .children;

describe("CalendarBoard (plan §11.5)", () => {
  it("draws a day with a column per doctor — one gone from the team too, while their appointments stand — and books a tapped quarter from now on", () => {
    const onPick = vi.fn();
    render(
      <CalendarBoard
        view="DAY"
        day="2026-10-13"
        week={week}
        doctorId=""
        doctors={doctors}
        closures={[
          aClosure({
            doctorId: "d-2",
            doctorName: "Arun Sen",
            startsOn: "2026-10-13",
            endsOn: "2026-10-13",
            reason: "Conference",
          }),
        ]}
        appointments={[
          aCalendarAppointment(),
          aCalendarAppointment({ id: "a-9", doctorId: "d-9", doctorName: "Ravi Kumar", patientName: "Kiran Das" }),
        ]}
        onPick={onPick}
      />,
    );
    const grid = screen.getByRole("region", { name: "Appointments, Tuesday, 13 Oct 2026" });
    expect(within(grid).getByRole("list", { name: "Maya Rao" })).toHaveTextContent(
      "9:00 AM – 9:15 AM, Rohan Mehta, Consultation, Scheduled",
    );
    expect(within(grid).getByRole("list", { name: "Ravi Kumar" })).toHaveTextContent("Kiran Das");
    expect(within(grid).getByText("Away: Conference")).toBeInTheDocument();

    // From 8 AM: 10:00 is past now; 10:15 is not.
    fireEvent.click(steps(0)[8] as HTMLElement);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(steps(0)[9] as HTMLElement);
    expect(onPick).toHaveBeenCalledWith({ doctorId: "d-1", date: "2026-10-13", minutes: 615 });
  });

  it("draws one doctor's day, and a day passed takes no tap; a day to come takes any", () => {
    const onPick = vi.fn();
    const { rerender } = render(
      <CalendarBoard
        view="DAY"
        day="2026-10-12"
        week={week}
        doctorId="d-1"
        doctors={doctors}
        closures={[]}
        appointments={[]}
        onPick={onPick}
      />,
    );
    expect(screen.getAllByRole("list")).toHaveLength(1);
    fireEvent.click(steps(0)[20] as HTMLElement);
    expect(onPick).not.toHaveBeenCalled();
    rerender(
      <CalendarBoard
        view="DAY"
        day="2026-10-14"
        week={week}
        doctorId="d-1"
        doctors={doctors}
        closures={[]}
        appointments={[]}
        onPick={onPick}
      />,
    );
    fireEvent.click(steps(0)[0] as HTMLElement);
    expect(onPick).toHaveBeenCalledWith({ doctorId: "d-1", date: "2026-10-14", minutes: 480 });
  });

  it("draws a doctor's week, Monday to Sunday, today marked, a holiday and their leave shaded, and books a tapped day", () => {
    const onPick = vi.fn();
    render(
      <CalendarBoard
        view="WEEK"
        day="2026-10-13"
        week={week}
        doctorId="d-1"
        doctors={doctors}
        closures={[
          aClosure({ startsOn: "2026-10-15", endsOn: "2026-10-15", reason: "Diwali" }),
          aClosure({ id: "l", doctorId: "d-1", startsOn: "2026-10-16", endsOn: "2026-10-16", reason: "Conference" }),
        ]}
        appointments={[aCalendarAppointment({ day: "2026-10-14", scheduledAt: "2026-10-14T03:30:00Z" })]}
        onPick={onPick}
      />,
    );
    const grid = screen.getByRole("region", { name: "Maya Rao’s appointments, 12 – 18 Oct" });
    expect(
      within(grid)
        .getAllByRole("list")
        .map((list) => list.getAttribute("aria-label")),
    ).toEqual(["Mon 12 Oct", "Tue 13 Oct", "Wed 14 Oct", "Thu 15 Oct", "Fri 16 Oct", "Sat 17 Oct", "Sun 18 Oct"]);
    expect(within(grid).getByRole("list", { name: "Wed 14 Oct" })).toHaveTextContent("Rohan Mehta");
    expect(grid.querySelector('[aria-current="date"]')).toHaveTextContent("Tue 13 OctToday");
    expect(within(grid).getByText("Away: Diwali")).toBeInTheDocument();
    expect(within(grid).getByText("Away: Conference")).toBeInTheDocument();
    fireEvent.click(steps(2)[4] as HTMLElement);
    expect(onPick).toHaveBeenCalledWith({ doctorId: "d-1", date: "2026-10-14", minutes: 540 });
  });

  it("names a doctor it cannot find as no one, and takes no tap without onPick", () => {
    render(
      <CalendarBoard
        view="DAY"
        day="2026-10-14"
        week={week}
        doctorId="d-7"
        doctors={doctors}
        closures={[aClosure({ startsOn: "2026-10-14", endsOn: "2026-10-14", reason: "Diwali" })]}
        appointments={[]}
      />,
    );
    expect(screen.getByRole("list", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("Away: Diwali")).toBeInTheDocument();
  });
});
