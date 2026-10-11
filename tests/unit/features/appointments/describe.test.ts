import { describe, expect, it } from "vitest";

import { kindOf, sayAppointment, timeOf } from "@/features/appointments/describe";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("describing an appointment", () => {
  it("names its kind: its type, or a walk-in with its token", () => {
    expect(kindOf(aCalendarAppointment())).toBe("Consultation");
    expect(kindOf(aCalendarAppointment({ source: "WALK_IN", token: 7 }))).toBe("Walk-in #7");
    expect(kindOf(aCalendarAppointment({ source: "WALK_IN", token: null }))).toBe("Walk-in");
  });

  it("says when it is, start to end, and the whole of it for a screen reader", () => {
    const appointment = aCalendarAppointment({ scheduledAt: "2026-10-13T04:30:00Z", minutes: 30 });
    expect(timeOf(appointment)).toBe("10:00 AM – 10:30 AM");
    expect(sayAppointment(appointment)).toBe("10:00 AM – 10:30 AM, Rohan Mehta, Consultation, Scheduled");
  });
});
