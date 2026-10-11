import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingPrefill } from "@/features/appointments/components/BookingSheet";
import type { CalendarAppointment } from "@/features/appointments/types";
import { aCalendarAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { aClosure } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, adding, query, closures, doctors, asked, sheet, picks } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  adding: { current: { open: false, show: vi.fn(), close: vi.fn() } },
  query: {
    current: {
      data: [] as CalendarAppointment[] | undefined,
      error: undefined as unknown,
      isLoading: false,
      mutate: vi.fn(),
    },
  },
  closures: { current: [] as unknown[] | undefined },
  doctors: { current: [] as { id: string; name: string }[] | undefined },
  asked: vi.fn(),
  sheet: { prefill: undefined as BookingPrefill | undefined },
  picks: { current: undefined as ((pick: { doctorId: string; date: string; minutes: number }) => void) | undefined },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/hooks/useAddForm", () => ({ useAddForm: () => adding.current }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));
vi.mock("@/features/clinic/hooks/useClosures", () => ({ useClosures: () => ({ data: closures.current }) }));
vi.mock("@/features/appointments/hooks/useAppointments", () => ({
  useAppointments: (from: string, to: string, doctorId: string) => {
    asked(from, to, doctorId);
    return query.current;
  },
}));
vi.mock("@/features/appointments/components/BookingSheet", () => ({
  BookingSheet: ({ open, prefill }: { open: boolean; prefill?: BookingPrefill }) => {
    sheet.prefill = prefill;
    return open ? <div role="dialog" aria-label="Book an appointment" /> : null;
  },
}));
vi.mock("@/features/appointments/components/CalendarBoard", () => ({
  CalendarBoard: ({ view, onPick }: { view: string; onPick?: typeof picks.current }) => {
    picks.current = onPick;
    return <p>{`Board: ${view}`}</p>;
  },
}));

const { Appointments } = await import("@/features/appointments/components/Appointments");

const draw = () =>
  render(
    <Providers>
      <Appointments />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  // Today, in Kochi: Tuesday 13 October 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T06:00:00Z"));
  auth.current = authStub();
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
  doctors.current = [
    { id: "d-1", name: "Maya Rao" },
    { id: "d-2", name: "Arun Sen" },
  ];
  closures.current = [];
  query.current = { data: [], error: undefined, isLoading: false, mutate: vi.fn() };
  sheet.prefill = undefined;
});
afterEach(() => vi.useRealTimers());

describe("Appointments — the calendar (plan §11.5, D152 – D159)", () => {
  it("opens on today, every doctor's for the front desk, the day as a list and as the board", () => {
    query.current.data = [
      aCalendarAppointment({ day: "2026-10-13" }),
      aCalendarAppointment({ id: "a-2", patientName: "Anita Rao", status: "CANCELLED" }),
    ];
    draw();
    expect(asked).toHaveBeenLastCalledWith("2026-10-13", "2026-10-13", "");
    expect(screen.getByRole("heading", { level: 1, name: "Appointments" })).toBeInTheDocument();
    const day = screen.getByRole("list", { name: "Appointments, Tuesday, 13 Oct 2026" });
    expect(within(day).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Board: DAY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelled and no-shows (1)" })).toBeInTheDocument();
  });

  it("opens a doctor on their own appointments (D155)", () => {
    auth.current = authStub({ role: "DOCTOR", permissions: ["patients.view", "appointments.view"] });
    draw();
    expect(asked).toHaveBeenLastCalledWith("2026-10-13", "2026-10-13", "doctor-1");
  });

  it("reads a doctor's week, the first doctor's from every doctor's (D158)", async () => {
    draw();
    await userEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(asked).toHaveBeenLastCalledWith("2026-10-12", "2026-10-18", "d-1");
    expect(screen.getByText("Board: WEEK")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(asked).toHaveBeenLastCalledWith("2026-10-13", "2026-10-13", "d-1");
  });

  it("says the day's holiday and the leave of the doctors shown", async () => {
    closures.current = [
      aClosure({ startsOn: "2026-10-13", endsOn: "2026-10-13", reason: "Diwali" }),
      aClosure({
        id: "l1",
        doctorId: "d-1",
        doctorName: "Maya Rao",
        startsOn: "2026-10-13",
        endsOn: "2026-10-13",
        reason: "Conference",
      }),
      aClosure({
        id: "l2",
        doctorId: "d-2",
        doctorName: null,
        startsOn: "2026-10-13",
        endsOn: "2026-10-13",
        reason: "Leave",
      }),
    ];
    const { unmount } = draw();
    expect(screen.getByText("Clinic closed: Diwali")).toBeInTheDocument();
    expect(screen.getByText("Maya Rao away: Conference")).toBeInTheDocument();
    expect(screen.getByText("Arun Sen away: Leave")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Doctor" }));
    await userEvent.click(screen.getByRole("option", { name: "Arun Sen" }));
    expect(screen.queryByText("Maya Rao away: Conference")).not.toBeInTheDocument();
    expect(screen.getByText("Arun Sen away: Leave")).toBeInTheDocument();
    unmount();

    // A doctor it cannot name is away all the same.
    closures.current = [
      aClosure({
        id: "l3",
        doctorId: "d-9",
        doctorName: null,
        startsOn: "2026-10-13",
        endsOn: "2026-10-13",
        reason: "Gone",
      }),
    ];
    draw();
    expect(screen.getByText("Away: Gone")).toBeInTheDocument();
  });

  it("books from its button, the day's empty state, and a tapped quarter with its doctor, day and time (D156)", async () => {
    draw();
    await userEvent.click(screen.getAllByRole("button", { name: "Book appointment" })[0]);
    expect(adding.current.show).toHaveBeenCalledTimes(1);
    expect(sheet.prefill).toBeUndefined();
    await userEvent.click(screen.getAllByRole("button", { name: "Book appointment" })[1]);
    expect(adding.current.show).toHaveBeenCalledTimes(2);

    adding.current = { ...adding.current, open: true };
    picks.current!({ doctorId: "d-2", date: "2026-10-14", minutes: 615 });
    await vi.waitFor(() =>
      expect(sheet.prefill).toEqual({ doctorId: "d-2", date: "2026-10-14", time: { hour: "10", minute: "15" } }),
    );
  });

  it("books nothing for a member who may not, nor in a view-only clinic", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view"] });
    adding.current = { ...adding.current, open: true };
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: "Book appointment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(picks.current).toBeUndefined();
    unmount();
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("button", { name: "Book appointment" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/view-only/)[0]).toBeInTheDocument();
  });

  it("waits for the doctors and the closures without failing, and for someone with no membership opens on every doctor", () => {
    doctors.current = undefined;
    closures.current = undefined;
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(asked).toHaveBeenLastCalledWith("2026-10-13", "2026-10-13", "");
    expect(screen.queryByRole("button", { name: "Book appointment" })).not.toBeInTheDocument();
  });

  it("stands in while it loads, and says when it could not, with Try again", async () => {
    query.current = { data: undefined, error: undefined, isLoading: true, mutate: vi.fn() };
    const { rerender } = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
    query.current = { data: undefined, error: new Error("offline"), isLoading: false, mutate: vi.fn() };
    rerender(
      <Providers>
        <Appointments />
      </Providers>,
    );
    expect(screen.getByText("The appointments couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(query.current.mutate).toHaveBeenCalled();
  });
});
