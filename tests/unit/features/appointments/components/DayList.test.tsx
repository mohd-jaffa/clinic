import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DayList } from "@/features/appointments/components/DayList";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("DayList (plan §11.5)", () => {
  it("lists the day by time: patient, time, kind, the doctor while every doctor's are shown, and the status", () => {
    const { rerender } = render(
      <DayList
        label="Appointments, Tuesday, 13 Oct 2026"
        showDoctor
        appointments={[
          aCalendarAppointment(),
          aCalendarAppointment({ id: "a-2", patientName: "Kiran Das", source: "WALK_IN", token: 3, status: "ARRIVED" }),
        ]}
      />,
    );
    const rows = within(screen.getByRole("list", { name: "Appointments, Tuesday, 13 Oct 2026" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]).toHaveTextContent("Rohan Mehta9:00 AM · Consultation · Maya RaoScheduled");
    expect(rows[1]).toHaveTextContent("Kiran Das9:00 AM · Walk-in #3 · Maya RaoArrived");
    rerender(<DayList label="Day" showDoctor={false} appointments={[aCalendarAppointment()]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("9:00 AM · Consultation");
    expect(screen.getByRole("listitem")).not.toHaveTextContent("Maya Rao");
  });

  it("says a day has nothing booked, with Book appointment for whoever may book", async () => {
    const onBook = vi.fn();
    const { rerender } = render(<DayList label="Day" showDoctor appointments={[]} onBook={onBook} />);
    expect(screen.getByRole("heading", { name: "Nothing booked" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    expect(onBook).toHaveBeenCalled();
    rerender(<DayList label="Day" showDoctor appointments={[]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
