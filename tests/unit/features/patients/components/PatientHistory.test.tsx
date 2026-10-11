import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientAppointment } from "@/features/appointments/types";
import { aCalendarAppointment } from "@tests/support/appointments";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { pages } = vi.hoisted(() => ({ pages: { current: {} as Record<string, unknown> } }));
vi.mock("@/features/patients/hooks/usePatientTimeline", () => ({ usePatientTimeline: () => pages.current }));

const { PatientHistory } = await import("@/features/patients/components/PatientHistory");

const onOpen = vi.fn();
const entry = (overrides: Partial<PatientAppointment> = {}): PatientAppointment => ({
  ...aCalendarAppointment(),
  cancelReason: null,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

const draw = () =>
  render(
    <Providers>
      <PatientHistory patient={aPatient()} onOpen={onOpen} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "History" });

describe("PatientHistory (plan §10.3, D167)", () => {
  it("lists each appointment's day and time, doctor, kind and status — a cancelled one why — opening each", async () => {
    const cancelled = entry({
      id: "a-2",
      status: "CANCELLED",
      cancelReason: "Patient asked",
      doctorName: null,
      day: "2026-10-01",
      scheduledAt: "2026-10-01T05:00:00Z",
    });
    pages.current = { data: [entry(), cancelled], isLoading: false, hasMore: false };
    draw();
    const rows = within(section()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("13 Oct 2026 · 9:00 AMMaya Rao · ConsultationScheduled");
    expect(rows[1]).toHaveTextContent(
      "1 Oct 2026 · 10:30 AMNo longer on the team · Consultation · Patient askedCancelled",
    );
    await userEvent.click(within(rows[1]).getByRole("button", { name: "1 Oct 2026 · 10:30 AM" }));
    expect(onOpen).toHaveBeenCalledWith(cancelled);
  });

  it("says none yet", () => {
    pages.current = { data: [], isLoading: false };
    draw();
    expect(within(section()).getByRole("heading", { name: "No appointments yet" })).toBeInTheDocument();
  });

  it("shows more a page at a time", async () => {
    const loadMore = vi.fn();
    pages.current = { data: [entry()], isLoading: false, hasMore: true, loadMore };
    draw();
    await userEvent.click(within(section()).getByRole("button", { name: "Show more" }));
    expect(loadMore).toHaveBeenCalled();
  });
});
