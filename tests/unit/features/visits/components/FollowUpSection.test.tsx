import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Visit } from "@/features/visits/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, refresh } = vi.hoisted(() => ({
  client: { change: vi.fn() },
  refresh: vi.fn(),
}));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));
// The booking sheet is the calendar's to test: here, only what it is opened with.
vi.mock("@/features/appointments/components/BookingSheet", () => ({
  BookingSheet: ({
    open,
    onClose,
    patient,
    prefill,
  }: {
    open: boolean;
    onClose: () => void;
    patient: { name: string };
    prefill: { doctorId: string; date: string };
  }) =>
    open ? (
      <div role="dialog" aria-label="Booking">
        {`${patient.name} · ${prefill.doctorId} · ${prefill.date}`}
        <button type="button" onClick={onClose}>
          Close booking
        </button>
      </div>
    ) : null,
}));

const { FollowUpSection } = await import("@/features/visits/components/FollowUpSection");

/** Asha Iyer's visit on Tuesday 13 October 2026, with Maya Rao. */
const aVisit = (followUpOn: string | null = null): Visit => ({
  id: "v-1",
  status: "OPEN",
  billingStatus: null,
  day: "2026-10-13",
  startedAt: "2026-10-13T05:00:00Z",
  completedAt: null,
  patient: { id: "p-1", name: "Asha Iyer", number: 1012, dateOfBirth: "1990-04-12", gender: "FEMALE", archived: false },
  doctorId: "d-1",
  doctorName: "Maya Rao",
  doctorRegistration: "KMC 12345",
  prescription: null,
  appointment: { id: "a-1", status: "IN_PROGRESS", token: 7, urgentAt: null },
  alerts: [],
  complaint: null,
  diagnosis: null,
  notes: null,
  followUpOn,
  vitals: null,
});

const draw = (followUpOn: string | null = null, { writes = true, books = false } = {}) =>
  render(
    <Providers>
      <FollowUpSection visit={aVisit(followUpOn)} writes={writes} books={books} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "Follow-up" });
const chip = (name: string) => within(section()).getByRole("radio", { name });
const save = () => within(section()).queryByRole("button", { name: "Save follow-up" });
const control = () => within(section()).getByRole("button", { name: /^Review on/ });
const calendar = () => screen.getByRole("dialog", { name: "Review on: pick a day" });

beforeEach(() => {
  vi.clearAllMocks();
  // Now, in Kochi: Tuesday 13 October 2026, 10:42 AM.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T05:12:00Z"));
  refresh.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("FollowUpSection (plan §12.2; D205)", () => {
  it("reads the review day out to whoever may only read — or that there is none", () => {
    const { unmount } = draw("2026-10-20", { writes: false });
    expect(within(section()).getByText("Review on Tuesday, 20 Oct 2026")).toBeInTheDocument();
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
    unmount();
    draw(null, { writes: false });
    expect(within(section()).getByText("No follow-up")).toBeInTheDocument();
  });

  it("books the next appointment with the patient, the doctor and the review day — today without one", async () => {
    const { unmount } = draw("2026-10-20", { writes: false, books: true });
    await userEvent.click(within(section()).getByRole("button", { name: "Book next appointment" }));
    const booking = screen.getByRole("dialog", { name: "Booking" });
    expect(booking).toHaveTextContent("Asha Iyer · d-1 · 2026-10-20");
    await userEvent.click(within(booking).getByRole("button", { name: "Close booking" }));
    expect(screen.queryByRole("dialog", { name: "Booking" })).not.toBeInTheDocument();
    unmount();

    draw(null, { books: true });
    expect(save()).not.toBeInTheDocument();
    await userEvent.click(within(section()).getByRole("button", { name: "Book next appointment" }));
    expect(screen.getByRole("dialog", { name: "Booking" })).toHaveTextContent("2026-10-13");
  });

  it("sets the day from a chip, counted from the visit's day, and saves it from the copy read", async () => {
    client.change.mockResolvedValue({ followUpOn: "2026-11-13" });
    draw();
    for (const name of ["3 days", "1 week", "2 weeks", "1 month"]) expect(chip(name)).not.toBeChecked();
    await userEvent.click(chip("1 week"));
    expect(chip("1 week")).toBeChecked();
    expect(control()).toHaveTextContent("20 Oct 2026");
    await userEvent.click(chip("1 month"));
    expect(chip("1 month")).toBeChecked();
    expect(control()).toHaveTextContent("13 Nov 2026");

    await userEvent.click(save()!);
    expect(client.change).toHaveBeenCalledWith({
      id: "v-1",
      input: { section: "FOLLOW_UP", changes: { followUpOn: "2026-11-13" }, seen: { followUpOn: null } },
    });
    expect((await screen.findAllByText("Review on Friday, 13 Nov 2026"))[0]).toBeInTheDocument();
    await waitFor(() => expect(save()).not.toBeInTheDocument());
  });

  it("takes any day after the visit's from the calendar, never the visit's own", async () => {
    draw();
    await userEvent.click(control());
    expect(within(calendar()).getByRole("button", { name: "Tuesday, 13 Oct 2026" })).toBeDisabled();
    await userEvent.click(within(calendar()).getByRole("button", { name: "Wednesday, 14 Oct 2026" }));
    expect(control()).toHaveTextContent("14 Oct 2026");
    for (const name of ["3 days", "1 week", "2 weeks", "1 month"]) expect(chip(name)).not.toBeChecked();
  });

  it("removes the follow-up, saying so", async () => {
    client.change.mockResolvedValue({});
    draw("2026-10-20", { books: true });
    expect(chip("1 week")).toBeChecked();
    expect(within(section()).getByRole("button", { name: "Book next appointment" })).toBeInTheDocument();
    await userEvent.click(control());
    await userEvent.click(within(calendar()).getByRole("button", { name: "Clear" }));
    await userEvent.click(save()!);
    expect(client.change).toHaveBeenCalledWith({
      id: "v-1",
      input: { section: "FOLLOW_UP", changes: { followUpOn: "" }, seen: { followUpOn: "2026-10-20" } },
    });
    expect((await screen.findAllByText("Follow-up removed"))[0]).toBeInTheDocument();
  });

  it("reads the visit again when someone saved it meanwhile — and not for any other failure", async () => {
    client.change.mockRejectedValueOnce(new ApiError(409, "VISIT_CHANGED", "Changed."));
    client.change.mockRejectedValueOnce(new Error("offline"));
    draw();
    await userEvent.click(chip("3 days"));
    await userEvent.click(save()!);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(["/api/visits/v-1"]);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    refresh.mockClear();
    await userEvent.click(save()!);
    await waitFor(() => expect(client.change).toHaveBeenCalledTimes(2));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps what is chosen when someone saves meanwhile, showing theirs, which Use theirs takes", async () => {
    const { rerender } = draw();
    await userEvent.click(chip("3 days"));
    rerender(
      <Providers>
        <FollowUpSection visit={aVisit("2026-10-27")} writes books={false} />
      </Providers>,
    );
    const notice = within(section()).getByRole("status");
    expect(within(notice).getByText("Review on Tuesday, 27 Oct 2026")).toBeInTheDocument();
    expect(chip("3 days")).toBeChecked();
    await userEvent.click(within(notice).getByRole("button", { name: "Use theirs" }));
    expect(chip("2 weeks")).toBeChecked();
  });
});
