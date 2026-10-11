import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { booked } = vi.hoisted(() => ({ booked: { current: undefined as unknown, asked: vi.fn() } }));
vi.mock("@/features/appointments/hooks/useBookedTimes", () => ({
  useBookedTimes: (doctorId: string, date: string) => {
    booked.asked(doctorId, date);
    return { data: booked.current };
  },
}));

const { DoctorDay } = await import("@/features/appointments/components/DoctorDay");

beforeEach(() => {
  vi.clearAllMocks();
  booked.current = undefined;
});

describe("DoctorDay (D147)", () => {
  it("names each time the doctor is booked that day, start to end, and never breaks inside one", () => {
    booked.current = [
      { startsAt: "2026-10-13T04:30:00Z", endsAt: "2026-10-13T05:00:00Z" },
      { startsAt: "2026-10-13T10:30:00Z", endsAt: "2026-10-13T10:45:00Z" },
    ];
    render(<DoctorDay doctorId="d-1" doctorName="Maya Rao" date="2026-10-13" />);
    expect(booked.asked).toHaveBeenCalledWith("d-1", "2026-10-13");
    const line = screen.getByText(/^Maya Rao that day:/);
    expect(line).toHaveTextContent("Maya Rao that day: 10:00 AM – 10:30 AM, 4:00 PM – 4:15 PM.");
    expect(line).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("10:00 AM – 10:30 AM")).toHaveClass("whitespace-nowrap");
  });

  it("says when nothing is booked yet, and nothing while it is unknown or no doctor is chosen", () => {
    booked.current = [];
    const { rerender, container } = render(<DoctorDay doctorId="d-1" doctorName="Maya Rao" date="2026-10-13" />);
    expect(screen.getByText("Nothing booked for Maya Rao that day yet.")).toBeInTheDocument();
    rerender(<DoctorDay doctorId="" doctorName="" date="2026-10-13" />);
    expect(container).toHaveTextContent("");
    booked.current = undefined;
    rerender(<DoctorDay doctorId="d-1" doctorName="Maya Rao" date="2026-10-13" />);
    expect(container).toHaveTextContent("");
  });
});
