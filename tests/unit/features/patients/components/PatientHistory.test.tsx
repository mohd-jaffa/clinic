import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientAppointment } from "@/features/appointments/types";
import type { PatientBill, Payment } from "@/features/billing/types";
import type { PatientVisit } from "@/features/visits/types";
import { aCalendarAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { pages, auth } = vi.hoisted(() => ({
  pages: { current: {} as Record<string, unknown> },
  auth: { current: {} as ReturnType<typeof authStub> },
}));
vi.mock("@/features/patients/hooks/usePatientTimeline", () => ({ usePatientTimeline: () => pages.current }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { voidPayment: vi.fn() } }));

const { PatientHistory } = await import("@/features/patients/components/PatientHistory");

const onOpen = vi.fn();
const appointment = (overrides: Partial<PatientAppointment> = {}) => ({
  appointment: { ...aCalendarAppointment(), cancelReason: null, ...overrides },
});
const visit = (overrides: Partial<PatientVisit> = {}) => ({
  visit: {
    id: "v-1",
    status: "COMPLETED" as const,
    day: "2026-10-14",
    openedAt: "2026-10-14T05:00:00Z",
    doctorName: "Maya Rao",
    finding: "Dental caries",
    medicines: ["Paracetamol", "Amoxicillin", "Metronidazole"],
    treatments: [] as string[],
    recorded: true,
    ...overrides,
  },
});

const bill = (overrides: Partial<PatientBill> = {}) => ({
  bill: {
    id: "b-1",
    number: "2026-27/0042",
    issuedAt: "2026-10-16T05:30:00Z",
    totalPaise: 150_000,
    settlement: { paidPaise: 50_000, duePaise: 100_000 },
    state: "PART_PAID" as const,
    ...overrides,
  },
});
const payment = (overrides: Partial<Payment> = {}) => ({
  payment: {
    id: "pay-1",
    kind: "PAYMENT" as const,
    amountPaise: 50_000,
    method: "UPI" as const,
    reference: null,
    paidAt: "2026-10-16T06:00:00Z",
    paidOn: "2026-10-16",
    note: null,
    status: "RECORDED" as const,
    receivedBy: "Priya Shah",
    void: null,
    patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
    ...overrides,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
});

const draw = () =>
  render(
    <Providers>
      <PatientHistory patient={aPatient()} onOpen={onOpen} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "History" });

describe("PatientHistory (plan §10.3; D167, D225 – D227, D325)", () => {
  it("lists each appointment's day and time, doctor, kind and status — a cancelled one why — opening each", async () => {
    const cancelled = appointment({
      id: "a-2",
      status: "CANCELLED",
      cancelReason: "Patient asked",
      doctorName: null,
      day: "2026-10-01",
      scheduledAt: "2026-10-01T05:00:00Z",
    });
    pages.current = { data: [appointment(), cancelled], isLoading: false, hasMore: false };
    draw();
    const rows = within(section()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("13 Oct 2026 · 9:00 AMMaya Rao · ConsultationScheduled");
    expect(rows[1]).toHaveTextContent(
      "1 Oct 2026 · 10:30 AMNo longer on the team · Consultation · Patient askedCancelled",
    );
    await userEvent.click(within(rows[1]).getByRole("button", { name: "1 Oct 2026 · 10:30 AM" }));
    expect(onOpen).toHaveBeenCalledWith(cancelled.appointment);
  });

  it("lists a visit among them with its doctor, what it found and two medicines named, opening its screen (D226, D227)", () => {
    pages.current = { data: [appointment({ id: "a-9", day: "2026-10-20" }), visit()], isLoading: false };
    draw();
    const row = within(section()).getAllByRole("listitem")[1];
    expect(row).toHaveTextContent("14 Oct 2026 · VisitMaya Rao · Dental cariesRx Paracetamol, Amoxicillin +1Done");
    // Opened from here, its back arrow leads back to the profile (D230).
    expect(within(row).getByRole("link", { name: "14 Oct 2026 · Visit" })).toHaveAttribute(
      "href",
      "/visits/v-1?from=patient",
    );
  });

  it("names every medicine when there are two or fewer, and none without a prescription", () => {
    pages.current = {
      data: [
        visit({ medicines: ["Paracetamol"] }),
        visit({ id: "v-2", status: "OPEN", medicines: [], finding: "Toothache", doctorName: null }),
      ],
      isLoading: false,
    };
    draw();
    const [one, open] = within(section()).getAllByRole("listitem");
    expect(one).toHaveTextContent("Dental cariesRx ParacetamolDone");
    expect(open).toHaveTextContent("14 Oct 2026 · VisitNo longer on the team · ToothacheOpen");
    expect(open).not.toHaveTextContent("Rx");
  });

  it("names the treatments it worked on or began on a line under the medicines, two named (D262)", () => {
    pages.current = {
      data: [
        visit({ medicines: ["Paracetamol"], treatments: ["Root canal", "Crown", "Scaling"] }),
        visit({ id: "v-2", medicines: [], treatments: ["Root canal"] }),
      ],
      isLoading: false,
    };
    draw();
    const [both, treated] = within(section()).getAllByRole("listitem");
    expect(both).toHaveTextContent("Dental cariesRx ParacetamolTx Root canal, Crown +1Done");
    expect(treated).toHaveTextContent("Dental cariesTx Root canalDone");
    expect(treated).not.toHaveTextContent("Rx");
  });

  it("says a visit holds nothing only when it holds nothing at all (D226)", () => {
    pages.current = {
      data: [
        visit({ finding: null, medicines: [], recorded: false }),
        visit({ id: "v-2", finding: null, medicines: [], recorded: true }),
      ],
      isLoading: false,
    };
    draw();
    const [empty, vitalsOnly] = within(section()).getAllByRole("listitem");
    expect(empty).toHaveTextContent("Maya Rao · Nothing recorded");
    expect(vitalsOnly).toHaveTextContent("14 Oct 2026 · VisitMaya RaoDone");
    expect(vitalsOnly).not.toHaveTextContent("Nothing recorded");
  });

  it("lists a bill by its number, day and total, where it stands, opening its page — which leads back here (D325)", () => {
    pages.current = { data: [bill(), bill({ id: "b-0", state: "VOID", settlement: null })], isLoading: false };
    draw();
    const [part, voided] = within(section()).getAllByRole("listitem");
    expect(part).toHaveTextContent("Bill 2026-27/004216 Oct 2026 · ₹1,500Part paid");
    expect(within(part).getByRole("link", { name: "Bill 2026-27/0042" })).toHaveAttribute(
      "href",
      "/bills/b-1?from=patient",
    );
    expect(voided).toHaveTextContent("Void");
  });

  it("lists a payment and a refund by how much and how, their day and who took them — a void one marked (D325)", () => {
    pages.current = {
      data: [
        payment(),
        payment({ id: "pay-2", kind: "REFUND", method: "CASH", receivedBy: null }),
        payment({ id: "pay-3", void: { reason: "Twice", at: "2026-10-17T05:00:00Z", by: "Asha Menon" } }),
      ],
      isLoading: false,
    };
    draw();
    const [paid, refunded, voided] = within(section()).getAllByRole("listitem");
    expect(paid).toHaveTextContent("Paid ₹500 · UPI16 Oct 2026 · Priya Shah");
    expect(refunded).toHaveTextContent("Refunded ₹500 · Cash16 Oct 2026Refund");
    expect(voided).toHaveTextContent("Void");
  });

  it("opens a payment's sheet, where it may be voided, with no way to the profile it is on (D336)", async () => {
    pages.current = { data: [payment()], isLoading: false };
    draw();
    await userEvent.click(within(section()).getByRole("button", { name: "Paid ₹500 · UPI" }));
    const sheet = screen.getByRole("dialog", { name: "Payment" });
    expect(sheet).toHaveTextContent("₹500");
    expect(within(sheet).getByRole("button", { name: "Void payment" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("link", { name: /profile/ })).not.toBeInTheDocument();
  });

  it("says none yet", () => {
    pages.current = { data: [], isLoading: false };
    draw();
    expect(within(section()).getByRole("heading", { name: "No visits or appointments yet" })).toBeInTheDocument();
  });

  it("says when it could not be read", () => {
    pages.current = { data: undefined, isLoading: false, error: new Error("down"), mutate: vi.fn() };
    draw();
    expect(within(section()).getByText("This patient's history couldn't be loaded.")).toBeInTheDocument();
  });

  it("shows more a page at a time", async () => {
    const loadMore = vi.fn();
    pages.current = { data: [appointment()], isLoading: false, hasMore: true, loadMore };
    draw();
    await userEvent.click(within(section()).getByRole("button", { name: "Show more" }));
    expect(loadMore).toHaveBeenCalled();
  });
});
