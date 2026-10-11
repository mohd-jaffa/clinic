import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CancelledList } from "@/features/appointments/components/CancelledList";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("CancelledList (D153)", () => {
  it("folds the cancelled and the no-shows away, counted, to open on asking", async () => {
    render(
      <CancelledList
        showDay={false}
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
  });

  it("names each one's day in a week, and is nothing when there are none", async () => {
    const { container, rerender } = render(
      <CancelledList showDay appointments={[aCalendarAppointment({ status: "CANCELLED" })]} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelled and no-shows (1)" }));
    expect(screen.getByRole("listitem")).toHaveTextContent("13 Oct · 9:00 AM – 9:15 AM · Consultation");
    rerender(<CancelledList showDay appointments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
