import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClosureAppointments as Listed } from "@/features/clinic/types";

const { answer, mutate, useClosureAppointments } = vi.hoisted(() => {
  const answer = { current: {} as { data?: Listed; error?: unknown } };
  const mutate = vi.fn();
  return { answer, mutate, useClosureAppointments: vi.fn(() => ({ ...answer.current, mutate })) };
});
vi.mock("@/features/clinic/hooks/useClosureAppointments", () => ({ useClosureAppointments }));

const { ClosureAppointments } = await import("@/features/clinic/components/ClosureAppointments");

const days = { who: "CLINIC", startsOn: "2026-10-24", endsOn: "2026-10-25" };
const draw = () => render(<ClosureAppointments {...days} />);

beforeEach(() => {
  vi.clearAllMocks();
  answer.current = {};
});

describe("ClosureAppointments (D87, D137)", () => {
  it("lists the appointments on the days by time — patient, day and time, doctor — and says they stay booked", () => {
    answer.current = {
      data: {
        total: 2,
        appointments: [
          { id: "a-1", scheduledAt: "2026-10-24T05:00:00Z", doctorName: "Maya Rao", patientName: "Rahul Verma" },
          { id: "a-2", scheduledAt: "2026-10-25T03:45:00Z", doctorName: "Arun Sen", patientName: null },
        ],
      },
    };
    draw();
    expect(useClosureAppointments).toHaveBeenCalledWith(days);
    const notice = screen.getByRole("region", { name: "2 appointments on these days" });
    expect(notice).toHaveTextContent("They stay booked — move or cancel them from the calendar.");
    const rows = within(screen.getByRole("list", { name: "Appointments on these days" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Rahul Verma");
    expect(rows[0]).toHaveTextContent("24 Oct, 10:30 AM · Maya Rao");
    // A patient the reader may not see is not named.
    expect(rows[1]).toHaveTextContent("A patient");
    expect(rows[1]).toHaveTextContent("25 Oct, 9:15 AM · Arun Sen");
    expect(screen.queryByText(/^And/)).not.toBeInTheDocument();
  });

  it("says one in the singular, and how many more there are past those listed", () => {
    answer.current = {
      data: {
        total: 21,
        appointments: [
          { id: "a-1", scheduledAt: "2026-10-24T05:00:00Z", doctorName: "Maya Rao", patientName: "Rahul Verma" },
        ],
      },
    };
    draw();
    expect(screen.getByRole("heading", { name: "21 appointments on these days" })).toBeInTheDocument();
    expect(screen.getByText("And 20 more")).toBeInTheDocument();

    answer.current = { data: { total: 1, appointments: answer.current.data!.appointments } };
    draw();
    expect(screen.getByRole("heading", { name: "1 appointment on these days" })).toBeInTheDocument();
  });

  it("shows nothing while there is nothing yet, or nothing on the days", () => {
    const { container, rerender } = draw();
    expect(container).toBeEmptyDOMElement();
    answer.current = { data: { total: 0, appointments: [] } };
    rerender(<ClosureAppointments {...days} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says when the check could not be made, rather than passing for none, and asks again", async () => {
    answer.current = { error: new Error("offline") };
    draw();
    expect(screen.getByRole("status")).toHaveTextContent("The appointments on these days couldn't be checked.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
