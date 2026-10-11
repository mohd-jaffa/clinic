import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppointmentBlock } from "@/features/appointments/components/AppointmentBlock";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("AppointmentBlock", () => {
  it("draws its start and patient, what kind and where it stands, a status edge down its side", () => {
    const { container } = render(<AppointmentBlock appointment={aCalendarAppointment({ status: "CONFIRMED" })} />);
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByText("Consultation · Confirmed")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("border-action", "bg-surface");
  });

  it("draws a walk-in on the soft green with its token", () => {
    const { container } = render(
      <AppointmentBlock appointment={aCalendarAppointment({ source: "WALK_IN", status: "ARRIVED", token: 4 })} />,
    );
    expect(screen.getByText("Walk-in #4 · Arrived")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-action-soft");
    const { container: quiet } = render(
      <AppointmentBlock appointment={aCalendarAppointment({ status: "COMPLETED" })} />,
    );
    expect(quiet.firstElementChild).toHaveClass("border-edge");
  });
});
