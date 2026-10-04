import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Patient } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
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

  it("calls them, or opens a WhatsApp chat with nothing typed", () => {
    draw();
    expect(screen.getByRole("link", { name: "Call Rohan Mehta" })).toHaveAttribute("href", "tel:+919876543210");
    const chat = screen.getByRole("link", { name: "WhatsApp Rohan Mehta" });
    expect(chat).toHaveAttribute("href", "https://wa.me/919876543210");
    expect(chat).toHaveAttribute("target", "_blank");
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
    query.current = { data: aPatient({ archived: true }), isLoading: false };
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
