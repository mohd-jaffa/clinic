import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DayList } from "@/features/appointments/components/DayList";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";
import { aCalendarAppointment } from "@tests/support/appointments";

vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authStub() }));

describe("DayList (plan §11.5)", () => {
  it("lists the day by time: patient, time, kind, the doctor while every doctor's are shown, and the status", () => {
    const { rerender } = render(
      <DayList
        canRemind={false}
        label="Appointments, Tuesday, 13 Oct 2026"
        showDoctor
        onOpen={vi.fn()}
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
    rerender(
      <DayList
        canRemind={false}
        label="Day"
        showDoctor={false}
        appointments={[aCalendarAppointment()]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("9:00 AM · Consultation");
    expect(screen.getByRole("listitem")).not.toHaveTextContent("Maya Rao");
  });

  it("says a day has nothing booked, with Book appointment for whoever may book", async () => {
    const onBook = vi.fn();
    const { rerender } = render(
      <DayList canRemind={false} label="Day" showDoctor appointments={[]} onBook={onBook} onOpen={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Nothing booked" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    expect(onBook).toHaveBeenCalled();
    rerender(<DayList canRemind={false} label="Day" showDoctor appointments={[]} onOpen={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens an appointment tapped (D160)", async () => {
    const onOpen = vi.fn();
    const rohan = aCalendarAppointment();
    render(<DayList canRemind={false} label="Day" showDoctor appointments={[rohan]} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledWith(rohan);
  });

  it("offers a WhatsApp reminder on a booking still to come for whoever may, and says who has been reminded (D179)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T02:00:00Z"));
    render(
      <Providers>
        <DayList
          label="Day"
          showDoctor={false}
          canRemind
          onOpen={vi.fn()}
          appointments={[
            aCalendarAppointment({ remindedAt: "2026-10-12T05:00:00Z" }),
            aCalendarAppointment({ id: "a-2", patientName: "Kiran Das", status: "ARRIVED" }),
            aCalendarAppointment({ id: "a-3", patientName: "Anita Rao", day: "2026-10-12" }),
          ]}
        />
      </Providers>,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("9:00 AM · Consultation · Reminded");
    expect(within(rows[0]).getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("link")).not.toBeInTheDocument();
    expect(within(rows[2]).queryByRole("link")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
