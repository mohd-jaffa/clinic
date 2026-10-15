import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientAppointment } from "@/features/appointments/types";
import type { PatientVisit } from "@/features/visits/types";
import { aCalendarAppointment } from "@tests/support/appointments";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { pages } = vi.hoisted(() => ({ pages: { current: {} as Record<string, unknown> } }));
vi.mock("@/features/patients/hooks/usePatientTimeline", () => ({ usePatientTimeline: () => pages.current }));

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
    recorded: true,
    ...overrides,
  },
});

beforeEach(() => vi.clearAllMocks());

const draw = () =>
  render(
    <Providers>
      <PatientHistory patient={aPatient()} onOpen={onOpen} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "History" });

describe("PatientHistory (plan §10.3; D167, D225 – D227)", () => {
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
