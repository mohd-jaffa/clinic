import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { aFollowUp } from "@tests/support/treatments";

const { booking } = vi.hoisted(() => ({ booking: vi.fn() }));
vi.mock("@/features/treatments/components/FollowUpSheet", () => ({
  FollowUpSheet: ({ open, onClose, onBook }: { open: boolean; onClose: () => void; onBook: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Its sheet">
        <button type="button" onClick={onBook}>
          Book
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));
vi.mock("@/features/appointments/components/BookingSheet", () => ({
  BookingSheet: (props: { open: boolean; onClose: () => void; onBooked: () => void }) => {
    booking(props);
    return props.open ? (
      <div role="dialog" aria-label="Book appointment">
        <button type="button" onClick={props.onClose}>
          Back
        </button>
        <button type="button" onClick={props.onBooked}>
          Booked
        </button>
      </div>
    ) : null;
  },
}));

const { FollowUpPanel } = await import("@/features/treatments/components/FollowUpPanel");

const CLINIC = { name: "Smile Care", phone: null };
const onClose = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe("FollowUpPanel (plan §14.3, D276)", () => {
  it("books in its sheet's place, for the patient, the doctor and the day due — back to the sheet, or closing when booked", async () => {
    const due = addDaysKey(todayKey(), 3);
    render(
      <FollowUpPanel
        followUp={aFollowUp({ dueOn: due })}
        tab="UPCOMING"
        clinic={CLINIC}
        notes
        books
        open
        onClose={onClose}
      />,
    );
    expect(booking).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Book" }));
    expect(screen.getByRole("dialog", { name: "Book appointment" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Its sheet" })).not.toBeInTheDocument();
    expect(booking).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patient: { id: "p-1", name: "Anita Rao", number: 42 },
        prefill: { doctorId: "d-1", date: due, time: { hour: "", minute: "" } },
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Its sheet" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Book" }));
    await userEvent.click(screen.getByRole("button", { name: "Booked" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("books one overdue from today", async () => {
    render(
      <FollowUpPanel
        followUp={aFollowUp({ dueOn: "2020-01-01" })}
        tab="OVERDUE"
        clinic={CLINIC}
        notes
        books
        open
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Book" }));
    expect(booking.mock.lastCall![0]).toMatchObject({ prefill: { date: todayKey() } });
  });

  it("brings no booking for whoever does not book, and nothing for no follow-up", async () => {
    const { container, rerender } = render(
      <FollowUpPanel followUp={aFollowUp()} tab="TODAY" clinic={CLINIC} notes books={false} open onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Book" }));
    expect(booking).not.toHaveBeenCalled();
    rerender(<FollowUpPanel followUp={null} tab="TODAY" clinic={CLINIC} notes books open onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
  });
});
