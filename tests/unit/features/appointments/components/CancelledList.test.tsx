import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CancelledList } from "@/features/appointments/components/CancelledList";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("CancelledList (D153)", () => {
  it("folds the cancelled and the no-shows away, counted, to open on asking", async () => {
    const onOpen = vi.fn();
    render(
      <CancelledList
        showDay={false}
        onOpen={onOpen}
        appointments={[
          aCalendarAppointment({ status: "CANCELLED" }),
          aCalendarAppointment({ id: "a-2", patientName: "Anita Rao", status: "NO_SHOW" }),
        ]}
      />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelled and no-shows (2)" }));
    const rows = within(screen.getByRole("list", { name: "Cancelled and no-shows (2)" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Rohan Mehta9:00 AM – 9:15 AM · ConsultationCancelled");
    expect(rows[1]).toHaveTextContent("No-show");
    // Each opens its detail, to read why (D160).
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Anita Rao" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "a-2" }));
  });

  it("names each one's day in a week, and is nothing when there are none", async () => {
    const { container, rerender } = render(
      <CancelledList showDay appointments={[aCalendarAppointment({ status: "CANCELLED" })]} onOpen={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelled and no-shows (1)" }));
    expect(screen.getByRole("listitem")).toHaveTextContent("13 Oct · 9:00 AM – 9:15 AM · Consultation");
    rerender(<CancelledList showDay appointments={[]} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
