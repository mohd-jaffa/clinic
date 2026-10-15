import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarAppointment } from "@/features/appointments/types";
import type { Patient } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { aCalendarAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { auth, query, sheet } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  query: { current: {} as Record<string, unknown> },
  sheet: { patient: undefined as Patient | undefined },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/hooks/usePatient", () => ({ usePatient: () => query.current }));
vi.mock("@/features/patients/components/PatientAlerts", () => ({
  PatientAlerts: ({ patient }: { patient: Patient }) => <p>{`${patient.name}'s alerts`}</p>,
}));
vi.mock("@/features/patients/components/PatientArchived", () => ({
  PatientArchived: ({ patient, archivedAt }: { patient: Patient; archivedAt: string }) => (
    <p>{`${patient.name} archived at ${archivedAt}`}</p>
  ),
}));
vi.mock("@/features/patients/components/PatientSheet", () => ({
  PatientSheet: ({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: Patient }) => {
    sheet.patient = patient;
    return open ? (
      <div role="dialog" aria-label="Edit patient">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null;
  },
}));

vi.mock("@/features/patients/components/NextAppointment", () => ({
  NextAppointment: ({ onOpen }: { onOpen: (appointment: CalendarAppointment) => void }) => (
    <button type="button" onClick={() => onOpen(aCalendarAppointment())}>
      Next appointment
    </button>
  ),
}));
vi.mock("@/features/visits/components/NewVisit", () => ({
  NewVisit: ({ patient }: { patient: Patient }) => <button type="button">{`New visit for ${patient.name}`}</button>,
}));
vi.mock("@/features/patients/components/PatientHistory", () => ({
  PatientHistory: () => <p>History</p>,
}));
vi.mock("@/features/appointments/components/AppointmentPanel", () => ({
  AppointmentPanel: ({
    appointment,
    open,
    linkProfile,
  }: {
    appointment: CalendarAppointment | null;
    open: boolean;
    linkProfile: boolean;
  }) => (open ? <div role="dialog" aria-label={`${appointment!.patientName}, ${String(linkProfile)}`} /> : null),
}));

const { PatientProfile } = await import("@/features/patients/components/PatientProfile");

const ROHAN = aPatient({ dateOfBirth: "1992-04-12" });

const draw = () =>
  render(
    <Providers>
      <PatientProfile id="p-1" />
    </Providers>,
  );

/** The details as the card reads them: each term and its value. */
const details = () =>
  screen.getAllByRole("term").map((term) => [term.textContent, term.nextElementSibling?.textContent]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  auth.current = authStub();
  query.current = { data: ROHAN, isLoading: false };
  sheet.patient = undefined;
});
afterEach(() => vi.useRealTimers());

describe("PatientProfile's header (plan §10.3, D115)", () => {
  it("names the patient, their age, gender, number and doctor, and leads back to the list", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Rohan Mehta" })).toBeInTheDocument();
    expect(screen.getByText("34 y · Male · P-1012")).toBeInTheDocument();
    expect(screen.getByText("Doctor · Rahul Nair")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/patients");
  });

  it("carries their alerts (D117)", () => {
    draw();
    expect(screen.getByText("Rohan Mehta's alerts")).toBeInTheDocument();
  });

  it("says when they are archived, and nothing when they are not (D123)", () => {
    const { unmount } = draw();
    expect(screen.queryByText(/archived at/)).not.toBeInTheDocument();
    unmount();
    query.current = { data: aPatient({ archivedAt: "2026-10-01T05:00:00Z" }), isLoading: false };
    draw();
    expect(screen.getByText("Rohan Mehta archived at 2026-10-01T05:00:00Z")).toBeInTheDocument();
  });

  it("calls them, or opens a WhatsApp chat with nothing typed", () => {
    draw();
    expect(screen.getByRole("link", { name: "Call Rohan Mehta" })).toHaveAttribute("href", "tel:+919876543210");
    const chat = screen.getByRole("link", { name: "WhatsApp Rohan Mehta" });
    expect(chat).toHaveAttribute("href", "https://wa.me/919876543210");
    expect(chat).toHaveAttribute("target", "_blank");
  });

  it("offers New visit beside them, which decides for itself who may start one (D204)", () => {
    draw();
    const visit = screen.getByRole("button", { name: "New visit for Rohan Mehta" });
    expect(visit.parentElement).toContainElement(
      screen.getByRole("link", { name: "WhatsApp Rohan Mehta" }).parentElement,
    );
  });

  it("says when they have no doctor yet", () => {
    query.current = { data: aPatient({ assignedDoctorId: null, doctorName: null }), isLoading: false };
    draw();
    expect(screen.getByText("No doctor yet")).toBeInTheDocument();
  });
});

describe("PatientProfile's details (D113, D116)", () => {
  it("lists only what holds a value: the mobile always, the date of birth when given as one", () => {
    draw();
    expect(details()).toEqual([
      ["Mobile", "+91 98765 43210"],
      ["Date of birth", "12 Apr 1992"],
    ]);
  });

  it("lists every detail they have, notes included, in the sheet's order", () => {
    query.current = {
      data: aPatient({
        dobIsEstimated: true,
        altPhone: "0484 234 5678",
        email: "rohan@mail.in",
        address: "12 MG Road, Kochi",
        emergencyContactName: "Anita Mehta",
        emergencyContactPhone: "98765 11111",
        notes: "Prefers mornings",
      }),
      isLoading: false,
    };
    draw();
    expect(details()).toEqual([
      ["Mobile", "+91 98765 43210"],
      ["Alternate phone", "0484 234 5678"],
      ["Email", "rohan@mail.in"],
      ["Address", "12 MG Road, Kochi"],
      ["Emergency contact", "Anita Mehta · 98765 11111"],
      ["Notes", "Prefers mornings"],
    ]);
  });

  it("gives an emergency contact as much as was given of them", () => {
    query.current = { data: aPatient({ emergencyContactPhone: "98765 11111" }), isLoading: false };
    draw();
    expect(details()).toContainEqual(["Emergency contact", "98765 11111"]);
  });
});

describe("PatientProfile's Edit", () => {
  it("opens the patient sheet on them, for those who may change them", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Edit Rohan Mehta" }));
    expect(screen.getByRole("dialog", { name: "Edit patient" })).toBeInTheDocument();
    expect(sheet.patient).toBe(ROHAN);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is not there for someone who may only see patients", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    draw();
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Details" })).toBeInTheDocument();
  });

  it("is not there in a view-only clinic, which says why", () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
  });

  it("is not there for an archived patient (D103), nor for someone with no clinic", () => {
    query.current = { data: aPatient({ archivedAt: "2026-10-01T05:00:00Z" }), isLoading: false };
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
    unmount();
    query.current = { data: ROHAN, isLoading: false };
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });
});

describe("PatientProfile while it loads", () => {
  it("stands in with rows, under the place's name", () => {
    query.current = { data: undefined, isLoading: true };
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Patients" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading…")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link", { name: /^Call/ })).not.toBeInTheDocument();
  });

  it("says why they couldn't be loaded — one not theirs to see is not found — and tries again", async () => {
    const mutate = vi.fn();
    query.current = {
      data: undefined,
      isLoading: false,
      error: new ApiError(404, "RECORD_NOT_FOUND", "That record could not be found. Refresh and try again.", "req_1"),
      mutate,
    };
    draw();
    expect(screen.getByRole("alert")).toHaveTextContent("That record could not be found. Refresh and try again.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalledOnce();
  });
});

describe("PatientProfile's appointments and history (D166, D167, D225, D231)", () => {
  it("shows the next appointment and the history to whoever sees appointments, each opening its detail here", async () => {
    draw();
    expect(screen.getByText("History")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next appointment" }));
    // On the profile itself, the detail offers no way back to it.
    expect(screen.getByRole("dialog", { name: "Rohan Mehta, false" })).toBeInTheDocument();
  });

  it("shows neither to someone who may not see appointments or visits", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    draw();
    expect(screen.queryByRole("button", { name: "Next appointment" })).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });

  it("shows the history, with no next appointment, to someone who sees visits alone (D225)", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view"] });
    draw();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next appointment" })).not.toBeInTheDocument();
  });

  it("puts the history in a column of its own beside their state on a desktop (D231)", () => {
    draw();
    const state = screen.getByRole("button", { name: "Next appointment" }).parentElement!;
    const columns = state.parentElement!;
    expect(columns).toHaveClass("lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]");
    expect(within(state).getByRole("heading", { name: "Details" })).toBeInTheDocument();
    expect(within(state).queryByText("History")).not.toBeInTheDocument();
    expect(screen.getByText("History").parentElement).toBe(columns);
  });
});
