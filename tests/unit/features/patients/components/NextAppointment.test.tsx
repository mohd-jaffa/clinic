import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientSummary } from "@/features/patients/types";
import { aCalendarAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { auth, summary, booking } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  summary: { current: {} as { data?: PatientSummary; error?: unknown; mutate: () => void; isValidating: boolean } },
  booking: { patient: undefined as unknown },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/hooks/usePatientSummary", () => ({ usePatientSummary: () => summary.current }));
vi.mock("@/features/appointments/components/BookingSheet", () => ({
  BookingSheet: ({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: unknown }) => {
    booking.patient = patient;
    return open ? (
      <div role="dialog" aria-label="Book an appointment">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null;
  },
}));

const { NextAppointment } = await import("@/features/patients/components/NextAppointment");

const ROHAN = aPatient();
const onOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({
    role: "STAFF",
    permissions: ["patients.view", "appointments.view", "appointments.create"],
  });
  summary.current = { data: { nextAppointment: null }, mutate: vi.fn(), isValidating: false };
  booking.patient = undefined;
});

const draw = (patient = ROHAN) =>
  render(
    <Providers>
      <NextAppointment patient={patient} onOpen={onOpen} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "Next appointment" });

describe("NextAppointment (plan §10.3, D166)", () => {
  it("names the next appointment — its day, time, doctor and kind — and opens it", async () => {
    const next = aCalendarAppointment({ status: "CONFIRMED" });
    summary.current = { data: { nextAppointment: next }, mutate: vi.fn(), isValidating: false };
    draw();
    expect(within(section()).getByRole("listitem")).toHaveTextContent(
      "Tuesday, 13 Oct 20269:00 AM · Maya Rao · ConsultationConfirmed",
    );
    await userEvent.click(within(section()).getByRole("button", { name: "Tuesday, 13 Oct 2026" }));
    expect(onOpen).toHaveBeenCalledWith(next);
  });

  it("says a doctor gone from the team", () => {
    summary.current = {
      data: { nextAppointment: aCalendarAppointment({ doctorName: null }) },
      mutate: vi.fn(),
      isValidating: false,
    };
    draw();
    expect(within(section()).getByRole("listitem")).toHaveTextContent("No longer on the team");
  });

  it("says none is to come, and books them here", async () => {
    draw();
    expect(within(section()).getByText("No appointment to come")).toBeInTheDocument();
    await userEvent.click(within(section()).getByRole("button", { name: "Book an appointment for Rohan Mehta" }));
    expect(screen.getByRole("dialog", { name: "Book an appointment" })).toBeInTheDocument();
    expect(booking.patient).toEqual({ id: ROHAN.id, name: "Rohan Mehta", number: 1012 });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers no Book to someone who may not book, for an archived patient, or in a view-only clinic, saying why", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view"] });
    const { unmount } = draw();
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
    unmount();

    auth.current = authStub({ role: "STAFF", permissions: ["appointments.view", "appointments.create"] });
    const archived = draw(aPatient({ archivedAt: "2026-10-04T05:00:00Z" }));
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
    archived.unmount();

    const viewOnly = authStub({ role: "STAFF", permissions: ["appointments.view", "appointments.create"] });
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    draw();
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(section()).getByText(/view-only/)).toBeInTheDocument();
  });

  it("stands in while it loads, and says when it cannot", async () => {
    summary.current = { mutate: vi.fn(), isValidating: false };
    const { rerender } = draw();
    expect(within(section()).getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    summary.current = { error: new Error("down"), mutate: vi.fn(), isValidating: false };
    rerender(
      <Providers>
        <NextAppointment patient={ROHAN} onOpen={onOpen} />
      </Providers>,
    );
    await userEvent.click(within(section()).getByRole("button", { name: "Try again" }));
    expect(summary.current.mutate).toHaveBeenCalled();
  });
});
